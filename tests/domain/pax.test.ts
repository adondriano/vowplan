import { describe, it, expect } from "vitest";
import { computePaxTotals } from "@/lib/domain/pax";
import type { Invitation } from "@/lib/domain/types";
import type { ExpenseWithPayments } from "@/lib/domain/budget";
import { computeExpense, computeBudgetTotals, computeCategorySpending, computeBudgetAlerts } from "@/lib/domain/budget";
import { generateInvitationToken, hashToken, encryptToken, decryptToken } from "@/lib/domain/tokens";
import { toCsv, parseCsv } from "@/lib/domain/csv";
import { buildArchiveZip, parseArchiveZip, ARCHIVE_SCHEMA_VERSION } from "@/lib/domain/archive";
import { dueDateFromTemplate, DEFAULT_TASK_TEMPLATES } from "@/lib/domain/task-templates";
import { parseInvitationContent, parseInvitationTheme } from "@/lib/domain/invitation";

const g = (id: string, invited: number) => ({ id, invited_pax: invited });
const inv = (id: string, groupId: string, maxPax: number, status = "ready") => ({
  id,
  group_id: groupId,
  max_pax: maxPax,
  status: status as Invitation["status"],
});

describe("PAX totals", () => {
  it("distinguishes groups from invited/confirmed/pending PAX", () => {
    const groups = [g("a", 4), g("b", 2), g("c", 5)];
    const invitations = [inv("i1", "a", 4), inv("i2", "b", 2), inv("i3", "c", 5)];
    const responses = [
      { invitation_id: "i1", status: "confirmed" as const, attending_count: 4 },
      { invitation_id: "i2", status: "declined" as const, attending_count: 0 },
    ];
    const t = computePaxTotals(groups, invitations, responses);
    expect(t.groups).toBe(3);
    expect(t.invitedPax).toBe(11);
    expect(t.confirmedPax).toBe(4);
    expect(t.declinedGroups).toBe(1);
    expect(t.pendingPax).toBe(5);
    expect(t.responseRate).toBe(67); // 2 of 3 responded
    expect(t.confirmedGroups).toBe(1);
    expect(t.pendingGroups).toBe(1);
  });

  it("excludes cancelled invitations from the response rate", () => {
    const t = computePaxTotals(
      [g("a", 2)],
      [inv("i1", "a", 2, "cancelled")],
      [],
    );
    expect(t.responseRate).toBe(0);
    expect(t.pendingGroups).toBe(0);
  });

  it("falls back to group invited_pax when no invitations exist", () => {
    const t = computePaxTotals([g("a", 3), g("b", 2)], [], []);
    expect(t.invitedPax).toBe(5);
  });
});

const expense = (over: Partial<any> = {}, payments: any[] = []): ExpenseWithPayments => ({
  id: "e1",
  wedding_id: "w",
  title: "Catering",
  category_id: null,
  vendor_id: null,
  estimated_amount: 100000,
  quoted_amount: null,
  contracted_amount: null,
  actual_amount: null,
  payment_status: "unpaid",
  currency: "PHP",
  conversion_rate: 1,
  due_date: null,
  task_id: null,
  notes: null,
  created_at: "",
  ...over,
  payments,
});

