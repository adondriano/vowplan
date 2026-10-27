import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { RsvpManagerClient } from "@/components/planner/rsvp-manager-client";
import type { Guest, GuestGroup, Invitation, RsvpResponse, Wedding } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "RSVP Manager" };

export default async function RsvpManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ weddingId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { weddingId } = await params;
  const { status } = await searchParams;
  const { wedding } = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();

  const [invitationsR, groupsR, guestsR, responsesR] = await Promise.all([
    supabase.from("guest_invitations").select("*").eq("wedding_id", weddingId).order("created_at"),
    supabase.from("guest_groups").select("*").eq("wedding_id", weddingId).order("created_at"),
    supabase.from("guests").select("*").eq("wedding_id", weddingId).order("created_at"),
    supabase.from("rsvp_responses").select("*").eq("wedding_id", weddingId),
  ]);

  return (
    <RsvpManagerClient
      weddingId={weddingId}
      wedding={wedding as unknown as Wedding}
      invitations={(invitationsR.data ?? []) as unknown as Invitation[]}
      groups={(groupsR.data ?? []) as unknown as GuestGroup[]}
      guests={(guestsR.data ?? []) as unknown as Guest[]}
      responses={(responsesR.data ?? []) as unknown as RsvpResponse[]}
      initialStatusFilter={status ?? "all"}
    />
  );
}
