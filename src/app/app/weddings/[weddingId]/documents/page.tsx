import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { DocumentsClient } from "@/components/planner/documents-client";
import type { WeddingDocument, Vendor } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function DocumentsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const [{ data: docs }, { data: vendors }] = await Promise.all([
    supabase.from("wedding_documents").select("*").eq("wedding_id", weddingId).order("created_at", { ascending: false }),
    supabase.from("vendors").select("id, name").eq("wedding_id", weddingId),
  ]);
  return <DocumentsClient weddingId={weddingId} documents={(docs ?? []) as unknown as WeddingDocument[]} vendors={(vendors ?? []) as Pick<Vendor, "id" | "name">[]} />;
}
