import type { Expense, ExpensePayment } from "./types";

/**
 * Budget math. Distinguishes: budgeted / quoted / contracted / actual / paid /
 * remaining balance. All amounts are in the wedding currency after conversion.
 */

export type ExpenseWithPayments = Expense & { payments?: ExpensePayment[] };

export type ExpenseComputed = {
  expense: ExpenseWithPayments;
  /** Amount already paid across recorded payments. */
  paid: number;
  /** Remaining balance: contracted (or quoted/estimated fallback) minus paid. */
  remainingBalance: number;
  /** Commitment used for totals: contracted ?? quoted ?? estimated. */
  committed: number;
  /** Payments overdue as of `today`. */
  overduePayments: ExpensePayment[];
  /** Payments due within `soonDays`. */
  dueSoonPayments: ExpensePayment[];
  /** Inconsistency: scheduled payments exceed the contracted amount. */
  paymentsExceedContract: boolean;
  /** Converted to the wedding currency. */
  conversionRate: number;
};

export function computeExpense(
  e: ExpenseWithPayments,
  today: Date = new Date(),
  soonDays = 14,
): ExpenseComputed {
  const rate = Number(e.conversion_rate) || 1;
  const payments = e.payments ?? [];
  const paidRaw = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const committedRaw =
    Number(e.contracted_amount ?? e.quoted_amount ?? e.estimated_amount) || 0;

  const overduePayments = payments.filter(
    (p) => p.status === "scheduled" && p.due_date && new Date(p.due_date) < today,
  );
  const soonCutoff = new Date(today);
  soonCutoff.setDate(soonCutoff.getDate() + soonDays);
  const dueSoonPayments = payments.filter(
    (p) =>
      p.status === "scheduled" &&
      p.due_date &&
      new Date(p.due_date) >= today &&
      new Date(p.due_date) <= soonCutoff,
  );

  const scheduledTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const contracted = e.contracted_amount != null ? Number(e.contracted_amount) : null;
  const paymentsExceedContract =
    contracted != null && payments.length > 0 && scheduledTotal > contracted + 0.005;

  return {
    expense: e,
    paid: round2(paidRaw * rate),
    remainingBalance: round2(Math.max(committedRaw - paidRaw, 0) * rate),
    committed: round2(committedRaw * rate),
    overduePayments,
    dueSoonPayments,
    paymentsExceedContract,
    conversionRate: rate,
  };
}

export type BudgetTotals = {
  totalBudget: number;
  contingencyPct: number;
  contingencyAmount: number;
  plannedSum: number; // sum of category budgets
  estimatedTotal: number;
  contractedTotal: number;
  paidTotal: number;
  remainingBudget: number;
  unpaidBalances: number;
  overdueAmount: number;
  dueSoonAmount: number;
  forecast: number; // contracted + unpaid remainder of non-contracted estimates
  forecastIsEstimate: true;
  spentPct: number; // paid / budget
  committedPct: number;
};

export function computeBudgetTotals(
  expenses: ExpenseWithPayments[],
  totalBudget: number | null,
  contingencyPct: number,
  today: Date = new Date(),
  soonDays = 14,
): BudgetTotals {
  const computed = expenses.map((e) => computeExpense(e, today, soonDays));
  const estimatedTotal = round2(
    computed.reduce((s, c) => s + Number(c.expense.estimated_amount) * c.conversionRate, 0),
  );
  const contractedTotal = round2(
    computed.reduce((s, c) => s + c.committed, 0),
  );
  const paidTotal = round2(computed.reduce((s, c) => s + c.paid, 0));
  const unpaidBalances = round2(computed.reduce((s, c) => s + c.remainingBalance, 0));
  const overdueAmount = round2(
    computed.reduce(
      (s, c) => s + c.overduePayments.reduce((ps, p) => ps + Number(p.amount), 0) * c.conversionRate,
      0,
    ),
  );
  const dueSoonAmount = round2(
    computed.reduce(
      (s, c) => s + c.dueSoonPayments.reduce((ps, p) => ps + Number(p.amount), 0) * c.conversionRate,
      0,
    ),
  );

  const budget = Number(totalBudget ?? 0);
  const contingencyAmount = round2((budget * (Number(contingencyPct) || 0)) / 100);

  // Forecast: contracted where contracted, else estimate. Marked as an estimate.
  const forecast = round2(
    computed.reduce((s, c) => {
      const contracted = c.expense.contracted_amount != null;
      return (
        s +
        (contracted
          ? Number(c.expense.contracted_amount) * c.conversionRate
          : Number(c.expense.estimated_amount) * c.conversionRate)
      );
    }, 0),
  );

  return {
    totalBudget: round2(budget),
    contingencyPct: Number(contingencyPct) || 0,
    contingencyAmount,
    plannedSum: 0, // caller sets from categories
    estimatedTotal,
    contractedTotal,
    paidTotal,
    remainingBudget: round2(budget - paidTotal),
    unpaidBalances,
    overdueAmount,
    dueSoonAmount,
    forecast,
    forecastIsEstimate: true,
    spentPct: budget > 0 ? Math.round((paidTotal / budget) * 100) : 0,
    committedPct: budget > 0 ? Math.round((contractedTotal / budget) * 100) : 0,
  };
}

