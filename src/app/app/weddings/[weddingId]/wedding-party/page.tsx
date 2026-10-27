import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { WeddingPartyClient } from "@/components/planner/wedding-party-client";
import type { WeddingPartyMember } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wedding Party" };

export default async function WeddingPartyPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data } = await supabase.from("wedding_party_members").select("*").eq("wedding_id", weddingId).order("sort_order");
  return <WeddingPartyClient weddingId={weddingId} members={(data ?? []) as unknown as WeddingPartyMember[]} />;
}
