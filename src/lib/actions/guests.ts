"use server";
import { createServerClient } from "@/lib/supabase/server";
import { requireWeddingAccess } from "@/lib/server/weddings";
import { revalidatePath } from "next/cache";
import { importGuestsFromRows, generateInvitationForGroup, revokeInvitation, restoreInvitation } from "@/lib/server/guests";
import type { GuestImportRow } from "@/lib/server/guests";

export type GroupInput = {
  name: string;
  category?: string;
  side?: string;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  invited_pax?: number;
  plus_one_allowed?: boolean;
  invitation_type?: string;
  internal_notes?: string | null;
  rsvp_deadline_override?: string | null;
};

export async function createGroup(weddingId: string, input: GroupInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("guest_groups")
    .insert({
      wedding_id: weddingId,
      name: input.name.trim(),
      category: input.category || "Other",
      side: input.side || "both",
      primary_contact_name: input.primary_contact_name ?? null,
      primary_contact_email: input.primary_contact_email ?? null,
      primary_contact_phone: input.primary_contact_phone ?? null,
      invited_pax: Math.max(1, Number(input.invited_pax) || 1),
      plus_one_allowed: input.plus_one_allowed ?? false,
      invitation_type: input.invitation_type || "household",
      internal_notes: input.internal_notes ?? null,
      rsvp_deadline_override: input.rsvp_deadline_override || null,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/guests`);
  return { ok: true as const, id: data.id };
}

export async function updateGroup(weddingId: string, groupId: string, input: Partial<GroupInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch = { ...input };
  if (input.name != null) patch.name = input.name.trim();
  if (input.invited_pax != null) patch.invited_pax = Math.max(1, Number(input.invited_pax));
  const { error } = await supabase.from("guest_groups").update(patch).eq("id", groupId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/guests`);
  revalidatePath(`/app/weddings/${weddingId}/rsvps`);
  return { ok: true as const };
}

export async function deleteGroup(weddingId: string, groupId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("guest_groups").delete().eq("id", groupId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/guests`);
  return { ok: true as const };
}

export type GuestInput = {
  first_name: string;
  last_name?: string | null;
  display_name?: string | null;
  group_id?: string | null;
  email?: string | null;
  phone?: string | null;
  relationship?: string | null;
  category?: string | null;
  side?: string;
  is_primary_contact?: boolean;
  internal_notes?: string | null;
  dietary_notes?: string | null;
  accessibility_notes?: string | null;
};

export async function createGuest(weddingId: string, input: GuestInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("guests")
    .insert({
      wedding_id: weddingId,
      group_id: input.group_id || null,
      first_name: input.first_name.trim(),
      last_name: input.last_name ?? null,
      display_name: input.display_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      relationship: input.relationship ?? null,
      category: input.category ?? null,
      side: input.side || "both",
      is_primary_contact: input.is_primary_contact ?? false,
      internal_notes: input.internal_notes ?? null,
      dietary_notes: input.dietary_notes ?? null,
      accessibility_notes: input.accessibility_notes ?? null,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/guests`);
  revalidatePath(`/app/weddings/${weddingId}/seating`);
  return { ok: true as const, id: data.id };
}

export async function updateGuest(weddingId: string, guestId: string, input: Partial<GuestInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch = { ...input };
  if (input.first_name != null) patch.first_name = input.first_name.trim();
  const { error } = await supabase.from("guests").update(patch).eq("id", guestId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/guests`);
  return { ok: true as const };
}

export async function deleteGuest(weddingId: string, guestId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("guests").delete().eq("id", guestId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/guests`);
  revalidatePath(`/app/weddings/${weddingId}/seating`);
  return { ok: true as const };
}

export async function bulkAssignCategory(weddingId: string, groupIds: string[], category: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("guest_groups").update({ category }).in("id", groupIds).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/guests`);
  return { ok: true as const };
}

export async function bulkDeleteGroups(weddingId: string, groupIds: string[]) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("guest_groups").delete().in("id", groupIds).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/guests`);
  return { ok: true as const };
}

