"use server";
import { createServerClient } from "@/lib/supabase/server";
import { requireWeddingAccess } from "@/lib/server/weddings";
import { revalidatePath } from "next/cache";

/* ---- Vendors ---- */
export type VendorInput = {
  name: string;
  category?: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  social_link?: string | null;
  quoted_price?: number | null;
  contracted_price?: number | null;
  booking_status?: string;
  rating?: number | null;
  meeting_date?: string | null;
  payment_terms?: string | null;
  includes_notes?: string | null;
  notes?: string | null;
};

export async function createVendor(weddingId: string, input: VendorInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("vendors")
    .insert({ wedding_id: weddingId, name: input.name.trim(), ...normalizeVendor(input) })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/vendors`);
  return { ok: true as const, id: data.id as string };
}

export async function updateVendor(weddingId: string, vendorId: string, input: Partial<VendorInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = { ...normalizeVendor(input) };
  if (input.name != null) patch.name = input.name.trim();
  const { error } = await supabase.from("vendors").update(patch).eq("id", vendorId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/vendors`);
  return { ok: true as const };
}

export async function deleteVendor(weddingId: string, vendorId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("vendors").delete().eq("id", vendorId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/vendors`);
  return { ok: true as const };
}

function normalizeVendor(input: Partial<VendorInput>) {
  return {
    category: input.category || "Other",
    contact_person: input.contact_person ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    website: input.website ?? null,
    address: input.address ?? null,
    social_link: input.social_link ?? null,
    quoted_price: input.quoted_price ?? null,
    contracted_price: input.contracted_price ?? null,
    booking_status: input.booking_status || "considering",
    rating: input.rating ?? null,
    meeting_date: input.meeting_date || null,
    payment_terms: input.payment_terms ?? null,
    includes_notes: input.includes_notes ?? null,
    notes: input.notes ?? null,
  };
}

/* ---- Venues ---- */
export type VenueInput = {
  name: string;
  venue_type?: string | null;
  role?: string;
  address?: string | null;
  map_url?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  capacity?: number | null;
  booking_status?: string;
  rental_price?: number | null;
  facilities?: string;
  setup_start?: string | null;
  teardown_end?: string | null;
  restrictions?: string | null;
  parking_notes?: string | null;
  accessibility_notes?: string | null;
  transit_notes?: string | null;
  accommodation_notes?: string | null;
  vendor_id?: string | null;
  is_public?: boolean;
};

export async function createVenue(weddingId: string, input: VenueInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("venues")
    .insert({ wedding_id: weddingId, name: input.name.trim(), ...normalizeVenue(input) })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/venues`);
  return { ok: true as const, id: data.id as string };
}

export async function updateVenue(weddingId: string, venueId: string, input: Partial<VenueInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = { ...normalizeVenue(input) };
  if (input.name != null) patch.name = input.name.trim();
  const { error } = await supabase.from("venues").update(patch).eq("id", venueId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/venues`);
  revalidatePath(`/app/weddings/${weddingId}/invitation`);
  return { ok: true as const };
}

export async function deleteVenue(weddingId: string, venueId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("venues").delete().eq("id", venueId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/venues`);
  return { ok: true as const };
}

function normalizeVenue(input: Partial<VenueInput>) {
  return {
    venue_type: input.venue_type ?? null,
    role: input.role || "reception",
    address: input.address ?? null,
    map_url: input.map_url ?? null,
    contact_name: input.contact_name ?? null,
    contact_phone: input.contact_phone ?? null,
    contact_email: input.contact_email ?? null,
    capacity: input.capacity ?? null,
    booking_status: input.booking_status || "considering",
    rental_price: input.rental_price ?? null,
    facilities: input.facilities ?? "",
    setup_start: input.setup_start || null,
    teardown_end: input.teardown_end || null,
    restrictions: input.restrictions ?? null,
    parking_notes: input.parking_notes ?? null,
    accessibility_notes: input.accessibility_notes ?? null,
    transit_notes: input.transit_notes ?? null,
    accommodation_notes: input.accommodation_notes ?? null,
    vendor_id: input.vendor_id || null,
    is_public: input.is_public ?? false,
  };
}

