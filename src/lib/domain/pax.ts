import type { Guest, GuestGroup, Invitation, RsvpResponse } from "./types";

/**
 * PAX accounting. Keeps these numbers distinct (never mix invitations with people):
 *  - people listed in the database
 *  - invitation groups (households)
 *  - people invited (sum of max PAX allowances)
 *  - confirmed / declined / pending PAX
 */

export type PaxTotals = {
  individuals: number;
  groups: number;
  invitedPax: number;
  confirmedPax: number;
  declinedGroups: number;
  pendingPax: number;
  responseRate: number; // 0..100, by invitation groups with a response
  confirmedGroups: number;
  pendingGroups: number;
};

export function computePaxTotals(
  groups: Pick<GuestGroup, "id" | "invited_pax">[],
  invitations: Pick<Invitation, "id" | "group_id" | "max_pax" | "status">[],
  responses: Pick<RsvpResponse, "invitation_id" | "status" | "attending_count">[],
): PaxTotals {
  const individuals = 0; // computed by caller with guests list when needed
  void individuals;

  const invitedPax = invitations.length
    ? invitations.reduce((s, i) => s + i.max_pax, 0)
    : groups.reduce((s, g) => s + g.invited_pax, 0);

  let confirmedPax = 0;
  let confirmedGroups = 0;
  let declinedGroups = 0;
  const responded = new Set<string>();

  for (const r of responses) {
    responded.add(r.invitation_id);
    if (r.status === "confirmed") {
      confirmedPax += r.attending_count;
      confirmedGroups += 1;
    } else {
      declinedGroups += 1;
    }
  }

  const groupsWithInvite = new Set(invitations.map((i) => i.group_id));
  const pendingGroups = groups.filter((g) => {
    if (groupsWithInvite.has(g.id)) return true; // has invitation; response checked below
    return true;
  }).length;

  // Groups considered "pending": have an invitation but no response yet.
  const invitationByGroup = new Map(invitations.map((i) => [i.group_id, i]));
  const pendingList = groups.filter((g) => {
    const inv = invitationByGroup.get(g.id);
    if (!inv) return false; // no invitation link yet → not part of RSVP funnel
    return !responded.has(inv.id) && inv.status !== "cancelled";
  });
  const pendingPax = pendingList.reduce((s, g) => {
    const inv = invitationByGroup.get(g.id)!;
    return s + inv.max_pax;
  }, 0);

  const totalFunnelGroups = invitations.filter((i) => i.status !== "cancelled").length;
  const responseRate =
    totalFunnelGroups === 0
      ? 0
      : Math.round(((confirmedGroups + declinedGroups) / totalFunnelGroups) * 100);

  void pendingGroups;

  return {
    individuals,
    groups: groups.length,
    invitedPax,
    confirmedPax,
    declinedGroups,
    pendingPax,
    responseRate,
    confirmedGroups,
    pendingGroups: pendingList.length,
  };
}

export function countIndividuals(guests: Pick<Guest, "id">[]): number {
  return guests.length;
}

export function guestDisplayName(g: Pick<Guest, "first_name" | "last_name" | "display_name">) {
  return (
    g.display_name ??
    [g.first_name, g.last_name].filter(Boolean).join(" ").trim() ??
    "Guest"
  );
}

export function groupDisplayName(g: Pick<GuestGroup, "name">) {
  return g.name;
}