export async function importGuestsCsv(
  weddingId: string,
  csvText: string,
): Promise<{ error: string } | { ok: true; groupsCreated: number; guestsCreated: number; duplicatesSkipped: number }> {
  await requireWeddingAccess(weddingId);
  const { parseCsv } = await import("@/lib/domain/csv");
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { error: "CSV needs a header row and at least one data row." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const parsed: GuestImportRow[] = [];
  for (const r of rows.slice(1)) {
    parsed.push({
      group_name: r[idx("group_name")] ?? r[idx("group")] ?? r[idx("family")] ?? r[idx("name")] ?? "",
      category: r[idx("category")] ?? undefined,
      side: r[idx("side")] ?? undefined,
      invited_pax: r[idx("invited_pax")] ? Number(r[idx("invited_pax")]) : undefined,
      first_name: r[idx("first_name")] || undefined,
      last_name: r[idx("last_name")] || undefined,
      email: r[idx("email")] || undefined,
      phone: r[idx("phone")] || undefined,
      relationship: r[idx("relationship")] || undefined,
    });
  }
  const result = await importGuestsFromRows(weddingId, parsed);
  revalidatePath(`/app/weddings/${weddingId}/guests`);
  return { ok: true as const, ...result };
}

export async function generateInvitation(weddingId: string, groupId: string) {
  await requireWeddingAccess(weddingId);
  try {
    const { token } = await generateInvitationForGroup(weddingId, groupId);
    revalidatePath(`/app/weddings/${weddingId}/rsvps`);
    revalidatePath(`/app/weddings/${weddingId}/guests`);
    return { ok: true as const, token };
  } catch (e) {
    return { error: String((e as Error).message) };
  }
}

export async function generateAllInvitations(weddingId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: groups } = await supabase.from("guest_groups").select("id").eq("wedding_id", weddingId);
  const { data: existing } = await supabase.from("guest_invitations").select("group_id").eq("wedding_id", weddingId);
  const have = new Set((existing ?? []).map((i) => i.group_id));
  let created = 0;
  for (const g of groups ?? []) {
    if (!have.has(g.id)) {
      try {
        await generateInvitationForGroup(weddingId, g.id);
        created++;
      } catch {
        /* keep going; report count */
      }
    }
  }
  revalidatePath(`/app/weddings/${weddingId}/rsvps`);
  return { ok: true as const, created };
}

export async function markInvitationSent(weddingId: string, invitationId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("guest_invitations")
    .update({ status: "sent", sent_at: new Date().toISOString(), issued_at: supabaseRawNow() })
    .eq("id", invitationId)
    .eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/rsvps`);
  return { ok: true as const };
}

function supabaseRawNow() {
  return new Date().toISOString();
}

export async function markInvitationContacted(weddingId: string, invitationId: string, notes?: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = { last_contacted_at: new Date().toISOString() };
  if (notes !== undefined) patch.follow_up_notes = notes;
  const { error } = await supabase.from("guest_invitations").update(patch).eq("id", invitationId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/rsvps`);
  return { ok: true as const };
}

export async function setInvitationFollowUp(weddingId: string, invitationId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("guest_invitations").update({ status: "follow_up" }).eq("id", invitationId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/rsvps`);
  return { ok: true as const };
}

export async function revokeInvitationAction(weddingId: string, invitationId: string) {
  await requireWeddingAccess(weddingId);
  try {
    await revokeInvitation(invitationId);
    revalidatePath(`/app/weddings/${weddingId}/rsvps`);
    return { ok: true as const };
  } catch (e) {
    return { error: String((e as Error).message) };
  }
}

export async function regenerateInvitationAction(weddingId: string, invitationId: string, groupId: string) {
  await requireWeddingAccess(weddingId);
  try {
    // Regeneration = new token on the same invitation row; the previous link stops resolving.
    const { generateInvitationForGroup: gen } = await import("@/lib/server/guests");
    await gen(weddingId, groupId);
    revalidatePath(`/app/weddings/${weddingId}/rsvps`);
    return { ok: true as const };
  } catch (e) {
    return { error: String((e as Error).message) };
  }
}

export async function restoreInvitationAction(weddingId: string, invitationId: string) {
  await requireWeddingAccess(weddingId);
  try {
    const token = await restoreInvitation(invitationId);
    revalidatePath(`/app/weddings/${weddingId}/rsvps`);
    return { ok: true as const, token };
  } catch (e) {
    return { error: String((e as Error).message) };
  }
}

export async function updateGreeting(weddingId: string, invitationId: string, greeting: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("guest_invitations")
    .update({ greeting_name: greeting.trim() || null })
    .eq("id", invitationId)
    .eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/rsvps`);
  return { ok: true as const };
}

/** Planner-side administrative RSVP correction (works even after deadline). */
export async function adminUpdateRsvp(
  weddingId: string,
  responseId: string,
  input: { status?: string; attending_count?: number },
) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: existing } = await supabase.from("rsvp_responses").select("*").eq("id", responseId).eq("wedding_id", weddingId).single();
  if (!existing) return { error: "Response not found" };

  const patch: Record<string, unknown> = { edited_after_deadline: true };
  if (input.status) patch.status = input.status;
  if (input.attending_count != null) {
    const { data: inv } = await supabase
      .from("guest_invitations")
      .select("max_pax")
      .eq("id", existing.invitation_id)
      .single();
    const cap = inv?.max_pax ?? 99;
    patch.attending_count = Math.min(Math.max(0, Number(input.attending_count)), cap);
  }
  if (patch.status === "declined") patch.attending_count = 0;

  const { error } = await supabase.from("rsvp_responses").update(patch).eq("id", responseId);
  if (error) return { error: error.message };

  await supabase.from("rsvp_response_history").insert({
    wedding_id: weddingId,
    response_id: responseId,
    invitation_id: existing.invitation_id,
    change_type: "admin_changed",
    snapshot: { status: existing.status, attendingCount: existing.attending_count },
  });

  if (patch.status) {
    await supabase
      .from("guest_invitations")
      .update({ status: patch.status === "confirmed" ? "confirmed" : "declined" })
      .eq("id", existing.invitation_id);
  }

  revalidatePath(`/app/weddings/${weddingId}/rsvps`);
  revalidatePath(`/app/weddings/${weddingId}`);
  return { ok: true as const };
}
