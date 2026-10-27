import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { NotesClient } from "@/components/planner/notes-client";
import type { Decision } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notes & Decisions" };

export default async function NotesPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data } = await supabase.from("decisions").select("*").eq("wedding_id", weddingId).order("decision_date", { ascending: false });
  return <NotesClient weddingId={weddingId} decisions={(data ?? []) as unknown as Decision[]} />;
}
