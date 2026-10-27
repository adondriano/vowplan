import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { VenuesClient } from "@/components/planner/venues-client";
import type { Venue, Vendor } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venues & Logistics" };

export default async function VenuesPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const [{ data: venues }, { data: vendors }] = await Promise.all([
    supabase.from("venues").select("*").eq("wedding_id", weddingId).order("created_at"),
    supabase.from("vendors").select("id, name").eq("wedding_id", weddingId).order("name"),
  ]);
  return (
    <VenuesClient
      weddingId={weddingId}
      currency={wedding.currency}
      venues={(venues ?? []) as unknown as Venue[]}
      vendors={(vendors ?? []) as Pick<Vendor, "id" | "name">[]}
    />
  );
}
