import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { VendorsClient } from "@/components/planner/vendors-client";
import type { Vendor } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendors" };

export default async function VendorsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: vendors } = await supabase.from("vendors").select("*").eq("wedding_id", weddingId).order("created_at");
  return <VendorsClient weddingId={weddingId} currency={wedding.currency} vendors={(vendors ?? []) as unknown as Vendor[]} />;
}
