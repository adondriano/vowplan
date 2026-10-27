import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { InvalidToken } from "@/components/invite/invalid-token";
import { InvitationExperience } from "@/components/invite/invitation-experience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're invited",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FDF4F1",
};

type InvitationView = {
  wedding: {
    brideName: string;
    groomName: string;
    partner1Label: string;
    partner2Label: string;
    weddingDate: string | null;
    dateStatus: string;
    location: string | null;
    rsvpDeadline: string | null;
    invitationContent: { content: unknown; theme: unknown } | null;
    rsvpSettings: Record<string, unknown>;
  };
  invitation: { id: string; greetingName: string | null; maxPax: number; status: string };
  group: { name: string; invitedPax: number; inviteeNames: { displayName: string }[] };
  response: {
    status: "confirmed" | "declined";
    attendingCount: number;
    mealPreferences: string | null;
    dietaryNotes: string | null;
    accessibilityNotes: string | null;
    messageToCouple: string | null;
    songRequest: string | null;
    submittedAt: string;
    updatedAt: string;
  } | null;
} & { error?: string };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Basic shape check before any DB hit (defends against garbage tokens).
  if (!/^vp_[A-Za-z0-9_-]{20,120}$/.test(token)) {
    return <InvalidToken />;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_invitation_view", { p_token: token });
  if (error || !data) {
    // Invalid or revoked — same graceful page, no detail leaked.
    return <InvalidToken />;
  }
  const view = data as unknown as InvitationView;
  if (view.error === "revoked" || view.error === "expired") {
    return <InvalidToken kind={view.error} />;
  }

  // Restrictive headers are set in next.config.ts headers() for /invite/*.
  return (
    <InvitationExperience
      token={token}
      view={{
        wedding: view.wedding,
        invitation: view.invitation,
        group: view.group,
        response: view.response,
      }}
    />
  );
}
