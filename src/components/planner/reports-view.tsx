"use client";

import { Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { computePaxTotals } from "@/lib/domain/pax";
import { computeBudgetTotals } from "@/lib/domain/budget";
import { formatDate, formatMoney } from "@/lib/domain/format";
import type { Wedding } from "@/lib/domain/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- report rows are raw DB projections
type Row = Record<string, any>;

/** Printable reports driven by real records: guest, RSVP follow-up, budget, task. */
export function ReportsView({
  wedding,
  data,
}: {
  wedding: Wedding;
  data: {
    groups: Row[];
    invitations: Row[];
    guests: Row[];
    responses: Row[];
    tasks: Row[];
    expenses: Row[];
    payments: Row[];
    vendors: Row[];
    events: Row[];
  };
}) {
  const cur = wedding.currency;
  const pax = computePaxTotals(
    data.groups as unknown as Parameters<typeof computePaxTotals>[0],
    data.invitations as unknown as Parameters<typeof computePaxTotals>[1],
    data.responses as unknown as Parameters<typeof computePaxTotals>[2],
  );
  const budget = computeBudgetTotals(
    data.expenses.map((e) => ({ ...e, payments: data.payments.filter((p) => p.expense_id === e.id) })) as unknown as Parameters<typeof computeBudgetTotals>[0],
    wedding.total_budget,
    wedding.contingency_pct,
  );

  const doneTasks = data.tasks.filter((t) => t.status === "done");
  const overdueTasks = data.tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < new Date().toISOString().slice(0, 10));
  const upcomingTasks = data.tasks
    .filter((t) => t.status !== "done" && t.due_date && t.due_date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 10);

  const today = new Date().toISOString().slice(0, 10);
  const invitationByGroup = new Map(data.invitations.map((i) => [i.group_id, i]));
  const responseByInv = new Map(data.responses.map((r) => [r.invitation_id, r]));
  const pendingGroups = data.groups
    .map((g) => ({ group: g, inv: invitationByGroup.get(g.id) }))
    .filter(({ inv }) => inv && !responseByInv.has(inv.id) && inv.status !== "cancelled");

  const categoryTotals = new Map<string, { est: number; con: number; paid: number }>();
  for (const e of data.expenses) {
    const key = (e.category_id as string | null) ?? "none";
    const bucket = categoryTotals.get(key) ?? { est: 0, con: 0, paid: 0 };
    const rate = Number(e.conversion_rate) || 1;
    bucket.est += Number(e.estimated_amount) * rate;
    bucket.con += Number(e.contracted_amount ?? e.quoted_amount ?? e.estimated_amount) * rate;
    bucket.paid += data.payments.filter((p) => p.expense_id === e.id && p.status === "paid").reduce((s, p) => s + Number(p.amount), 0) * rate;
    categoryTotals.set(key, bucket);
  }

  const byCategory = data.tasks.reduce<Record<string, { done: number; total: number }>>((acc, t) => {
    acc[t.category] = acc[t.category] ?? { done: 0, total: 0 };
    acc[t.category].total += 1;
    if (t.status === "done") acc[t.category].done += 1;
    return acc;
  }, {});
  const byAssignee = data.tasks.reduce<Record<string, { done: number; total: number }>>((acc, t) => {
    const key = t.assignee ?? "Unassigned";
    acc[key] = acc[key] ?? { done: 0, total: 0 };
    acc[key].total += 1;
    if (t.status === "done") acc[key].done += 1;
    return acc;
  }, {});

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-3xl font-semibold">Reports &amp; Exports</h1>
          <p className="mt-1 text-sm text-muted-foreground">All figures come from your real records — print or export any section.</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" aria-hidden="true" /> Print reports</Button>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Guest report */}
        <Card>
          <CardHeader><CardTitle>Guest report</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">Households</dt><dd className="text-right font-semibold">{data.groups.length}</dd>
              <dt className="text-muted-foreground">People listed</dt><dd className="text-right font-semibold">{data.guests.length}</dd>
              <dt className="text-muted-foreground">Invited PAX (max)</dt><dd className="text-right font-semibold">{pax.invitedPax.toLocaleString()}</dd>
              <dt className="text-muted-foreground">Confirmed PAX</dt><dd className="text-right font-semibold text-success">{pax.confirmedPax.toLocaleString()}</dd>
              <dt className="text-muted-foreground">Declined households</dt><dd className="text-right font-semibold">{pax.declinedGroups}</dd>
              <dt className="text-muted-foreground">Pending PAX</dt><dd className="text-right font-semibold text-warning">{pax.pendingPax.toLocaleString()}</dd>
              <dt className="text-muted-foreground">Response rate</dt><dd className="text-right font-semibold">{pax.responseRate}%</dd>
            </dl>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By category</p>
              <ul className="space-y-1">
                {Object.entries(data.groups.reduce<Record<string, number>>((acc, g) => {
                  acc[g.category] = (acc[g.category] ?? 0) + 1;
                  return acc;
                }, {})).map(([cat, n]) => (
                  <li key={cat} className="flex justify-between"><span>{cat}</span><span className="font-medium">{n}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By side</p>
              <ul className="space-y-1">
                {(["bride", "groom", "both", "custom"] as const).map((side) => {
                  const n = data.groups.filter((g) => g.side === side).length;
                  return n > 0 ? <li key={side} className="flex justify-between"><span className="capitalize">{side}&apos;s side{side === "both" ? " / mutual" : ""}</span><span className="font-medium">{n}</span></li> : null;
                })}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* RSVP follow-up report */}
        <Card>
          <CardHeader><CardTitle>RSVP follow-up</CardTitle></CardHeader>
          <CardContent>
            {pendingGroups.length === 0 ? (
              <p className="text-sm text-success">Everyone invited through a link has responded. 🎉</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {pendingGroups.slice(0, 12).map(({ group, inv }) => {
                  const contacted = inv?.last_contacted_at ? formatDate(inv.last_contacted_at, "MMM d") : null;
                  return (
                    <li key={group.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{group.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {inv?.max_pax} pax{contacted ? ` · contacted ${contacted}` : " · not contacted yet"}
                        </span>
                      </span>
                      <Badge tone={inv?.status === "follow_up" ? "warning" : "neutral"}>{inv?.status === "follow_up" ? "follow up" : "pending"}</Badge>
                    </li>
                  );
                })}
                {pendingGroups.length > 12 && <li className="text-xs text-muted-foreground">+ {pendingGroups.length - 12} more in the RSVP Manager</li>}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Budget report */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Budget report</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">Total budget</dt><dd className="font-semibold">{wedding.total_budget ? formatMoney(wedding.total_budget, cur) : "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Estimated</dt><dd className="font-semibold">{formatMoney(budget.estimatedTotal, cur)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Contracted</dt><dd className="font-semibold">{formatMoney(budget.contractedTotal, cur)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Paid</dt><dd className="font-semibold">{formatMoney(budget.paidTotal, cur)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Remaining budget</dt><dd className={`font-semibold ${budget.remainingBudget < 0 ? "text-destructive" : "text-success"}`}>{formatMoney(budget.remainingBudget, cur)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Unpaid balances</dt><dd className="font-semibold">{formatMoney(budget.unpaidBalances, cur)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Overdue payments</dt><dd className="font-semibold text-destructive">{formatMoney(budget.overdueAmount, cur)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Forecast (estimate)</dt><dd className="font-semibold">{formatMoney(budget.forecast, cur)}</dd></div>
            </dl>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By category</p>
              <ul className="space-y-1">
                {Array.from(categoryTotals.entries()).map(([catId, v]) => (
                  <li key={catId} className="flex items-center justify-between gap-3 rounded-lg odd:bg-surface-warm/40 px-3 py-1.5">
                    <span>{catId === "none" ? <em>Uncategorized</em> : `Category ${catId.slice(0, 8)}…`}</span>
                    <span className="text-xs text-muted-foreground">
                      est {formatMoney(v.est, cur)} · contracted {formatMoney(v.con, cur)} · paid {formatMoney(v.paid, cur)}
                    </span>
                  </li>
                ))}
                {categoryTotals.size === 0 && <li className="text-muted-foreground">No expenses recorded yet.</li>}
              </ul>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming vendor payment schedule</p>
              <ul className="space-y-1">
                {data.payments
                  .filter((p) => p.due_date)
                  .sort((a, b) => a.due_date.localeCompare(b.due_date))
                  .slice(0, 8)
                  .map((p) => {
                    const exp = data.expenses.find((e) => e.id === p.expense_id);
                    const vendor = data.vendors.find((v) => v.id === exp?.vendor_id);
                    const overdue = p.due_date < today;
                    return (
                      <li key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5">
                        <span>
                          {formatDate(p.due_date, "MMM d")} · {exp?.title ?? "Expense"}
                          {vendor ? ` (${vendor.name})` : ""} — {p.label}
                        </span>
                        <span className="flex items-center gap-2">
                          {formatMoney(Number(p.amount), cur)}
                          {overdue && <Badge tone="destructive">overdue</Badge>}
                        </span>
                      </li>
                    );
                  })}
                {data.payments.length === 0 && <li className="text-muted-foreground">No scheduled payments.</li>}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Task report */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Task report</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3 text-sm">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
              <dl className="space-y-1">
                <div className="flex justify-between"><dt>Completed</dt><dd className="font-semibold">{doneTasks.length}/{data.tasks.length}</dd></div>
                <div className="flex justify-between"><dt>Overdue</dt><dd className="font-semibold text-destructive">{overdueTasks.length}</dd></div>
              </dl>
              <Progress value={data.tasks.length ? (doneTasks.length / data.tasks.length) * 100 : 0} label="Completion" className="mt-2" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By category</p>
              <ul className="space-y-1">
                {Object.entries(byCategory).map(([cat, v]) => (
                  <li key={cat} className="flex justify-between"><span>{cat}</span><span className="font-medium">{v.done}/{v.total}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By assignee</p>
              <ul className="space-y-1">
                {Object.entries(byAssignee).map(([who, v]) => (
                  <li key={who} className="flex justify-between"><span>{who}</span><span className="font-medium">{v.done}/{v.total}</span></li>
                ))}
              </ul>
            </div>
            {upcomingTasks.length > 0 && (
              <div className="sm:col-span-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next 10 milestones</p>
                <ul className="space-y-1">
                  {upcomingTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between rounded-lg odd:bg-surface-warm/40 px-3 py-1.5">
                      <span>{t.title}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(t.due_date, "EEE, MMM d")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
