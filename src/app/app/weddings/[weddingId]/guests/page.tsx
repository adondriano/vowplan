import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { GuestsClient } from "@/components/planner/guests-client";
import type { Guest, GuestGroup, Invitation } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guest List" };

export default async function GuestsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();

  const [groupsR, guestsR, invitationsR] = await Promise.all([
    supabase.from("guest_groups").select("*").eq("wedding_id", weddingId).order("created_at"),
    supabase.from("guests").select("*").eq("wedding_id", weddingId).order("created_at"),
    supabase.from("guest_invitations").select("id, group_id, status, max_pax").eq("wedding_id", weddingId),
  ]);

  return (
    <GuestsClient
      weddingId={weddingId}
      currency={wedding.currency}
      groups={(groupsR.data ?? []) as unknown as GuestGroup[]}
      guests={(guestsR.data ?? []) as unknown as Guest[]}
      invitations={(invitationsR.data ?? []) as unknown as Pick<Invitation, "id" | "group_id" | "status" | "max_pax">[]}
    />
  );
}
