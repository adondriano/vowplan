import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Wedding, WeddingMember, WeddingRole } from "@/lib/domain/types";
import { DEFAULT_TASK_TEMPLATES, BUDGET_CATEGORY_DEFAULTS, dueDateFromTemplate } from "@/lib/domain/task-templates";
import { parseInvitationContent } from "@/lib/domain/invitation";

export type AuthContext = {
  user: { id: string; email?: string };
  profile: { id: string; display_name: string | null; preferred_currency: string } | null;
};

export async function requireUser(): Promise<AuthContext> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { user: { id: user.id, email: user.email }, profile: null };
}

export type WeddingAccess = {
  wedding: Wedding;
  role: WeddingRole;
  members: WeddingMember[];
};

/** Loads a wedding and verifies the signed-in user is a member (RLS double-check). */
export async function requireWeddingAccess(weddingId: string): Promise<WeddingAccess> {
  const { user } = await requireUser();
  const supabase = await createServerClient();

  const { data: wedding, error } = await supabase
    .from("weddings")
    .select("*")
    .eq("id", weddingId)
    .maybeSingle();
  if (error || !wedding) redirect("/app");

  const { data: members } = await supabase
    .from("wedding_members")
    .select("*")
    .eq("wedding_id", weddingId);
  const role: WeddingRole =
    wedding.owner_id === user.id
      ? "owner"
      : ((members?.find((m) => m.user_id === user.id && m.status === "active")?.role as WeddingRole) ?? "viewer");

  return {
    wedding: wedding as Wedding,
    role,
    members: (members ?? []) as WeddingMember[],
  };
}

/** All workspaces the user owns or belongs to (pending invites included). */
export async function listWeddingsForUser() {
  const { user } = await requireUser();
  const supabase = await createServerClient();

  const { data: owned } = await supabase
    .from("weddings")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const { data: memberships } = await supabase
    .from("wedding_members")
    .select("wedding_id, status, role")
    .eq("email", user.email ?? "\u0000");

  const memberIds = (memberships ?? []).filter((m) => m.status === "active").map((m) => m.wedding_id);
  const pendingInvites = (memberships ?? []).filter((m) => m.status === "invited");

  let shared: Wedding[] = [];
  if (memberIds.length) {
    const { data } = await supabase.from("weddings").select("*").in("id", memberIds);
    shared = (data ?? []) as Wedding[];
  }

  const ownedList = (owned ?? []) as Wedding[];
  const seen = new Set(ownedList.map((w) => w.id));
  return {
    weddings: [...ownedList, ...shared.filter((w) => !seen.has(w.id))],
    pendingInvites,
    email: user.email ?? "",
    userId: user.id,
  };
}

export async function ensureProfile(displayName?: string | null) {
  const { user } = await requireUser();
  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return existing;
  const { data: created } = await supabase
    .from("profiles")
    .insert({ id: user.id, display_name: displayName ?? user.email ?? null })
    .select()
    .single();
  return created;
}

export type OnboardingInput = {
  brideName: string;
  groomName: string;
  partner1Label?: string;
  partner2Label?: string;
  weddingDate?: string | null;
  dateStatus: "tentative" | "confirmed" | "undecided";
  location?: string | null;
  currency: string;
  guestCountEstimate?: number | null;
  totalBudget?: number | null;
  weddingStyle?: string | null;
  rsvpDeadline?: string | null;
  createDefaults: boolean;
};

