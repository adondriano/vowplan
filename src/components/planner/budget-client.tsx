"use client";
import { useMemo, useState, useTransition } from "react";
import {
  Plus, Trash2, Pencil, Wallet, PiggyBank, AlarmClock, TrendingUp, AlertTriangle,
  Download, Loader2, CalendarClock, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { computeBudgetTotals, computeCategorySpending, computeBudgetAlerts } from "@/lib/domain/budget";
import { createCategory, updateCategory, deleteCategory, createExpense, updateExpense, deleteExpense, createPayment, updatePayment, deletePayment } from "@/lib/actions/budget";
import { formatMoney, formatDate } from "@/lib/domain/format";
import type { BudgetCategory, Expense, ExpensePayment, Vendor } from "@/lib/domain/types";

const CHART_COLORS = ["#9D2C4E", "#A16207", "#1B7A43", "#1D5F8A", "#7C3AED", "#C2313E", "#B45309", "#4D7C0F", "#0E7490", "#9333EA", "#BE185D", "#57534E"];

export function BudgetClient({
  weddingId,
  currency,
  totalBudget,
  contingencyPct,
  categories,
  expenses,
  vendors,
  initialFilter,
}: {
  weddingId: string;
  currency: string;
  totalBudget: number | null;
  contingencyPct: number;
  categories: BudgetCategory[];
  expenses: (Expense & { payments: ExpensePayment[] })[];
  vendors: Pick<Vendor, "id" | "name">[];
  initialFilter: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"expenses" | "categories" | "payments">(initialFilter === "overdue" ? "payments" : "expenses");
  const [editingExpense, setEditingExpense] = useState<(Expense & { payments: ExpensePayment[] }) | null>(null);
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const totals = useMemo(() => computeBudgetTotals(expenses, totalBudget, contingencyPct), [expenses, totalBudget, contingencyPct]);
  const categorySpend = useMemo(() => computeCategorySpending(categories, expenses), [categories, expenses]);
  const alerts = useMemo(() => computeBudgetAlerts(expenses, categories, totalBudget), [expenses, categories, totalBudget]);

  const today = new Date().toISOString().slice(0, 10);
  const allPayments = useMemo(
    () =>
      expenses
        .flatMap((e) => e.payments.map((p) => ({ ...p, expenseTitle: e.title })))
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
    [expenses],
  );
  const overduePayments = allPayments.filter((p) => p.status === "scheduled" && p.due_date && p.due_date < today);
  const dueSoon = allPayments.filter((p) => p.status === "scheduled" && p.due_date && p.due_date >= today && p.due_date <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));

  const pieData = categorySpend.filter((c) => c.contracted > 0).map((c) => ({ name: c.name, value: c.contracted }));

  function exportCsv() {
    const header = ["title", "category", "vendor", "estimated", "quoted", "contracted", "actual", "paid", "remaining", "payment_status", "currency", "conversion_rate", "due_date"];
    const vendorName = (id: string | null) => vendors.find((v) => v.id === id)?.name ?? "";
    const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";
    const lines = [header.join(",")];
    for (const e of expenses) {
      const paid = e.payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
      const committed = Number(e.contracted_amount ?? e.quoted_amount ?? e.estimated_amount);
      lines.push(
        [e.title, catName(e.category_id), vendorName(e.vendor_id), e.estimated_amount, e.quoted_amount ?? "", e.contracted_amount ?? "", e.actual_amount ?? "", paid, Math.max(committed - paid, 0), e.payment_status, e.currency, e.conversion_rate, e.due_date ?? ""].join(","),
      );
    }
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `budget-${weddingId.slice(0, 8)}.csv`;
    a.click();
  }

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Budget &amp; Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalBudget ? `Total ${formatMoney(totalBudget, currency)}` : "Set a total budget in Settings"} · contingency {contingencyPct}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="size-4" aria-hidden="true" /> CSV</Button>
          <Button variant="outline" onClick={() => setCreatingCategory(true)}><Plus className="size-4" aria-hidden="true" /> Category</Button>
          <Button onClick={() => setCreatingExpense(true)}><Plus className="size-4" aria-hidden="true" /> Expense</Button>
        </div>
      </header>

      {/* Summary */}
      <section aria-label="Budget summary" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCardSmall
          icon={<PiggyBank />}
          label="Remaining budget"
          value={formatMoney(totals.remainingBudget, currency)}
          sub={totalBudget ? `${totals.spentPct}% of budget paid` : "No total budget set"}
          tone={totalBudget != null && totals.remainingBudget < 0 ? "destructive" : "primary"}
        />
        <StatCardSmall
          icon={<Wallet />}
          label="Committed (contracts)"
          value={formatMoney(totals.contractedTotal, currency)}
          sub={`Estimates ${formatMoney(totals.estimatedTotal, currency)}`}
        />
        <StatCardSmall
          icon={<TrendingUp />}
          label="Paid so far"
          value={formatMoney(totals.paidTotal, currency)}
          sub={`${formatMoney(totals.unpaidBalances, currency)} unpaid balances`}
        />
        <StatCardSmall
          icon={<AlarmClock />}
          label="Overdue payments"
          value={formatMoney(totals.overdueAmount, currency)}
          sub={`${overduePayments.length} scheduled payment${overduePayments.length === 1 ? "" : "s"} past due`}
          tone={overduePayments.length > 0 ? "destructive" : "success"}
        />
      </section>

      {alerts.length > 0 && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="size-4" aria-hidden="true" /> Budget alerts ({alerts.length})
          </p>
          <ul className="mt-2 space-y-1">
            {alerts.slice(0, 6).map((a, i) => (
              <li key={i} className="text-sm text-foreground-secondary">
                <Badge tone={a.severity === "critical" ? "destructive" : a.severity === "warning" ? "warning" : "neutral"} className="mr-2">{a.kind.replace(/_/g, " ")}</Badge>
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="!pb-0"><CardTitle>Category spending (contracted)</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Add expenses to see the breakdown.</p>
            ) : (
              <div className="h-64" role="img" aria-label="Category spending breakdown">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="!pb-0"><CardTitle>Budgeted vs actual by category</CardTitle></CardHeader>
          <CardContent>
            {categorySpend.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Set category budgets to compare.</p>
            ) : (
              <div className="h-64" role="img" aria-label="Budgeted versus actual by category">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categorySpend.filter((c) => c.budgeted > 0 || c.contracted > 0).slice(0, 8)}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="budgeted" name="Budgeted" fill="#D5C8BF" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="contracted" name="Contracted" fill="#9D2C4E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Forecast note */}
      <p className="mt-3 text-xs text-muted-foreground">
        Forecast final spending: <strong>{formatMoney(totals.forecast, currency)}</strong> (estimate — contracted amounts where recorded, otherwise estimates).
        Contingency allowance: {formatMoney(totals.contingencyAmount, currency)}.
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as never)} className="mt-5">
        <TabsList aria-label="Budget views">
          <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
          <TabsTrigger value="payments">Payment calendar</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "expenses" && (
        <div className="mt-4 space-y-2">
          {expenses.length === 0 ? (
            <EmptyState icon={<Wallet />} title="No expenses yet" description="Track quotes, contracts, and payments here." action={<Button onClick={() => setCreatingExpense(true)}>Add first expense</Button>} />
          ) : (
            expenses.map((e) => {
              const paid = e.payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
              const committed = Number(e.contracted_amount ?? e.quoted_amount ?? e.estimated_amount);
              const rate = Number(e.conversion_rate) || 1;
              const show = initialFilter !== "overdue" || e.payments.some((p) => p.status === "scheduled" && p.due_date && p.due_date < today);
              if (!show) return null;
              return (
                <div key={e.id} className="card">
                  <button
                    type="button"
                    onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
                    aria-expanded={expanded.has(e.id)}
                  >
                    {expanded.has(e.id) ? <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {categories.find((c) => c.id === e.category_id)?.name ?? "No category"}
                        {e.vendor_id && ` · ${vendors.find((v) => v.id === e.vendor_id)?.name ?? "vendor"}`}
                        {e.currency !== currency && ` · ${e.currency} @ ${rate}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatMoney(committed * rate, currency)}</p>
                      <Badge tone={e.payment_status === "paid" ? "success" : e.payment_status === "partial" ? "warning" : "neutral"}>{e.payment_status}</Badge>
                    </div>
                  </button>
                  {expanded.has(e.id) && (
                    <div className="border-t border-border px-4 py-3">
                      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                        <span>Estimate: <strong className="text-foreground">{formatMoney(Number(e.estimated_amount) * rate, currency)}</strong></span>
                        <span>Quoted: <strong className="text-foreground">{e.quoted_amount != null ? formatMoney(Number(e.quoted_amount) * rate, currency) : "—"}</strong></span>
                        <span>Contracted: <strong className="text-foreground">{e.contracted_amount != null ? formatMoney(Number(e.contracted_amount) * rate, currency) : "—"}</strong></span>
                        <span>Paid: <strong className="text-foreground">{formatMoney(paid * rate, currency)}</strong> · Balance: <strong className="text-foreground">{formatMoney(Math.max(committed - paid, 0) * rate, currency)}</strong></span>
                      </div>
                      {e.payments.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {e.payments.map((p) => {
                            const isOverdue = p.status === "scheduled" && p.due_date && p.due_date < today;
                            return (
                              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-warm/60 px-3 py-2 text-sm">
                                <span>
                                  {p.label}
                                  {p.due_date && <span className="text-xs text-muted-foreground"> · due {formatDate(p.due_date, "MMM d")}</span>}
                                </span>
                                <span className="flex items-center gap-2">
                                  <strong>{formatMoney(Number(p.amount) * rate, currency)}</strong>
                                  <Badge tone={p.status === "paid" ? "success" : isOverdue ? "destructive" : "neutral"}>{isOverdue ? "overdue" : p.status}</Badge>
                                  {p.status === "scheduled" && (
                                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
                                      await updatePayment(weddingId, p.id, { status: "paid" });
                                      toast("success", "Payment recorded.");
                                    })}>
                                      Mark paid
                                    </Button>
                                  )}
                                  <Button size="icon-sm" variant="ghost" aria-label="Delete payment" onClick={() => { if (confirm(`Delete payment "${p.label}"?`)) startTransition(async () => { await deletePayment(weddingId, p.id); toast("success", "Payment deleted."); }); }}>
                                    <Trash2 aria-hidden="true" />
                                  </Button>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditingExpense(e)}><Pencil className="size-3.5" aria-hidden="true" /> Edit expense</Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const label = prompt("Payment label (e.g. Deposit, Balance):", "Payment");
                          if (!label) return;
                          const amount = prompt("Amount:", "0");
                          if (!amount) return;
                          const due = prompt("Due date (YYYY-MM-DD, optional):", "") || null;
                          startTransition(async () => {
                            const r = await createPayment(weddingId, e.id, { label, amount: Number(amount), due_date: due });
                            if ("error" in r && r.error) toast("error", r.error);
                            else toast("success", "Payment scheduled.");
                          });
                        }}><Plus className="size-3.5" aria-hidden="true" /> Add payment</Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete expense "${e.title}" and its payments?`)) startTransition(async () => { await deleteExpense(weddingId, e.id); toast("success", "Expense deleted."); }); }}>
                          <Trash2 className="size-3.5" aria-hidden="true" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "payments" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="!pb-2"><CardTitle className="text-destructive">Overdue</CardTitle></CardHeader>
            <CardContent>
              {overduePayments.length === 0 ? <p className="text-sm text-success">Nothing overdue.</p> : (
                <ul className="space-y-2">{overduePayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive-soft/50 px-3 py-2 text-sm">
                    <span>{p.expenseTitle} · {p.label}<span className="block text-xs text-muted-foreground">was due {formatDate(p.due_date, "MMM d")}</span></span>
                    <span className="font-semibold">{formatMoney(Number(p.amount), currency)}</span>
                  </li>
                ))}</ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="!pb-2"><CardTitle>Due in the next 14 days</CardTitle></CardHeader>
            <CardContent>
              {dueSoon.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due soon.</p> : (
                <ul className="space-y-2">{dueSoon.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>{p.expenseTitle} · {p.label}<span className="block text-xs text-muted-foreground">due {formatDate(p.due_date, "MMM d")}</span></span>
                    <span className="font-semibold">{formatMoney(Number(p.amount), currency)}</span>
                  </li>
                ))}</ul>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="!pb-2"><CardTitle>Full payment schedule</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {allPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm odd:bg-surface-warm/40">
                    <span className="flex items-center gap-2">
                      <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {p.due_date ? formatDate(p.due_date, "MMM d, yyyy") : "No date"} — {p.expenseTitle} · {p.label}
                    </span>
                    <span className="flex items-center gap-2">
                      {formatMoney(Number(p.amount), currency)}
                      <Badge tone={p.status === "paid" ? "success" : p.due_date && p.due_date < today ? "destructive" : "neutral"}>{p.status === "paid" ? "paid" : p.due_date && p.due_date < today ? "overdue" : "scheduled"}</Badge>
                    </span>
                  </li>
                ))}
                {allPayments.length === 0 && <p className="text-sm text-muted-foreground">No payments scheduled yet — open an expense to add its deposit and balance.</p>}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "categories" && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {categorySpend.map((c) => (
            <div key={c.categoryId ?? "unallocated"} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{c.name}</p>
                {c.categoryId && (
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditingCategory(categories.find((x) => x.id === c.categoryId) ?? null)}><Pencil aria-hidden="true" /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.name}`} className="hover:text-destructive" onClick={() => { if (confirm(`Delete category "${c.name}"? Expenses stay but become uncategorized.`)) startTransition(async () => { await deleteCategory(weddingId, c.categoryId!); }); }}><Trash2 aria-hidden="true" /></Button>
                  </div>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Budget {formatMoney(c.budgeted, currency)} · contracted {formatMoney(c.contracted, currency)} · paid {formatMoney(c.paid, currency)}
              </p>
              {c.budgeted > 0 && (
                <Progress value={(c.contracted / c.budgeted) * 100} tone={c.overBudget ? "destructive" : "primary"} label={`${c.name} budget usage`} className="mt-2" />
              )}
              {c.overBudget && <Badge tone="destructive" className="mt-2">over budget</Badge>}
            </div>
          ))}
          {categorySpend.length === 0 && <EmptyState icon={<Wallet />} title="No categories" description="Categories are created during onboarding — add your own here." />}
        </div>
      )}

      <ExpenseDialog open={creatingExpense || editingExpense != null} expense={editingExpense} categories={categories} vendors={vendors} weddingId={weddingId} currency={currency} onClose={() => { setCreatingExpense(false); setEditingExpense(null); }} />
      <CategoryDialog open={creatingCategory || editingCategory != null} category={editingCategory} weddingId={weddingId} onClose={() => { setCreatingCategory(false); setEditingCategory(null); }} />
    </div>
  );
}

function StatCardSmall({ icon, label, value, sub, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "neutral" | "primary" | "destructive" | "success" }) {
  const ring = { neutral: "", primary: "border-primary/25", destructive: "border-destructive/30", success: "border-success/25" }[tone];
  return (
    <div className={`card flex items-start gap-3 p-4 ${ring}`}>
      <div className="mt-0.5 rounded-lg bg-primary-soft p-2 text-primary [&_svg]:size-4" aria-hidden="true">{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-display text-xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function ExpenseDialog({
  open, expense, categories, vendors, weddingId, currency, onClose,
}: {
  open: boolean;
  expense: (Expense & { payments: ExpensePayment[] }) | null;
  categories: BudgetCategory[];
  vendors: Pick<Vendor, "id" | "name">[];
  weddingId: string;
  currency: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setBusy(true);
    const fd = new FormData(ev.currentTarget);
    const num = (k: string) => (fd.get(k) === "" || fd.get(k) == null ? null : Number(fd.get(k)));
    const input = {
      title: String(fd.get("title") ?? ""),
      category_id: String(fd.get("category_id") ?? "") || null,
      vendor_id: String(fd.get("vendor_id") ?? "") || null,
      estimated_amount: Number(fd.get("estimated_amount") ?? 0),
      quoted_amount: num("quoted_amount"),
      contracted_amount: num("contracted_amount"),
      actual_amount: num("actual_amount"),
      currency: String(fd.get("currency") ?? currency),
      conversion_rate: Number(fd.get("conversion_rate") ?? 1) || 1,
      due_date: String(fd.get("due_date") ?? "") || null,
      notes: String(fd.get("notes") ?? "") || null,
    };
    const r = expense ? await updateExpense(weddingId, expense.id, input) : await createExpense(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    toast("success", expense ? "Expense updated." : "Expense added.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader title={expense ? "Edit expense" : "New expense"} description="Clearly separate the estimate, quote, contract, and actual amount." />
        <form onSubmit={onSubmit} className="space-y-4" key={expense?.id ?? "new"}>
          <div>
            <Label htmlFor="ex-title" required>Title</Label>
            <Input id="ex-title" name="title" required defaultValue={expense?.title} className="mt-1.5" placeholder="Catering — 150 pax" autoFocus />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ex-cat">Category</Label>
              <Select name="category_id" defaultValue={expense?.category_id ?? ""}>
                <SelectTrigger id="ex-cat" className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No category</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ex-vendor" hint="optional">Vendor</Label>
              <Select name="vendor_id" defaultValue={expense?.vendor_id ?? ""}>
                <SelectTrigger id="ex-vendor" className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No vendor</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ex-est" required>Estimated amount</Label>
              <Input id="ex-est" name="estimated_amount" type="number" min="0" step="0.01" required defaultValue={expense?.estimated_amount ?? ""} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="ex-quoted" hint="optional">Quoted amount</Label>
              <Input id="ex-quoted" name="quoted_amount" type="number" min="0" step="0.01" defaultValue={expense?.quoted_amount ?? ""} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="ex-contract" hint="optional">Contracted amount</Label>
              <Input id="ex-contract" name="contracted_amount" type="number" min="0" step="0.01" defaultValue={expense?.contracted_amount ?? ""} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="ex-actual" hint="optional">Actual final amount</Label>
              <Input id="ex-actual" name="actual_amount" type="number" min="0" step="0.01" defaultValue={expense?.actual_amount ?? ""} className="mt-1.5" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="ex-cur">Currency</Label>
              <Input id="ex-cur" name="currency" defaultValue={expense?.currency ?? currency} className="mt-1.5" maxLength={3} />
            </div>
            <div>
              <Label htmlFor="ex-rate" hint={`to ${currency}`}>Conversion rate</Label>
              <Input id="ex-rate" name="conversion_rate" type="number" min="0.000001" step="0.000001" defaultValue={expense?.conversion_rate ?? 1} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="ex-due" hint="optional">Due date</Label>
              <Input id="ex-due" name="due_date" type="date" defaultValue={expense?.due_date ?? ""} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="ex-notes" hint="optional">Notes / payment reference</Label>
            <Input id="ex-notes" name="notes" defaultValue={expense?.notes ?? ""} className="mt-1.5" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {expense ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open, category, weddingId, onClose,
}: {
  open: boolean;
  category: BudgetCategory | null;
  weddingId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = { name: String(fd.get("name") ?? ""), budgeted_amount: Number(fd.get("budgeted_amount") ?? 0) };
    const r = category ? await updateCategory(weddingId, category.id, input) : await createCategory(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    toast("success", category ? "Category updated." : "Category added.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader title={category ? "Edit category" : "New budget category"} />
        <form onSubmit={onSubmit} className="space-y-4" key={category?.id ?? "new"}>
          <div>
            <Label htmlFor="cat-name" required>Name</Label>
            <Input id="cat-name" name="name" required defaultValue={category?.name} className="mt-1.5" autoFocus />
          </div>
          <div>
            <Label htmlFor="cat-amount">Budgeted amount</Label>
            <Input id="cat-amount" name="budgeted_amount" type="number" min="0" step="0.01" defaultValue={category?.budgeted_amount ?? 0} className="mt-1.5" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
