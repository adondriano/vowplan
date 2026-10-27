import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { InvitationStudio } from "@/components/planner/invitation-studio";
import { parseInvitationContent, parseInvitationTheme } from "@/lib/domain/invitation";
import type { InvitationVersion, Venue, WeddingEvent } from "@/lib/domain/types-extended";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitation Website" };

export default async function InvitationPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();

  const [{ data: versions }, { data: venues }, { data: events }] = await Promise.all([
    supabase.from("invitation_versions").select("*").eq("wedding_id", weddingId).order("version", { ascending: false }),
    supabase.from("venues").select("*").eq("wedding_id", weddingId).order("created_at"),
    supabase
      .from("wedding_events")
      .select("*")
      .eq("wedding_id", weddingId)
      .eq("event_type", "wedding_day")
      .eq("is_public", true)
      .order("start_time"),
  ]);

  const latest = versions?.[0] as InvitationVersion | undefined;
  const published = (versions ?? []).find((v) => v.published) as InvitationVersion | undefined;
  const draftContent = parseInvitationContent(latest?.content ?? wedding.invitation_config);
  const draftTheme = parseInvitationTheme(latest?.theme ?? {});
  const publishedContent = published ? parseInvitationContent(published.content) : null;

  return (
    <InvitationStudio
      weddingId={weddingId}
      weddingName={[wedding.bride_name, wedding.groom_name].filter(Boolean).join(" & ")}
      weddingDate={wedding.wedding_date}
      dateStatus={wedding.date_status}
      rsvpDeadline={wedding.rsvp_deadline}
      isPublished={wedding.invitation_published}
      content={draftContent}
      theme={draftTheme}
      publishedContent={publishedContent}
      versions={(versions ?? []) as InvitationVersion[]}
      venues={(venues ?? []) as Venue[]}
      publicEvents={(events ?? []) as WeddingEvent[]}
    />
  );
}
