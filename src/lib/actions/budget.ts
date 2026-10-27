"use server";
import { createServerClient } from "@/lib/supabase/server";
import { requireWeddingAccess } from "@/lib/server/weddings";
import { revalidatePath } from "next/cache";

export type CategoryInput = { name: string; budgeted_amount?: number; sort_order?: number };

export async function createCategory(weddingId: string, input: CategoryInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("budget_categories").insert({
    wedding_id: weddingId,
    name: input.name.trim(),
    budgeted_amount: Number(input.budgeted_amount) || 0,
    sort_order: input.sort_order ?? 100,
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/budget`);
  return { ok: true as const };
}

export async function updateCategory(weddingId: string, categoryId: string, input: Partial<CategoryInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = {};
  if (input.name != null) patch.name = input.name.trim();
  if (input.budgeted_amount != null) patch.budgeted_amount = Number(input.budgeted_amount);
  if (input.sort_order != null) patch.sort_order = input.sort_order;
  const { error } = await supabase.from("budget_categories").update(patch).eq("id", categoryId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/budget`);
  return { ok: true as const };
}

export async function deleteCategory(weddingId: string, categoryId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("budget_categories").delete().eq("id", categoryId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/budget`);
  return { ok: true as const };
}

export type ExpenseInput = {
  title: string;
  category_id?: string | null;
  vendor_id?: string | null;
  estimated_amount?: number;
  quoted_amount?: number | null;
  contracted_amount?: number | null;
  actual_amount?: number | null;
  currency?: string;
  conversion_rate?: number;
  due_date?: string | null;
  task_id?: string | null;
  notes?: string | null;
};

export async function createExpense(weddingId: string, input: ExpenseInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("expenses").insert({
    wedding_id: weddingId,
    title: input.title.trim(),
    category_id: input.category_id || null,
    vendor_id: input.vendor_id || null,
    estimated_amount: Number(input.estimated_amount) || 0,
    quoted_amount: input.quoted_amount ?? null,
    contracted_amount: input.contracted_amount ?? null,
    actual_amount: input.actual_amount ?? null,
    currency: input.currency || "PHP",
    conversion_rate: Number(input.conversion_rate) || 1,
    due_date: input.due_date || null,
    task_id: input.task_id || null,
    notes: input.notes ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/budget`);
  revalidatePath(`/app/weddings/${weddingId}`);
  return { ok: true as const };
}

export async function updateExpense(weddingId: string, expenseId: string, input: Partial<ExpenseInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch = { ...input };
  if (input.title != null) patch.title = input.title.trim();
  const { error } = await supabase.from("expenses").update(patch).eq("id", expenseId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/budget`);
  return { ok: true as const };
}

export async function deleteExpense(weddingId: string, expenseId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/budget`);
  return { ok: true as const };
}

export type PaymentInput = {
  label?: string;
  amount: number;
  due_date?: string | null;
  status?: "scheduled" | "paid";
  paid_at?: string | null;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
};

export async function createPayment(weddingId: string, expenseId: string, input: PaymentInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: expense } = await supabase.from("expenses").select("id").eq("id", expenseId).eq("wedding_id", weddingId).single();
  if (!expense) return { error: "Expense not found" };
  const { error } = await supabase.from("expense_payments").insert({
    expense_id: expenseId,
    label: input.label?.trim() || "Payment",
    amount: Number(input.amount) || 0,
    due_date: input.due_date || null,
    status: input.status || "scheduled",
    paid_at: input.status === "paid" ? (input.paid_at || new Date().toISOString().slice(0, 10)) : null,
    method: input.method ?? null,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
  });
  if (error) return { error: error.message };
  await syncExpensePaymentStatus(supabase, expenseId);
  revalidatePath(`/app/weddings/${weddingId}/budget`);
  return { ok: true as const };
}

export async function updatePayment(weddingId: string, paymentId: string, input: Partial<PaymentInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = { ...input };
  if (input.amount != null) patch.amount = Number(input.amount);
  if (input.status === "paid" && !input.paid_at) patch.paid_at = new Date().toISOString().slice(0, 10);
  if (input.status === "scheduled") patch.paid_at = null;
  const { data: payment } = await supabase
    .from("expense_payments")
    .update(patch)
    .eq("id", paymentId)
    .select("expense_id")
    .single();
  if (payment) await syncExpensePaymentStatus(supabase, payment.expense_id);
  revalidatePath(`/app/weddings/${weddingId}/budget`);
  return { ok: true as const };
}

export async function deletePayment(weddingId: string, paymentId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: payment } = await supabase.from("expense_payments").delete().eq("id", paymentId).select("expense_id").single();
  if (payment) await syncExpensePaymentStatus(supabase, payment.expense_id);
  revalidatePath(`/app/weddings/${weddingId}/budget`);
  return { ok: true as const };
}

async function syncExpensePaymentStatus(supabase: Awaited<ReturnType<typeof createServerClient>>, expenseId: string) {
  const { data: payments } = await supabase.from("expense_payments").select("status, amount").eq("expense_id", expenseId);
  const list = payments ?? [];
  let status: "unpaid" | "partial" | "paid" = "unpaid";
  if (list.length > 0 && list.every((p) => p.status === "paid")) status = "paid";
  else if (list.some((p) => p.status === "paid")) status = "partial";
  await supabase.from("expenses").update({ payment_status: status }).eq("id", expenseId);
}
