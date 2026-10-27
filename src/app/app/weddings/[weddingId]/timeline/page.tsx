import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { TimelineClient } from "@/components/planner/timeline-client";
import type { WeddingEvent } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timeline & Schedule" };

export default async function TimelinePage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const [{ data: events }, { data: vendors }] = await Promise.all([
    supabase
      .from("wedding_events")
      .select("*")
      .eq("wedding_id", weddingId)
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("sort_order"),
    supabase.from("vendors").select("id, name").eq("wedding_id", weddingId).order("name"),
  ]);

  return (
    <TimelineClient
      weddingId={weddingId}
      weddingDate={wedding.wedding_date}
      dateTentative={wedding.date_status === "tentative"}
      events={(events ?? []) as unknown as WeddingEvent[]}
      vendors={(vendors ?? []) as { id: string; name: string }[]}
    />
  );
}