export type CategorySpend = {
  categoryId: string | null;
  name: string;
  budgeted: number;
  estimated: number;
  contracted: number;
  paid: number;
  overBudget: boolean;
};

export function computeCategorySpending(
  categories: { id: string; name: string; budgeted_amount: number }[],
  expenses: ExpenseWithPayments[],
  unallocatedLabel = "Unallocated",
): CategorySpend[] {
  const map = new Map<string, CategorySpend>();
  for (const c of categories) {
    map.set(c.id, {
      categoryId: c.id,
      name: c.name,
      budgeted: Number(c.budgeted_amount),
      estimated: 0,
      contracted: 0,
      paid: 0,
      overBudget: false,
    });
  }
  const uncategorized: CategorySpend = {
    categoryId: null,
    name: unallocatedLabel,
    budgeted: 0,
    estimated: 0,
    contracted: 0,
    paid: 0,
    overBudget: false,
  };

  for (const e of expenses) {
    const rate = Number(e.conversion_rate) || 1;
    const bucket = e.category_id ? (map.get(e.category_id) ?? uncategorized) : uncategorized;
    bucket.estimated += Number(e.estimated_amount) * rate;
    bucket.contracted +=
      Number(e.contracted_amount ?? e.quoted_amount ?? e.estimated_amount) * rate;
    bucket.paid +=
      (e.payments ?? [])
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + Number(p.amount), 0) * rate;
  }

  const list = [...map.values(), ...(uncategorized.estimated > 0 ? [uncategorized] : [])];
  for (const c of list) {
    c.estimated = round2(c.estimated);
    c.contracted = round2(c.contracted);
    c.paid = round2(c.paid);
    c.overBudget = c.budgeted > 0 && c.contracted > c.budgeted;
  }
  return list;
}

export type BudgetAlert = {
  kind:
    | "over_category_budget"
    | "overdue_payment"
    | "payment_due_soon"
    | "payments_exceed_contract"
    | "over_total_budget"
    | "uncategorized_expense"
    | "large_change";
  severity: "info" | "warning" | "critical";
  message: string;
  expenseId?: string;
};

export function computeBudgetAlerts(
  expenses: ExpenseWithPayments[],
  categories: { id: string; name: string; budgeted_amount: number }[],
  totalBudget: number | null,
  today: Date = new Date(),
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];
  const computed = expenses.map((e) => computeExpense(e, today));
  const spend = computeCategorySpending(categories, computed.map((c) => c.expense));

  for (const c of spend) {
    if (c.overBudget) {
      alerts.push({
        kind: "over_category_budget",
        severity: "warning",
        message: `${c.name} is over its budget by ${formatAmount(c.contracted - c.budgeted)}.`,
      });
    }
  }

  for (const c of computed) {
    for (const p of c.overduePayments) {
      alerts.push({
        kind: "overdue_payment",
        severity: "critical",
        message: `${c.expense.title}: ${p.label} (${formatAmount(Number(p.amount))}) is overdue.`,
        expenseId: c.expense.id,
      });
    }
    if (c.paymentsExceedContract) {
      alerts.push({
        kind: "payments_exceed_contract",
        severity: "warning",
        message: `${c.expense.title}: scheduled payments exceed the contracted amount.`,
        expenseId: c.expense.id,
      });
    }
    if (c.expense.category_id == null) {
      alerts.push({
        kind: "uncategorized_expense",
        severity: "info",
        message: `${c.expense.title} has no category assigned.`,
        expenseId: c.expense.id,
      });
    }
    if (
      c.expense.actual_amount != null &&
      c.expense.quoted_amount != null &&
      Number(c.expense.quoted_amount) > 0 &&
      Number(c.expense.actual_amount) > Number(c.expense.quoted_amount) * 1.25
    ) {
      alerts.push({
        kind: "large_change",
        severity: "warning",
        message: `${c.expense.title} actual cost exceeds quote by more than 25%.`,
        expenseId: c.expense.id,
      });
    }
  }

  const totals = computeBudgetTotals(expenses, totalBudget, 0, today);
  if (totals.totalBudget > 0 && totals.contractedTotal > totals.totalBudget) {
    alerts.push({
      kind: "over_total_budget",
      severity: "critical",
      message: `Total commitments exceed the budget by ${formatAmount(
        totals.contractedTotal - totals.totalBudget,
      )}.`,
    });
  }

  return alerts;
}

export function formatAmount(n: number, currency = "PHP"): string {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
