import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { InspirationClient } from "@/components/planner/inspiration-client";
import type { MediaAsset } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inspiration Board" };

export default async function InspirationPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data } = await supabase.from("media_assets").select("*").eq("wedding_id", weddingId).eq("kind", "inspiration").order("sort_order");
  return <InspirationClient weddingId={weddingId} assets={(data ?? []) as unknown as MediaAsset[]} />;
}
