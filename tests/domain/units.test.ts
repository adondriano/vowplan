import { describe, it, expect } from "vitest";
import { generateInvitationToken, hashToken, encryptToken, decryptToken } from "@/lib/domain/tokens";
import { toCsv, parseCsv } from "@/lib/domain/csv";
import { buildArchiveZip, parseArchiveZip, ARCHIVE_SCHEMA_VERSION, type WeddingArchiveData } from "@/lib/domain/archive";
import { dueDateFromTemplate, DEFAULT_TASK_TEMPLATES, BUDGET_CATEGORY_DEFAULTS, type TaskTemplate } from "@/lib/domain/task-templates";
import { parseInvitationContent, parseInvitationTheme, TEMPLATE_PRESETS } from "@/lib/domain/invitation";
import { computeExpense, computeCategorySpending, computeBudgetAlerts, type ExpenseWithPayments } from "@/lib/domain/budget";
import type { ExpensePayment } from "@/lib/domain/types";

/* ------------------------------- tokens ------------------------------- */

describe("invitation tokens", () => {
  it("generates vp_-prefixed opaque tokens with safe characters", () => {
    const t = generateInvitationToken();
    expect(t.startsWith("vp_")).toBe(true);
    expect(t.length).toBeGreaterThanOrEqual(20);
    expect(t).toMatch(/^vp_[A-Za-z0-9_-]+$/);
    expect(t).not.toBe(generateInvitationToken());
  });

  it("hashes deterministically (sha256 hex)", () => {
    expect(hashToken("vp_abc")).toBe(hashToken("vp_abc"));
    expect(hashToken("vp_abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("vp_abc")).not.toBe(hashToken("vp_abd"));
  });

  it("round-trips the planner reveal cipher", () => {
    const token = "vp_roundtrip_123";
    const cipher = encryptToken(token);
    expect(cipher.startsWith("v1.")).toBe(true);
    expect(cipher.split(".").length).toBe(4);
    expect(decryptToken(cipher)).toBe(token);
    expect(decryptToken("garbage")).toBeNull();
  });
});

/* -------------------------------- CSV --------------------------------- */

describe("csv round-trip", () => {
  it("escapes quotes, commas and newlines both ways", () => {
    const csv = toCsv(["name", "notes"], [
      ["Dela Cruz, Maria", 'Brings "lechon"'],
      ["Multi\nline", "ok"],
    ]);
    const parsed = parseCsv(csv);
    expect(parsed.length).toBe(3);
    expect(parsed[1][0]).toBe("Dela Cruz, Maria");
    expect(parsed[1][1]).toBe('Brings "lechon"');
    expect(parsed[2][0]).toBe("Multi\nline");
  });

  it("emits a header row and coerces numbers/empty values", () => {
    const parsed = parseCsv(toCsv(["a", "b"], [[1, null]]));
    expect(parsed[0]).toEqual(["a", "b"]);
    expect(parsed[1][0]).toBe("1");
    expect(parsed[1][1]).toBe("");
  });
});

/* ------------------------------- archive ------------------------------ */

const emptyArchive = (): WeddingArchiveData => ({
  wedding: { id: "w1", bride_name: "Ana", groom_name: "Miguel" },
  members: [], tasks: [], events: [], guestGroups: [], guests: [], invitations: [],
  rsvps: [], rsvpAttendees: [], rsvpHistory: [], budgetCategories: [], vendors: [],
  expenses: [], expensePayments: [], venues: [], seatingTables: [], tableAssignments: [],
  weddingParty: [], documents: [], mediaAssets: [], decisions: [], invitationVersions: [],
  auditEvents: [],
});

describe("archive zip", () => {
  it("builds a parseable zip with manifest + data + csv copies", async () => {
    const data = emptyArchive();
    data.tasks = [{ id: "t1", title: "Book church", status: "done" }];
    data.guests = [{ id: "g1", first_name: "Ana" }];
    const zip = await buildArchiveZip(data, { weddingName: "Ana & Miguel" });
    const parsed = await parseArchiveZip(new Uint8Array(zip));
    expect(parsed.manifest.app).toBe("VowPlan");
    expect(parsed.manifest.schemaVersion).toBe(ARCHIVE_SCHEMA_VERSION);
    expect(parsed.manifest.counts.tasks).toBe(1);
    expect(parsed.data.tasks).toHaveLength(1);
    expect(parsed.data.guests[0].first_name).toBe("Ana");
  });
});

/* --------------------------- task templates --------------------------- */

describe("task templates", () => {
  it("ships a seed library with relative days and budget defaults", () => {
    expect(DEFAULT_TASK_TEMPLATES.length).toBeGreaterThanOrEqual(25);
    expect(BUDGET_CATEGORY_DEFAULTS.length).toBeGreaterThanOrEqual(8);
    expect(DEFAULT_TASK_TEMPLATES.every((t) => typeof t.title === "string" && t.relativeDays !== undefined)).toBe(true);
  });

  it("computes due dates by subtracting relative days from the wedding date", () => {
    const t = (relativeDays: number | null) => ({ title: "X", category: "c", priority: "medium", relativeDays }) as TaskTemplate;
    expect(dueDateFromTemplate(t(30), "2026-06-15")).toBe("2026-05-16");
    expect(dueDateFromTemplate(t(0), "2026-06-15")).toBe("2026-06-15");
    expect(dueDateFromTemplate(t(-7), "2026-06-15")).toBe("2026-06-22");
    expect(dueDateFromTemplate(t(30), null)).toBeNull();
    expect(dueDateFromTemplate(t(null), "2026-06-15")).toBeNull();
  });
});

/* ------------------------- invitation content ------------------------- */

describe("invitation content & theme parsing", () => {
  it("merges stored content over defaults without dropping required fields", () => {
    const c = parseInvitationContent({ coverHeading: "Ana & Miguel" });
    expect(c.coverHeading).toBe("Ana & Miguel");
    expect(typeof c.coverKicker).toBe("string");
    expect(Array.isArray(c.sections)).toBe(true);
    expect(c.sections.length).toBeGreaterThan(0);
  });

  it("ships at least 3 theme presets and keeps user palette overrides", () => {
    expect(Object.keys(TEMPLATE_PRESETS).length).toBeGreaterThanOrEqual(3);
    const theme = parseInvitationTheme({ template: "romantic-floral", palette: { primary: "#123456" } });
    expect(theme.palette.primary).toBe("#123456");
    expect(theme.palette.bg).toBeTruthy();
  });

  it("falls back to defaults for garbage input", () => {
    const theme = parseInvitationTheme("not a theme");
    expect(theme.template).toBeTruthy();
    const content = parseInvitationContent(null);
    expect(content.sections.length).toBeGreaterThan(0);
  });
});

/* ------------------------------- budget ------------------------------- */

const payment = (over: Partial<ExpensePayment> = {}): ExpensePayment =>
  ({ id: "p", expense_id: "e", label: "Pay", amount: 100, due_date: null, status: "scheduled", paid_at: null, method: null, reference: null, notes: null, ...over });

const exp = (payments: ExpensePayment[], over: Partial<ExpenseWithPayments> = {}): ExpenseWithPayments =>
  ({
    id: "e", wedding_id: "w", title: "Catering", category_id: null, vendor_id: null,
    estimated_amount: 100000, quoted_amount: null, contracted_amount: null, actual_amount: null,
    payment_status: "unpaid", currency: "PHP", conversion_rate: 1, due_date: null,
    task_id: null, notes: null, created_at: "", payments, ...over,
  });

describe("budget domain extras", () => {
  it("computeExpense totals payments and flags overdue ones", () => {
    const past = "2026-01-01";
    const c = computeExpense(exp(
      [
        payment({ id: "p1", amount: 40000, status: "paid", due_date: past, paid_at: past }),
        payment({ id: "p2", amount: 60000, status: "scheduled", due_date: past }),
      ],
      { contracted_amount: 100000 },
    ), new Date("2026-02-01"));
    expect(c.paid).toBe(40000);
    expect(c.committed).toBe(100000);
    expect(c.remainingBalance).toBe(60000);
    expect(c.overduePayments).toHaveLength(1);
    expect(c.overduePayments[0].amount).toBe(60000);
    expect(c.dueSoonPayments).toHaveLength(0);
  });

  it("flags schedules that exceed the contracted amount", () => {
    const c = computeExpense(exp(
      [
        payment({ id: "p1", amount: 60000 }),
        payment({ id: "p2", amount: 60000 }),
      ],
      { contracted_amount: 100000 },
    ));
    expect(c.paymentsExceedContract).toBe(true);
  });

  it("handles multi-currency conversion", () => {
    const c = computeExpense(exp([], { estimated_amount: 1000, currency: "USD", conversion_rate: 58.5, contracted_amount: 1000 }));
    expect(c.committed).toBe(58500);
  });

  it("computeCategorySpending groups paid/estimated per category", () => {
    const categories = [
      { id: "c1", name: "Venue", budgeted_amount: 100000 },
      { id: "c2", name: "Catering", budgeted_amount: 50000 },
    ];
    const expenses = [
      exp([payment({ amount: 500, status: "paid" })], { id: "e1", category_id: "c1" }),
      exp([payment({ amount: 250, status: "paid" })], { id: "e2", category_id: "c1" }),
      exp([payment({ amount: 100, status: "paid" })], { id: "e3", category_id: "c2" }),
    ];
    const spend = computeCategorySpending(categories, expenses);
    expect(spend.find((s) => s.name === "Venue")?.paid).toBe(750);
    expect(spend.find((s) => s.name === "Catering")?.paid).toBe(100);
  });

  it("computeBudgetAlerts flags overdue payments and over-total-budget", () => {
    const alerts = computeBudgetAlerts(
      [
        exp([payment({ amount: 15000, status: "scheduled", due_date: "2026-01-01" })], { id: "e1", category_id: "c1", contracted_amount: 200000, estimated_amount: 200000 }),
      ],
      [{ id: "c1", name: "Venue", budgeted_amount: 100000 }],
      150000,
      new Date("2026-02-01"),
    );
    const kinds = alerts.map((a) => a.kind);
    expect(kinds).toContain("overdue_payment");
    expect(kinds).toContain("over_category_budget");
    expect(kinds).toContain("over_total_budget");
    expect(alerts.every((a) => a.message.length > 0)).toBe(true);
  });
});
