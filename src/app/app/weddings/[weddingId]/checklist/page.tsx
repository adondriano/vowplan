import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { ChecklistClient } from "@/components/planner/checklist-client";
import type { Task } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checklist & Tasks" };

export default async function ChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ weddingId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { weddingId } = await params;
  const { view } = await searchParams;
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: tasks } = await supabase
    .from("wedding_tasks")
    .select("*")
    .eq("wedding_id", weddingId)
    .order("due_date", { ascending: true, nullsFirst: false });

  return (
    <ChecklistClient
      weddingId={weddingId}
      tasks={(tasks ?? []) as unknown as Task[]}
      initialView={view === "overdue" ? "upcoming" : "list"}
    />
  );
}
