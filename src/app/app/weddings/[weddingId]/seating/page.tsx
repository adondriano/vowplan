import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { SeatingClient } from "@/components/planner/seating-client";
import type { Guest, SeatingTable, GuestTableAssignment, Invitation } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seating Planner" };

export default async function SeatingPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const [tablesR, guestsR, assignmentsR, groupsR, invitationsR, responsesR] = await Promise.all([
    supabase.from("seating_tables").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("guests").select("*").eq("wedding_id", weddingId).order("created_at"),
    supabase.from("guest_table_assignments").select("*").eq("wedding_id", weddingId),
    supabase.from("guest_groups").select("id, name").eq("wedding_id", weddingId),
    supabase.from("guest_invitations").select("id, group_id, max_pax").eq("wedding_id", weddingId),
    supabase.from("rsvp_responses").select("invitation_id, status, attending_count").eq("wedding_id", weddingId),
  ]);

  return (
    <SeatingClient
      weddingId={weddingId}
      tables={(tablesR.data ?? []) as unknown as SeatingTable[]}
      guests={(guestsR.data ?? []) as unknown as Guest[]}
      assignments={(assignmentsR.data ?? []) as unknown as GuestTableAssignment[]}
      groups={(groupsR.data ?? []) as { id: string; name: string }[]}
      invitations={(invitationsR.data ?? []) as Pick<Invitation, "id" | "group_id" | "max_pax">[]}
      responses={(responsesR.data ?? []) as { invitation_id: string; status: string; attending_count: number }[]}
    />
  );
}
