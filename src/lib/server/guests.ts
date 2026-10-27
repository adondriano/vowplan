import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { generateInvitationToken, hashToken, encryptToken } from "@/lib/domain/tokens";
import type { Guest, GuestGroup, Invitation, RsvpResponse } from "@/lib/domain/types";

export async function generateInvitationForGroup(weddingId: string, groupId: string) {
  const supabase = await createServerClient();

  const { data: group } = await supabase
    .from("guest_groups")
    .select("invited_pax")
    .eq("id", groupId)
    .eq("wedding_id", weddingId)
    .single();
  if (!group) throw new Error("Group not found");

  const { data: existing } = await supabase
    .from("guest_invitations")
    .select("id")
    .eq("group_id", groupId)
    .maybeSingle();

  const token = generateInvitationToken();
  const row = {
    token_hash: hashToken(token),
    token_ciphertext: encryptToken(token),
    status: "ready",
    max_pax: group.invited_pax,
    issued_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabase
        .from("guest_invitations")
        .update({ token_hash: row.token_hash, token_ciphertext: row.token_ciphertext, status: "ready", max_pax: row.max_pax })
        .eq("id", existing.id)
        .select()
        .single()
    : await supabase
        .from("guest_invitations")
        .insert({
          wedding_id: weddingId,
          group_id: groupId,
          token_hash: row.token_hash,
          token_ciphertext: row.token_ciphertext,
          status: "ready",
          max_pax: group.invited_pax,
          issued_at: row.issued_at,
        })
        .select()
        .single();
  if (error) throw new Error(error.message);
  return { invitation: data as Invitation, token };
}

/** Reveal the stored link for a planner row (decrypt ciphertext). */
export async function revealInvitationToken(invitationId: string): Promise<string | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("guest_invitations")
    .select("token_ciphertext")
    .eq("id", invitationId)
    .single();
  if (!data) return null;
  const { decryptToken } = await import("@/lib/domain/tokens");
  return decryptToken(data.token_ciphertext);
}

export async function revokeInvitation(invitationId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("guest_invitations")
    .update({ status: "cancelled", token_revoked_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) throw new Error(error.message);
}

export async function restoreInvitation(invitationId: string) {
  const supabase = await createServerClient();
  const token = generateInvitationToken();
  const { error } = await supabase
    .from("guest_invitations")
    .update({
      status: "ready",
      token_revoked_at: null,
      token_hash: hashToken(token),
      token_ciphertext: encryptToken(token),
    })
    .eq("id", invitationId);
  if (error) throw new Error(error.message);
  return token;
}

export type InvitationWithRelations = {
  invitation: Invitation;
  group: GuestGroup;
  guests: Guest[];
  response: RsvpResponse | null;
};

/** Full RSVP-manager rows for a wedding (invitation + group + guests + response). */
export async function listInvitationsWithRelations(
  weddingId: string,
): Promise<InvitationWithRelations[]> {
  const supabase = await createServerClient();
  const [{ data: invitations }, { data: groups }, { data: guests }, { data: responses }] =
    await Promise.all([
      supabase.from("guest_invitations").select("*").eq("wedding_id", weddingId).order("created_at"),
      supabase.from("guest_groups").select("*").eq("wedding_id", weddingId).order("created_at"),
      supabase.from("guests").select("*").eq("wedding_id", weddingId).order("created_at"),
      supabase.from("rsvp_responses").select("*").eq("wedding_id", weddingId),
    ]);

  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  const guestsByGroup = new Map<string, Guest[]>();
  for (const g of (guests ?? []) as Guest[]) {
    if (!g.group_id) continue;
    const list = guestsByGroup.get(g.group_id) ?? [];
    list.push(g);
    guestsByGroup.set(g.group_id, list);
  }
  const responseByInvitation = new Map(
    ((responses ?? []) as RsvpResponse[]).map((r) => [r.invitation_id, r]),
  );

  return ((invitations ?? []) as Invitation[])
    .map((inv) => {
      const group = groupById.get(inv.group_id);
      if (!group) return null;
      return {
        invitation: inv,
        group,
        guests: guestsByGroup.get(inv.group_id) ?? [],
        response: responseByInvitation.get(inv.id) ?? null,
      };
    })
    .filter(Boolean) as InvitationWithRelations[];
}

export type GuestImportRow = {
  group_name: string;
  category?: string;
  side?: string;
  invited_pax?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  relationship?: string;
};

/** CSV import: rows grouped by household name; dedupes groups and guests. */
export async function importGuestsFromRows(weddingId: string, rows: GuestImportRow[]) {
  const supabase = await createServerClient();
  const { data: existingGroups } = await supabase
    .from("guest_groups")
    .select("id, name, category, side")
    .eq("wedding_id", weddingId);
  type ImportedGroup = { id: string; name: string; category: string | null; side: GuestGroup["side"] };
  const groupByName = new Map<string, ImportedGroup>(
    ((existingGroups ?? []) as ImportedGroup[]).map((g) => [g.name.toLowerCase(), g]),
  );

  let groupsCreated = 0;
  let guestsCreated = 0;
  let duplicatesSkipped = 0;

  for (const row of rows) {
    if (!row.group_name?.trim()) continue;
    let group = groupByName.get(row.group_name.trim().toLowerCase());
    if (!group) {
      const { data, error } = await supabase
        .from("guest_groups")
        .insert({
          wedding_id: weddingId,
          name: row.group_name.trim(),
          category: row.category?.trim() || "Other",
          side: (row.side as GuestGroup["side"]) || "both",
          invited_pax: Math.max(1, Number(row.invited_pax) || 1),
          primary_contact_name: [row.first_name, row.last_name].filter(Boolean).join(" ") || null,
          primary_contact_email: row.email?.trim() || null,
          primary_contact_phone: row.phone?.trim() || null,
        })
        .select()
        .single();
      if (error || !data) continue;
      group = data as ImportedGroup;
      groupByName.set(row.group_name.trim().toLowerCase(), group);
      groupsCreated += 1;
    }
    if (!group) continue;

    if (row.first_name?.trim()) {
      const { data: existingGuests } = await supabase
        .from("guests")
        .select("id")
        .eq("wedding_id", weddingId)
        .eq("group_id", group.id)
        .ilike("first_name", row.first_name.trim());
      if (existingGuests && existingGuests.length > 0) {
        duplicatesSkipped += 1;
        continue;
      }
      const { error } = await supabase.from("guests").insert({
        wedding_id: weddingId,
        group_id: group.id,
        first_name: row.first_name.trim(),
        last_name: row.last_name?.trim() || null,
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        relationship: row.relationship?.trim() || null,
        category: row.category?.trim() || group.category,
        side: (row.side as Guest["side"]) || group.side,
        is_primary_contact: true,
      });
      if (!error) guestsCreated += 1;
    }
  }

  return { groupsCreated, guestsCreated, duplicatesSkipped };
}