/* ---- Seating ---- */
export async function createTable(weddingId: string, input: { name: string; capacity: number; location?: string | null; shape?: string }) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("seating_tables")
    .insert({
      wedding_id: weddingId,
      name: input.name.trim(),
      capacity: Math.max(1, Number(input.capacity) || 8),
      location: input.location ?? null,
      shape: input.shape || "round",
    })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/seating`);
  return { ok: true as const, id: data.id as string };
}

export async function updateTable(weddingId: string, tableId: string, input: { name?: string; capacity?: number; location?: string | null; notes?: string | null }) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = {};
  if (input.name != null) patch.name = input.name.trim();
  if (input.capacity != null) patch.capacity = Math.max(1, Number(input.capacity));
  if (input.location !== undefined) patch.location = input.location;
  if (input.notes !== undefined) patch.notes = input.notes;
  const { error } = await supabase.from("seating_tables").update(patch).eq("id", tableId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/seating`);
  return { ok: true as const };
}

export async function deleteTable(weddingId: string, tableId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("seating_tables").delete().eq("id", tableId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/seating`);
  return { ok: true as const };
}

export async function assignGuestToTable(weddingId: string, guestId: string, tableId: string | null, tentative = false) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  if (tableId === null) {
    await supabase.from("guest_table_assignments").delete().eq("guest_id", guestId).eq("wedding_id", weddingId);
  } else {
    const { data: table } = await supabase.from("seating_tables").select("id").eq("id", tableId).eq("wedding_id", weddingId).single();
    if (!table) return { error: "Table not found" };
    await supabase.from("guest_table_assignments").upsert(
      { wedding_id: weddingId, guest_id: guestId, table_id: tableId, is_tentative: tentative },
      { onConflict: "guest_id" },
    );
  }
  revalidatePath(`/app/weddings/${weddingId}/seating`);
  return { ok: true as const };
}

/* ---- Wedding party ---- */
export type PartyInput = {
  name: string;
  role?: string;
  side?: string;
  email?: string | null;
  phone?: string | null;
  attire_notes?: string | null;
  responsibilities?: string | null;
  rehearsal?: boolean;
  ceremony_position?: string | null;
  fitting_date?: string | null;
  notes?: string | null;
};

export async function createPartyMember(weddingId: string, input: PartyInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("wedding_party_members").insert({
    wedding_id: weddingId,
    name: input.name.trim(),
    role: input.role || "Bridesmaid",
    side: input.side || "both",
    email: input.email ?? null,
    phone: input.phone ?? null,
    attire_notes: input.attire_notes ?? null,
    responsibilities: input.responsibilities ?? null,
    rehearsal: input.rehearsal ?? false,
    ceremony_position: input.ceremony_position ?? null,
    fitting_date: input.fitting_date || null,
    notes: input.notes ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/wedding-party`);
  return { ok: true as const };
}

export async function updatePartyMember(weddingId: string, memberId: string, input: Partial<PartyInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch = { ...input };
  if (input.name != null) patch.name = input.name.trim();
  const { error } = await supabase.from("wedding_party_members").update(patch).eq("id", memberId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/wedding-party`);
  return { ok: true as const };
}

export async function deletePartyMember(weddingId: string, memberId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("wedding_party_members").delete().eq("id", memberId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/wedding-party`);
  return { ok: true as const };
}

/* ---- Decisions ---- */
export type DecisionInput = {
  title: string;
  description?: string | null;
  decision_date?: string | null;
  category?: string | null;
  responsible?: string | null;
  status?: string;
  notes?: string | null;
};

