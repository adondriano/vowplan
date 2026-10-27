import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/planner/reports-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports & Exports" };

export default async function ReportsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();

  const [groupsR, invitationsR, guestsR, responsesR, tasksR, expensesR, paymentsR, vendorsR, eventsR] =
    await Promise.all([
      supabase.from("guest_groups").select("*").eq("wedding_id", weddingId),
      supabase.from("guest_invitations").select("*").eq("wedding_id", weddingId),
      supabase.from("guests").select("*").eq("wedding_id", weddingId),
      supabase.from("rsvp_responses").select("*").eq("wedding_id", weddingId),
      supabase.from("wedding_tasks").select("*").eq("wedding_id", weddingId),
      supabase.from("expenses").select("*").eq("wedding_id", weddingId),
      supabase.from("expense_payments").select("*").eq("status", "scheduled"),
      supabase.from("vendors").select("*").eq("wedding_id", weddingId),
      supabase.from("wedding_events").select("*").eq("wedding_id", weddingId).order("event_date"),
    ]);

  return (
    <ReportsView
      wedding={wedding}
      data={{
        groups: groupsR.data ?? [],
        invitations: invitationsR.data ?? [],
        guests: guestsR.data ?? [],
        responses: responsesR.data ?? [],
        tasks: tasksR.data ?? [],
        expenses: expensesR.data ?? [],
        payments: paymentsR.data ?? [],
        vendors: vendorsR.data ?? [],
        events: eventsR.data ?? [],
      }}
    />
  );
}
