import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { BudgetClient } from "@/components/planner/budget-client";
import type { BudgetCategory, Expense, ExpensePayment, Vendor } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Budget & Payments" };

export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ weddingId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { weddingId } = await params;
  const { filter } = await searchParams;
  const { wedding } = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();

  const [categoriesR, expensesR, paymentsR, vendorsR] = await Promise.all([
    supabase.from("budget_categories").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("expenses").select("*").eq("wedding_id", weddingId).order("created_at", { ascending: false }),
    supabase.from("expense_payments").select("*").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("vendors").select("id, name").eq("wedding_id", weddingId).order("name"),
  ]);

  const payments = paymentsR.data ?? [];
  const expenses = (expensesR.data ?? []).map((e) => ({
    ...e,
    payments: payments.filter((p) => p.expense_id === e.id),
  }));

  return (
    <BudgetClient
      weddingId={weddingId}
      currency={wedding.currency}
      totalBudget={wedding.total_budget}
      contingencyPct={wedding.contingency_pct}
      categories={(categoriesR.data ?? []) as unknown as BudgetCategory[]}
      expenses={expenses as unknown as (Expense & { payments: ExpensePayment[] })[]}
      vendors={(vendorsR.data ?? []) as Pick<Vendor, "id" | "name">[]}
      initialFilter={filter ?? "all"}
    />
  );
}
