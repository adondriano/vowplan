"use server";
import { createServerClient } from "@/lib/supabase/server";
import { requireWeddingAccess } from "@/lib/server/weddings";
import { revalidatePath } from "next/cache";

export type EventInput = {
  title: string;
  event_type: "planning_milestone" | "wedding_day";
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  description?: string | null;
  coordinator?: string | null;
  vendor_id?: string | null;
  sort_order?: number;
  is_public?: boolean;
};

export async function createEvent(weddingId: string, input: EventInput) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("wedding_events").insert({ wedding_id: weddingId, ...input });
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/timeline`);
  revalidatePath(`/app/weddings/${weddingId}/invitation`);
  return { ok: true };
}

export async function updateEvent(weddingId: string, eventId: string, input: Partial<EventInput>) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("wedding_events").update(input).eq("id", eventId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/timeline`);
  revalidatePath(`/app/weddings/${weddingId}/invitation`);
  return { ok: true };
}

export async function deleteEvent(weddingId: string, eventId: string) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  const { error } = await supabase.from("wedding_events").delete().eq("id", eventId).eq("wedding_id", weddingId);
  if (error) return { error: error.message };
  revalidatePath(`/app/weddings/${weddingId}/timeline`);
  return { ok: true };
}

export async function reorderEvents(weddingId: string, orderedIds: string[]) {
  await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from("wedding_events").update({ sort_order: (i + 1) * 10 }).eq("id", orderedIds[i]).eq("wedding_id", weddingId);
  }
  revalidatePath(`/app/weddings/${weddingId}/timeline`);
  return { ok: true };
}
