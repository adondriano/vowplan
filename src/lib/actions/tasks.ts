"use server";
import { createServerClient } from "@/lib/supabase/server";
import { requireWeddingAccess } from "@/lib/server/weddings";
import { revalidatePath } from "next/cache";

export type TaskInput = {
  title: string;
  description?: string | null;
  category?: string;
  priority?: string;
  status?: string;
  due_date?: string | null;
  assignee?: string | null;
  notes?: string | null;
  depends_on_task_id?: string | null;
  relative_days?: number | null;
};

export async function createTask(weddingId: string, input: TaskInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("wedding_tasks").insert({
    wedding_id: weddingId,
    title: input.title.trim(),
    description: input.description ?? null,
    category: input.category || "other",
    priority: input.priority || "medium",
    status: input.status || "todo",
    due_date: input.due_date || null,
    assignee: input.assignee || null,
    notes: input.notes || null,
    depends_on_task_id: input.depends_on_task_id || null,
    relative_days: input.relative_days ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/checklist`);
  revalidatePath(`/app/weddings/${weddingId}`);
  return { ok: true };
}

export async function updateTask(weddingId: string, taskId: string, input: Partial<TaskInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = { ...input };
  if (input.status === "done") patch.completed_at = new Date().toISOString();
  if (input.status && input.status !== "done") patch.completed_at = null;
  if (input.title != null) patch.title = input.title.trim();
  const { error } = await supabase.from("wedding_tasks").update(patch).eq("id", taskId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/checklist`);
  revalidatePath(`/app/weddings/${weddingId}`);
  return { ok: true };
}

export async function toggleTaskDone(weddingId: string, taskId: string, done: boolean) {
  return updateTask(weddingId, taskId, { status: done ? "done" : "todo" });
}

export async function deleteTask(weddingId: string, taskId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("wedding_tasks").delete().eq("id", taskId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/checklist`);
  return { ok: true };
}

/** Recalculates due dates for opt-in template tasks after a date change. */
export async function rescheduleTemplateTasks(weddingId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: wedding } = await supabase.from("weddings").select("wedding_date").eq("id", weddingId).single();
  if (!wedding?.wedding_date) return { ok: true, count: 0 };
  const { data: templates } = await supabase
    .from("wedding_tasks")
    .select("id, relative_days")
    .eq("wedding_id", weddingId)
    .not("relative_days", "is", null);
  let count = 0;
  for (const t of templates ?? []) {
    const d = new Date(wedding.wedding_date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - t.relative_days);
    await supabase.from("wedding_tasks").update({ due_date: d.toISOString().slice(0, 10) }).eq("id", t.id);
    count++;
  }
  revalidatePath(`/app/weddings/${weddingId}/checklist`);
  return { ok: true, count };
}