describe("budget calculations", () => {
  it("computes paid, committed and remaining from payment schedules", () => {
    const c = computeExpense(
      expense(
        { contracted_amount: 120000 },
        [
          { id: "p1", expense_id: "e1", label: "Deposit", amount: 50000, due_date: "2026-01-01", status: "paid", paid_at: "2026-01-01" },
          { id: "p2", expense_id: "e1", label: "Balance", amount: 70000, due_date: "2026-04-01", status: "scheduled" },
        ],
      ),
    );
    expect(c.paid).toBe(50000);
    expect(c.committed).toBe(120000);
    expect(c.remainingBalance).toBe(70000);
    expect(c.overduePayments).toHaveLength(1); // 2026-01-01 < today
    expect(c.dueSoonPayments).toHaveLength(0);
  });

  it("flags schedules that exceed the contracted amount", () => {
    const c = computeExpense(
      expense(
        { contracted_amount: 100000 },
        [
          { id: "p1", expense_id: "e1", label: "A", amount: 60000, status: "paid" },
          { id: "p2", expense_id: "e1", label: "B", amount: 60000, status: "scheduled" },
        ],
      ),
    );
    expect(c.paymentsExceedContract).toBe(true);
  });

  it("handles multi-currency conversion", () => {
    const c = computeExpense(expense({ estimated_amount: 1000, currency: "USD", conversion_rate: 58.5 }));
    expect(c.committed).toBe(58500);
  });

  it("totals budget vs contracted vs paid", () => {
    const t = computeBudgetTotals(
      [
        expense({ estimated_amount: 50000, contracted_amount: 60000 }, [
          { id: "p1", expense_id: "e1", label: "Dep", amount: 20000, status: "paid" },
        ]),
        expense({ estimated_amount: 30000 }),
      ],
      200000,
      10,
    );
    expect(t.estimatedTotal).toBe(80000);
    expect(t.contractedTotal).toBe(90000);
    expect(t.paidTotal).toBe(20000);
    expect(t.remainingBudget).toBe(180000);
    expect(t.unpaidBalances).toBe(70000);
    expect(t.contingencyAmount).toBe(20000);
    expect(t.forecast).toBe(90000);
    expect(t.forecastIsEstimate).toBe(true);
  });

  it("category spending flags over-budget categories", () => {
    const cats = [{ id: "c1", name: "Venue", budgeted_amount: 50000 }];
    const spend = computeCategorySpending(cats, [
      expense({ category_id: "c1", estimated_amount: 80000 }),
      expense({ estimated_amount: 5000 }),
    ]);
    expect(spend.find((s) => s.name === "Venue")!.overBudget).toBe(true);
    expect(spend.find((s) => s.name === "Unallocated")!.estimated).toBe(5000);
  });

  it("generates alerts from real data", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const alerts = computeBudgetAlerts(
      [
        expense(
          { title: "Photographer", category_id: "c1", contracted_amount: 80000 },
          [{ id: "p1", expense_id: "e1", label: "Deposit", amount: 20000, due_date: yesterday, status: "scheduled" }],
        ),
        expense({ title: "Misc", category_id: null, estimated_amount: 999999 }),
      ],
      [{ id: "c1", name: "Photo", budgeted_amount: 10000 }],
      100000,
    );
    const kinds = alerts.map((a) => a.kind);
    expect(kinds).toContain("overdue_payment");
    expect(kinds).toContain("over_category_budget");
    expect(kinds).toContain("uncategorized_expense");
    expect(kinds).toContain("over_total_budget");
  });
});

describe("invitation tokens", () => {
  it("generates unguessable 192-bit tokens", () => {
    const t1 = generateInvitationToken();
    const t2 = generateInvitationToken();
    expect(t1).toMatch(/^vp_[A-Za-z0-9_-]{32}$/);
    expect(t1).not.toBe(t2);
  });

  it("hashes consistently for lookup", () => {
    const t = generateInvitationToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken(t)).not.toContain(t);
  });

  it("encrypts and decrypts round-trip (planner re-display)", () => {
    const t = generateInvitationToken();
    const ct = encryptToken(t);
    expect(ct).not.toContain(t);
    expect(decryptToken(ct)).toBe(t);
    // tampered ciphertext fails
    const parts = ct.split(".");
    parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith("A") ? "B" : "A");
    expect(decryptToken(parts.join("."))).toBeNull();
  });
});

describe("csv", () => {
  it("round-trips quoted fields", () => {
    const csv = toCsv(["name", "notes"], [["Ana", 'Said "hi", twice'], ["Ben, Jr", "line\nbreak"]]);
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1][1]).toBe('Said "hi", twice');
    expect(rows[2][0]).toBe("Ben, Jr");
    expect(rows[2][1]).toBe("line\nbreak");
  });
});

