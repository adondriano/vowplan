"use server";
import { createServerClient } from "@/lib/supabase/server";
import { requireWeddingAccess } from "@/lib/server/weddings";
import { revalidatePath } from "next/cache";
import { invitationContentSchema, invitationThemeSchema, parseInvitationContent, parseInvitationTheme } from "@/lib/domain/invitation";
import { changeWeddingDate } from "@/lib/server/weddings";

export type WeddingSettingsInput = {
  bride_name?: string;
  groom_name?: string;
  partner1_label?: string;
  partner2_label?: string;
  location?: string | null;
  currency?: string;
  total_budget?: number | null;
  contingency_pct?: number;
  guest_count_estimate?: number | null;
  rsvp_deadline?: string | null;
  wedding_style?: string | null;
  public_slug?: string | null;
};

export async function updateWeddingSettings(weddingId: string, input: WeddingSettingsInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = { ...input };
  if (input.bride_name != null) patch.bride_name = input.bride_name.trim();
  if (input.groom_name != null) patch.groom_name = input.groom_name.trim();
  if (input.total_budget != null) patch.total_budget = input.total_budget;
  if (input.contingency_pct != null) patch.contingency_pct = Math.min(100, Math.max(0, Number(input.contingency_pct)));
  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}`, "layout");
  return { ok: true as const };
}

export async function updateWeddingDate(
  weddingId: string,
  newDate: string | null,
  dateStatus: "tentative" | "confirmed" | "undecided",
  rescheduleTasks: boolean,
) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  if (dateStatus === "undecided" || !newDate) {
    const { error } = await supabase.from("weddings").update({ wedding_date: null, date_status: dateStatus }).eq("id", weddingId);
    if (error) return { error: error.message };
  } else {
    try {
      await changeWeddingDate(weddingId, newDate, { rescheduleTemplateTasks: rescheduleTasks });
      await supabase.from("weddings").update({ date_status: dateStatus }).eq("id", weddingId);
    } catch (e) {
      return { error: String((e as Error).message) };
    }
  }
  revalidatePath(`/app/weddings/${weddingId}`, "layout");
  return { ok: true as const };
}

export async function updateRsvpSettings(weddingId: string, settings: Record<string, unknown>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: wedding } = await supabase.from("weddings").select("rsvp_settings").eq("id", weddingId).single();
  const merged = { ...(wedding?.rsvp_settings ?? {}), ...settings };
  const { error } = await supabase.from("weddings").update({ rsvp_settings: merged }).eq("id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/settings`);
  revalidatePath(`/app/weddings/${weddingId}/invitation`);
  return { ok: true as const };
}

export async function updateProfileSettings(displayName: string, currency: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim() || null, preferred_currency: currency || "PHP" })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true as const };
}

/* ---------------- Invitation content: draft / publish workflow ---------------- */

/** Saves a draft (unpublished version). Does not change the live invitation. */
export async function saveInvitationDraft(
  weddingId: string,
  content: unknown,
  theme: unknown,
): Promise<{ ok?: true; error?: string; versionId?: string }> {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();

  const parsedContent = invitationContentSchema.safeParse(content);
  if (!parsedContent.success) return { error: parsedContent.error.issues[0]?.message ?? "Invalid invitation content" };
  const parsedTheme = invitationThemeSchema.safeParse(theme);
  if (!parsedTheme.success) return { error: parsedTheme.error.issues[0]?.message ?? "Invalid theme" };

  const { data: last } = await supabase
    .from("invitation_versions")
    .select("version")
    .eq("wedding_id", weddingId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = (last?.[0]?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from("invitation_versions")
    .insert({
      wedding_id: weddingId,
      version: nextVersion,
      content: parsedContent.data,
      theme: parsedTheme.data,
      published: false,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  // Mirror config on the wedding row for the settings UI.
  await supabase
    .from("weddings")
    .update({ invitation_config: parsedContent.data })
    .eq("id", weddingId);

  revalidatePath(`/app/weddings/${weddingId}/invitation`);
  return { ok: true, versionId: data.id };
}

/** Publishes a draft version; the previously published version is superseded. */
export async function publishInvitation(weddingId: string, versionId?: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();

  let target = versionId;
  if (!target) {
    const { data: latest } = await supabase
      .from("invitation_versions")
      .select("id")
      .eq("wedding_id", weddingId)
      .order("version", { ascending: false })
      .limit(1);
    target = latest?.[0]?.id;
  }
  if (!target) return { error: "Save a draft first." };

  // Version the publication: mark target published, supersede others.
  const { error: err1 } = await supabase
    .from("invitation_versions")
    .update({ published: false, published_at: null })
    .eq("wedding_id", weddingId)
    .neq("id", target);
  const { error: err2 } = await supabase
    .from("invitation_versions")
    .update({ published: true, published_at: new Date().toISOString() })
    .eq("id", target)
    .eq("wedding_id", weddingId);
  if (err1 || err2) return { error: (err1 ?? err2)!.message };

  await supabase.from("weddings").update({ invitation_published: true }).eq("id", weddingId);
  await supabase.from("wedding_audit_events").insert({
    wedding_id: weddingId,
    action: "invitation_published",
    entity: "invitation_version",
    entity_id: target,
  });

  revalidatePath(`/app/weddings/${weddingId}/invitation`);
  revalidatePath(`/app/weddings/${weddingId}`);
  return { ok: true as const };
}

export async function unpublishInvitation(weddingId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  await supabase.from("invitation_versions").update({ published: false }).eq("wedding_id", weddingId);
  await supabase.from("weddings").update({ invitation_published: false }).eq("id", weddingId);
  revalidatePath(`/app/weddings/${weddingId}/invitation`);
  return { ok: true as const };
}

export async function ensureInitialDraft(weddingId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { data: any } = await supabase
    .from("invitation_versions")
    .select("id")
    .eq("wedding_id", weddingId)
    .limit(1);
  if (any && any.length > 0) return { ok: true as const };
  const { data: wedding } = await supabase.from("weddings").select("invitation_config, wedding_date, date_status").eq("id", weddingId).single();
  const content = parseInvitationContent(wedding?.invitation_config ?? {});
  return saveInvitationDraft(weddingId, content, parseInvitationTheme({}));
}

export async function setPublicSlug(weddingId: string, slug: string | null) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const clean = slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || null;
  if (clean) {
    const { data: existing } = await supabase.from("weddings").select("id").eq("public_slug", clean).neq("id", weddingId).maybeSingle();
    if (existing) return { error: "That slug is already taken." };
  }
  const { error } = await supabase.from("weddings").update({ public_slug: clean }).eq("id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/settings`);
  return { ok: true as const };
}