/** Creates a wedding workspace plus its default tasks and budget categories. */
export async function createWeddingWorkspace(input: OnboardingInput): Promise<Wedding> {
  const { user } = await requireUser();
  const supabase = await createServerClient();

  const content = parseInvitationContent({
    coverHeading: `${input.brideName} & ${input.groomName}`.trim(),
    monogramText: monogramFromNames(input.brideName, input.groomName),
  });

  const { data: wedding, error } = await supabase
    .from("weddings")
    .insert({
      owner_id: user.id,
      bride_name: input.brideName,
      groom_name: input.groomName,
      partner1_label: input.partner1Label || "Bride",
      partner2_label: input.partner2Label || "Groom",
      wedding_date: input.dateStatus === "undecided" ? null : (input.weddingDate ?? null),
      date_status: input.dateStatus,
      location: input.location ?? null,
      currency: input.currency || "PHP",
      guest_count_estimate: input.guestCountEstimate ?? null,
      total_budget: input.totalBudget ?? null,
      wedding_style: input.weddingStyle ?? null,
      rsvp_deadline: input.rsvpDeadline ?? null,
      invitation_config: content,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const wid = wedding.id;

  // Add the creating user as owner member (self row, keeps membership queries simple).
  await supabase.from("wedding_members").insert({
    wedding_id: wid,
    user_id: user.id,
    email: user.email ?? "",
    role: "owner",
    status: "active",
  });

  if (input.createDefaults !== false) {
    // Default budget categories
    await supabase.from("budget_categories").insert(
      BUDGET_CATEGORY_DEFAULTS.map((name, i) => ({ wedding_id: wid, name, sort_order: i })),
    );

    // Default checklist from rule-based templates
    const rows = DEFAULT_TASK_TEMPLATES.map((t) => ({
      wedding_id: wid,
      title: t.title,
      description: t.description ?? null,
      category: t.category,
      priority: t.priority,
      due_date: dueDateFromTemplate(t, input.dateStatus === "undecided" ? null : (input.weddingDate ?? null)),
      relative_days: t.relativeDays,
      is_template: true,
    }));
    await supabase.from("wedding_tasks").insert(rows);

    // Wedding-day schedule skeleton (not public by default)
    await supabase.from("wedding_events").insert(
      [
        { title: "Hair & makeup", sort_order: 10 },
        { title: "Photography preparation", sort_order: 20 },
        { title: "Guest arrival", sort_order: 30 },
        { title: "Ceremony", sort_order: 40 },
        { title: "Cocktail & transition", sort_order: 50 },
        { title: "Reception entrance", sort_order: 60 },
        { title: "Dinner", sort_order: 70 },
        { title: "Speeches & toasts", sort_order: 80 },
        { title: "First dance", sort_order: 90 },
        { title: "Cake cutting", sort_order: 100 },
      ].map((e) => ({ ...e, wedding_id: wid, event_type: "wedding_day" as const })),
    );
  }

  return wedding as Wedding;
}

export function monogramFromNames(a?: string | null, b?: string | null): string {
  const initial = (s?: string | null) => (s ?? "").trim().charAt(0).toUpperCase();
  const ia = initial(a);
  const ib = initial(b);
  if (ia && ib) return `${ia} & ${ib}`;
  return ia || ib || "";
}

/**
 * Date change behavior:
 *  - historical records preserved; only template tasks with relative_days and
 *    explicit opt-in are recalculated; the wedding-day schedule follows the
 *    single event_date when it matches the old wedding date.
 */
export async function changeWeddingDate(
  weddingId: string,
  newDate: string | null,
  opts: { rescheduleTemplateTasks: boolean },
): Promise<{ rescheduledTasks: number }> {
  const supabase = await createServerClient();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, wedding_date")
    .eq("id", weddingId)
    .single();

  const oldDate = wedding?.wedding_date as string | null;

  const { error } = await supabase
    .from("weddings")
    .update({ wedding_date: newDate })
    .eq("id", weddingId);
  if (error) throw new Error(error.message);

  let rescheduledTasks = 0;
  if (opts.rescheduleTemplateTasks && newDate) {
    const { data: templates } = await supabase
      .from("wedding_tasks")
      .select("id, relative_days")
      .eq("wedding_id", weddingId)
      .not("relative_days", "is", null);
    for (const t of templates ?? []) {
      const due = dueDateFromTemplate(
        { title: "", category: "", priority: "medium", relativeDays: t.relative_days },
        newDate,
      );
      if (due) {
        await supabase.from("wedding_tasks").update({ due_date: due }).eq("id", t.id);
        rescheduledTasks += 1;
      }
    }
  }

  // Move wedding-day events dated as the old wedding date to the new one.
  if (oldDate && newDate) {
    await supabase
      .from("wedding_events")
      .update({ event_date: newDate })
      .eq("wedding_id", weddingId)
      .eq("event_date", oldDate);
  }

  await supabase.from("wedding_audit_events").insert({
    wedding_id: weddingId,
    action: "date_changed",
    entity: "wedding",
    entity_id: weddingId,
    metadata: { from: oldDate, to: newDate, rescheduledTasks },
  });

  return { rescheduledTasks };
}