describe("archive", () => {
  it("builds a ZIP with manifest and reopens with integrity checks", async () => {
    const data = {
      wedding: { id: "w1", bride_name: "Maria" },
      members: [],
      tasks: [{ id: "t1" }],
      events: [],
      guestGroups: [{ id: "gg1" }],
      guests: [],
      invitations: [{ id: "i1", group_id: "gg1" }],
      rsvps: [{ id: "r1", invitation_id: "i1" }],
      rsvpAttendees: [],
      rsvpHistory: [],
      budgetCategories: [],
      vendors: [],
      expenses: [],
      expensePayments: [],
      venues: [],
      seatingTables: [],
      tableAssignments: [],
      weddingParty: [],
      documents: [],
      mediaAssets: [],
      decisions: [],
      invitationVersions: [],
      auditEvents: [],
    };
    const zip = await buildArchiveZip(data as any, { weddingName: "Maria & Juan" });
    expect(zip.length).toBeGreaterThan(500);

    const parsed = await parseArchiveZip(new Uint8Array(zip));
    expect(parsed.manifest.schemaVersion).toBeLessThanOrEqual(ARCHIVE_SCHEMA_VERSION);
    expect(parsed.manifest.counts.tasks).toBe(1);
    expect(parsed.data.rsvps).toHaveLength(1);
  });

  it("rejects archives with broken references", async () => {
    const data: any = {
      wedding: {},
      guestGroups: [],
      invitations: [{ id: "i1", group_id: "missing" }],
      rsvps: [],
    };
    const zip = await buildArchiveZip(data, { weddingName: "x" });
    await expect(parseArchiveZip(new Uint8Array(zip))).rejects.toThrow(/orphan invitations/);
  });

  it("rejects future schema versions", async () => {
    const data: any = { wedding: {}, guestGroups: [], invitations: [], rsvps: [] };
    const zip = await buildArchiveZip(data, { weddingName: "x" });
    const JSZipLib = (await import("jszip")).default;
    const loaded = await JSZipLib.loadAsync(new Uint8Array(zip));
    loaded.file("manifest.json", JSON.stringify({ app: "VowPlan", schemaVersion: 999, exportedAt: "", counts: {} }));
    const out = await loaded.generateAsync({ type: "nodebuffer" });
    await expect(parseArchiveZip(new Uint8Array(out))).rejects.toThrow(/newer than this app/);
  });
});

describe("task templates", () => {
  it("maps relative days to due dates before the wedding", () => {
    const t = DEFAULT_TASK_TEMPLATES[0];
    expect(dueDateFromTemplate(t, "2027-06-15")).toBe("2026-06-15");
  });
  it("returns null without a wedding date", () => {
    expect(dueDateFromTemplate(DEFAULT_TASK_TEMPLATES[0], null)).toBeNull();
  });
  it("supports after-wedding tasks", () => {
    const thankyou = DEFAULT_TASK_TEMPLATES.find((t) => t.category === "thankyou")!;
    expect(dueDateFromTemplate(thankyou, "2027-06-15")).toBe("2027-06-29");
  });
});

describe("invitation content validation", () => {
  it("parses with defaults and strips unknowns", () => {
    const c = parseInvitationContent({ coverKicker: "Hello", hacked: "<script>alert(1)</script>" });
    expect(c.coverKicker).toBe("Hello");
    expect(c.sections.length).toBeGreaterThan(10);
    expect((c as any).hacked).toBeUndefined();
  });

  it("rejects invalid map URLs", () => {
    const c = parseInvitationContent({ mapUrl: "not a url" });
    expect(c.mapUrl).toBe("");
  });

  it("theme falls back to romantic-floral defaults", () => {
    const t = parseInvitationTheme(null);
    expect(t.template).toBe("romantic-floral");
    expect(t.palette.bg).toBe("#FDF4F1");
  });
});