export async function createDecision(weddingId: string, input: DecisionInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("decisions").insert({
    wedding_id: weddingId,
    title: input.title.trim(),
    description: input.description ?? null,
    decision_date: input.decision_date || new Date().toISOString().slice(0, 10),
    category: input.category ?? null,
    responsible: input.responsible ?? null,
    status: input.status || "proposed",
    notes: input.notes ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/notes`);
  return { ok: true as const };
}

export async function updateDecision(weddingId: string, decisionId: string, input: Partial<DecisionInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch = { ...input };
  if (input.title != null) patch.title = input.title.trim();
  const { error } = await supabase.from("decisions").update(patch).eq("id", decisionId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/notes`);
  return { ok: true as const };
}

export async function deleteDecision(weddingId: string, decisionId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("decisions").delete().eq("id", decisionId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/notes`);
  return { ok: true as const };
}

/* ---- Members / collaboration ---- */
export async function inviteMember(weddingId: string, email: string, role: string) {
  const access = await requireWeddingAccess(weddingId);
  if (access.role !== "owner") return { error: "Only the workspace owner can invite collaborators." };
  const supabase = await createServerClient();
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Enter a valid email address." };

  // Pending invite keyed by email; it activates when that person signs up (or
  // is signed in) with this email and accepts the invite from their workspace
  // list. No email provider required — the invite surfaces in their planner.
  const { error } = await supabase.from("wedding_members").insert({
    wedding_id: weddingId,
    email: clean,
    role: role === "viewer" ? "viewer" : "co_planner",
    status: "invited",
  });
  if (error) {
    if (error.message.includes("duplicate")) return { error: "That email is already on this workspace." };
    return { error: error.message };
  }
  revalidatePath(`/app/weddings/${weddingId}/settings`);
  return { ok: true as const };
}

export async function updateMemberRole(weddingId: string, memberId: string, role: string) {
  const access = await requireWeddingAccess(weddingId);
  if (access.role !== "owner") return { error: "Only the workspace owner can change roles." };
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("wedding_members")
    .update({ role: role === "viewer" ? "viewer" : role === "owner" ? "co_planner" : role })
    .eq("id", memberId)
    .eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/settings`);
  return { ok: true as const };
}

export async function removeMember(weddingId: string, memberId: string) {
  const access = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: member } = await supabase.from("wedding_members").select("user_id, role").eq("id", memberId).eq("wedding_id", weddingId).single();
  if (!member) return { error: "Member not found." };
  const isSelf = member.user_id === (await supabase.auth.getUser()).data.user?.id;
  if (access.role !== "owner" && !isSelf) return { error: "Only the workspace owner can remove collaborators." };
  const { error } = await supabase.from("wedding_members").delete().eq("id", memberId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/settings`);
  return { ok: true as const };
}

export async function acceptWorkspaceInvite(weddingId: string) {
  const { requireUser } = await import("@/lib/server/weddings");
  const { user } = await requireUser();
  const supabase = await createServerClient();
  const { data: member, error } = await supabase
    .from("wedding_members")
    .update({ status: "active", user_id: user.id })
    .eq("wedding_id", weddingId)
    .eq("email", (user.email ?? "").toLowerCase())
    .eq("status", "invited")
    .select()
    .single();
  if (error || !member) return { error: "No pending invitation found for this email." };
  revalidatePath("/app");
  revalidatePath(`/app/weddings/${weddingId}`);
  return { ok: true as const };
}

export async function declineWorkspaceInvite(weddingId: string) {
  const { requireUser } = await import("@/lib/server/weddings");
  const { user } = await requireUser();
  const supabase = await createServerClient();
  await supabase
    .from("wedding_members")
    .update({ status: "declined" })
    .eq("wedding_id", weddingId)
    .eq("email", (user.email ?? "").toLowerCase())
    .eq("status", "invited");
  revalidatePath("/app");
  return { ok: true as const };
}
