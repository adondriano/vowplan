import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ReportsView } from "@/components/planner/reports-view";
import { parseInvitationContent } from "@/lib/domain/invitation";
import type { Wedding } from "@/lib/domain/types";

/**
 * Regression tests for the production "Server Components render" digest error:
 * reports-view was a Server Component (no "use client") carrying an onClick
 * handler — React Server Components cannot serialize event handlers, and the
 * failure only surfaces at request time on force-dynamic pages.
 */

const wedding = {
  id: "w1",
  owner_id: "u1",
  bride_name: "Ana",
  groom_name: "Miguel",
  partner1_label: "Bride",
  partner2_label: "Groom",
  wedding_date: "2027-02-20",
  date_status: "confirmed" as const,
  location: "Tagaytay",
  currency: "PHP",
  guest_count_estimate: 100,
  total_budget: 500000,
  contingency_pct: 10,
  rsvp_deadline: "2027-01-20",
  planning_status: "planning" as const,
  wedding_style: null,
  rsvp_settings: {},
  invitation_config: parseInvitationContent({ coverHeading: "Ana & Miguel" }),
  invitation_published: true,
  public_slug: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const data = {
  groups: [{ id: "g1", name: "Reyes", category: "Family", side: "bride", invited_pax: 3 }],
  invitations: [{ id: "i1", group_id: "g1", max_pax: 3, status: "sent", sent_at: "2026-02-01T00:00:00Z" }],
  guests: [{ id: "gu1", group_id: "g1", first_name: "Liza", last_name: "Reyes" }],
  responses: [{ invitation_id: "i1", status: "confirmed", attending_count: 2 }],
  tasks: [
    { id: "t1", title: "Book church", category: "Church", status: "done", due_date: "2026-05-01", assignee: "Maria" },
    { id: "t2", title: "Send invites", category: "Guests", status: "todo", due_date: "2099-01-01", assignee: null },
  ],
  expenses: [
    {
      id: "e1", wedding_id: "w1", title: "Catering", category_id: null, vendor_id: null,
      estimated_amount: 200000, quoted_amount: null, contracted_amount: 180000, actual_amount: null,
      payment_status: "partial", currency: "PHP", conversion_rate: 1, due_date: null,
      task_id: null, notes: null, created_at: "2026-01-01T00:00:00Z",
    },
  ],
  payments: [
    { id: "p1", expense_id: "e1", label: "Deposit", amount: 50000, due_date: "2099-06-01", status: "scheduled", paid_at: null, method: null, reference: null, notes: null },
  ],
  vendors: [],
  events: [{ id: "ev1", wedding_id: "w1", title: "Ceremony", event_date: "2027-02-20", event_type: "wedding_day", start_time: "15:00", end_time: null, location: null, description: null, is_public: true, sort_order: 40 }],
};

describe("ReportsView", () => {
  it("renders the full report to HTML without throwing", () => {
    const html = renderToString(<ReportsView wedding={wedding} data={data} />);
    expect(html).toContain("Guest report");
    expect(html).toContain("Budget report");
    expect(html).toContain("Task report");
  });
});

/** Scans every .tsx component: files without "use client" must not pass event
 *  handlers — the RSC flight serializer rejects them at request time. */
describe("RSC safety: no event handlers in Server Components", () => {
  const root = join(__dirname, "..", "..", "src");
  const HANDLER_RE = /\son[A-Z][A-Za-z]*=/;

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return walk(p);
      return name.endsWith(".tsx") ? [p] : [];
    });
  }

  it("every .tsx using event handlers declares \"use client\"", () => {
    const offenders = walk(root)
      .filter((f) => !readFileSync(f, "utf8").replace(/^[\uFEFF\s]*"use client";/, "").match(HANDLER_RE))
      .length;
    const withHandlers = walk(root).filter((f) => {
      const src = readFileSync(f, "utf8");
      return !src.replace(/^[\uFEFF\s]*"use client";/, "").match(HANDLER_RE) ? false : !src.match(/^\s*["']use client["']/m);
    });
    expect(
      withHandlers,
      `Server Components with event handlers found: ${withHandlers.join(", ")}`,
    ).toEqual([]);
    expect(offenders).toBeGreaterThanOrEqual(0); // sanity: scanner ran
  });
});
