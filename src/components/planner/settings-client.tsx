"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Download, Trash2, UserPlus, Loader2, Archive, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateWeddingSettings, updateWeddingDate, updateRsvpSettings, updateProfileSettings, setPublicSlug } from "@/lib/actions/settings";
import { inviteMember, updateMemberRole, removeMember } from "@/lib/actions/directory";
import { deleteWeddingCloudData } from "@/lib/actions/archive";
import type { Wedding, WeddingMember, WeddingRole } from "@/lib/domain/types";

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY"];

export function SettingsClient({
  wedding,
  role,
  members,
  profile,
  email,
}: {
  wedding: Wedding;
  role: WeddingRole;
  members: WeddingMember[];
  profile: { displayName: string; currency: string };
  email: string;
}) {
  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Workspace details, sharing, exports, and data controls.</p>
      </header>

      <WeddingDetailsCard wedding={wedding} canEdit={role !== "viewer"} />
      <RsvpRulesCard wedding={wedding} canEdit={role !== "viewer"} />
      <SharingCard wedding={wedding} canEdit={role !== "viewer"} />
      <ProfileCard profile={profile} email={email} />
      <MembersCard weddingId={wedding.id} members={members} role={role} />
      <ArchiveCard weddingId={wedding.id} wedding={wedding} role={role} />
    </div>
  );
}

/* ---------------------------------- Details --------------------------------- */

function WeddingDetailsCard({ wedding, canEdit }: { wedding: Wedding; canEdit: boolean }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [dateStatus, setDateStatus] = useState<DateStatus2>(wedding.date_status);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const newDate = String(fd.get("wedding_date") ?? "") || null;
    const status = String(fd.get("date_status") ?? wedding.date_status) as DateStatus2;
    const reschedule = fd.get("reschedule") === "on";

    const r1 = await updateWeddingSettings(wedding.id, {
      bride_name: String(fd.get("bride_name") ?? ""),
      groom_name: String(fd.get("groom_name") ?? ""),
      partner1_label: String(fd.get("partner1_label") ?? "") || undefined,
      partner2_label: String(fd.get("partner2_label") ?? "") || undefined,
      location: String(fd.get("location") ?? "") || null,
      currency: String(fd.get("currency") ?? wedding.currency),
      wedding_style: String(fd.get("wedding_style") ?? "") || null,
      guest_count_estimate: fd.get("guest_count_estimate") ? Number(fd.get("guest_count_estimate")) : null,
      total_budget: fd.get("total_budget") ? Number(fd.get("total_budget")) : null,
      contingency_pct: fd.get("contingency_pct") ? Number(fd.get("contingency_pct")) : wedding.contingency_pct,
      rsvp_deadline: String(fd.get("rsvp_deadline") ?? "") || null,
    });
    if ("error" in r1 && r1.error) {
      setBusy(false);
      return toast("error", r1.error);
    }
    const r2 = await updateWeddingDate(wedding.id, newDate, status, reschedule);
    setBusy(false);
    if ("error" in r2 && r2.error) return toast("error", r2.error);
    toast("success", "Wedding details saved." + (reschedule ? " Template tasks were rescheduled." : ""));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wedding details</CardTitle>
        <CardDescription>Names, date, budget frame, and deadlines used across every module.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" key={wedding.updated_at}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="s-bride" required>{wedding.partner1_label} name</Label><Input id="s-bride" name="bride_name" required defaultValue={wedding.bride_name} className="mt-1.5" disabled={!canEdit} /></div>
            <div><Label htmlFor="s-groom" required>{wedding.partner2_label} name</Label><Input id="s-groom" name="groom_name" required defaultValue={wedding.groom_name} className="mt-1.5" disabled={!canEdit} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="s-p1">Partner 1 display label</Label><Input id="s-p1" name="partner1_label" defaultValue={wedding.partner1_label} className="mt-1.5" disabled={!canEdit} /></div>
            <div><Label htmlFor="s-p2">Partner 2 display label</Label><Input id="s-p2" name="partner2_label" defaultValue={wedding.partner2_label} className="mt-1.5" disabled={!canEdit} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="s-date">Wedding date</Label>
              <Input id="s-date" name="wedding_date" type="date" defaultValue={wedding.wedding_date ?? ""} className="mt-1.5" disabled={!canEdit || dateStatus === "undecided"} />
            </div>
            <div>
              <Label htmlFor="s-dstatus">Date status</Label>
              <Select name="date_status" value={dateStatus} onValueChange={(v) => setDateStatus(v as DateStatus2)}>
                <SelectTrigger id="s-dstatus" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tentative">Tentative</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="undecided">Not set yet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="s-rsvp" hint="optional">RSVP deadline</Label><Input id="s-rsvp" name="rsvp_deadline" type="date" defaultValue={wedding.rsvp_deadline ?? ""} className="mt-1.5" disabled={!canEdit} /></div>
          </div>
          {wedding.wedding_date && (
            <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Checkbox name="reschedule" /> Also shift template tasks (relative-day checklist items) to the new date
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="s-loc" hint="optional">Location</Label><Input id="s-loc" name="location" defaultValue={wedding.location ?? ""} className="mt-1.5" disabled={!canEdit} placeholder="Tagaytay City, Cavite" /></div>
            <div><Label htmlFor="s-style" hint="optional">Style / theme</Label><Input id="s-style" name="wedding_style" defaultValue={wedding.wedding_style ?? ""} className="mt-1.5" disabled={!canEdit} placeholder="Garden, intimate" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="s-cur">Currency</Label>
              <Select name="currency" defaultValue={wedding.currency}>
                <SelectTrigger id="s-cur" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="s-guests">Guest estimate</Label><Input id="s-guests" name="guest_count_estimate" type="number" min="1" defaultValue={wedding.guest_count_estimate ?? ""} className="mt-1.5" disabled={!canEdit} /></div>
            <div><Label htmlFor="s-budget" hint="optional">Total budget</Label><Input id="s-budget" name="total_budget" type="number" min="0" step="0.01" defaultValue={wedding.total_budget ?? ""} className="mt-1.5" disabled={!canEdit} /></div>
            <div><Label htmlFor="s-cont" hint="%">Contingency</Label><Input id="s-cont" name="contingency_pct" type="number" min="0" max="100" defaultValue={wedding.contingency_pct} className="mt-1.5" disabled={!canEdit} /></div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!canEdit || busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />} Save details</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type DateStatus2 = "tentative" | "confirmed" | "undecided";

/* -------------------------------- RSVP rules -------------------------------- */

function RsvpRulesCard({ wedding, canEdit }: { wedding: Wedding; canEdit: boolean }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const s = wedding.rsvp_settings;
  const [state, setState] = useState({
    closed: s.closed ?? false,
    allowEdits: s.allowEdits ?? true,
    requirePerGuestAttendance: s.requirePerGuestAttendance ?? false,
    mealField: s.mealField ?? true,
    dietaryField: s.dietaryField ?? true,
    accessibilityField: s.accessibilityField ?? false,
    messageField: s.messageField ?? true,
    songField: s.songField ?? false,
    mealChoices: (s.mealChoices ?? []).join(", "),
  });

  async function save() {
    setBusy(true);
    const r = await updateRsvpSettings(wedding.id, {
      ...state,
      mealChoices: state.mealChoices.split(",").map((m) => m.trim()).filter(Boolean),
    });
    setBusy(false);
    if ("error" in r && r.error) toast("error", r.error);
    else toast("success", "RSVP rules saved. The public form updates immediately.");
  }

  const toggles: [keyof typeof state, string, string][] = [
    ["closed", "Close responses", "Guests see a closed notice instead of the form."],
    ["allowEdits", "Allow editing after submit", "Guests can change their response until the deadline."],
    ["requirePerGuestAttendance", "Per-guest attendance", "Each named invitee gets an attending toggle instead of a PAX stepper."],
    ["mealField", "Meal choice", "Ask guests to pick a meal from your choices."],
    ["dietaryField", "Dietary restrictions", "Free-text allergies and restrictions."],
    ["accessibilityField", "Accessibility needs", "Wheelchair access, seating, assistance."],
    ["messageField", "Message to the couple", "A note field on the form."],
    ["songField", "Song request", "Ask for a song to get people dancing."],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>RSVP form rules</CardTitle>
        <CardDescription>These drive the public /invite form fields and limits.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {toggles.map(([key, label, desc]) => (
            <label key={key} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <Switch
                checked={state[key] as boolean}
                onCheckedChange={(v) => setState((st) => ({ ...st, [key]: v }))}
                disabled={!canEdit}
                aria-label={label}
              />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="max-w-md">
          <Label htmlFor="s-meals" hint="comma-separated">Meal choices</Label>
          <Input id="s-meals" value={state.mealChoices} onChange={(e) => setState((st) => ({ ...st, mealChoices: e.target.value }))} className="mt-1.5" disabled={!canEdit} placeholder="Beef, Chicken, Fish, Vegetarian" />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!canEdit || busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />} Save rules</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Sharing ---------------------------------- */

function SharingCard({ wedding, canEdit }: { wedding: Wedding; canEdit: boolean }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState(wedding.public_slug ?? "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/invite/${slug ? slug : `your-code`}`;

  async function saveSlug() {
    setBusy(true);
    const r = await setPublicSlug(wedding.id, slug || null);
    setBusy(false);
    if ("error" in r && r.error) toast("error", r.error);
    else toast("success", "Share link saved.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share link</CardTitle>
        <CardDescription>
          An optional memorable alias for your invitation. The private per-household token links (with QR codes) always work regardless of this.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <Label htmlFor="s-slug" hint="lowercase letters, numbers, dashes">Public slug</Label>
            <Input id="s-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="ana-and-miguel" className="mt-1.5" disabled={!canEdit} maxLength={60} />
          </div>
          <Button onClick={saveSlug} disabled={!canEdit || busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />} Save</Button>
        </div>
        <p className="text-xs text-muted-foreground">Alias form: <code className="rounded bg-surface-warm px-1.5 py-0.5">{shareUrl}</code></p>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------- Profile --------------------------------- */

function ProfileCard({ profile, email }: { profile: { displayName: string; currency: string }; email: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await updateProfileSettings(String(fd.get("display_name") ?? ""), String(fd.get("currency") ?? "PHP"));
    setBusy(false);
    if ("error" in r && r.error) toast("error", r.error);
    else toast("success", "Profile saved.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
        <CardDescription>Signed in as {email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="s-dname">Display name</Label>
            <Input id="s-dname" name="display_name" defaultValue={profile.displayName} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="s-pcur">Preferred currency</Label>
            <Select name="currency" defaultValue={profile.currency}>
              <SelectTrigger id="s-pcur" className="mt-1.5 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />} Save profile</Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Members ---------------------------------- */

function MembersCard({ weddingId, members, role }: { weddingId: string; members: WeddingMember[]; role: WeddingRole }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("co_planner");

  function invite() {
    startTransition(async () => {
      const r = await inviteMember(weddingId, inviteEmail, inviteRole);
      if ("error" in r && r.error) toast("error", r.error);
      else {
        toast("success", `Invite created for ${inviteEmail}. They'll see it when they sign up with that email.`);
        setInviteEmail("");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaborators</CardTitle>
        <CardDescription>Co-planners edit everything; viewers read only. Invites activate when the person signs up with that email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {role === "owner" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Label htmlFor="s-invite">Invite by email</Label>
              <Input id="s-invite" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="planner@example.com" className="mt-1.5" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="mt-1.5 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="co_planner">Co-planner</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={invite} disabled={pending || !inviteEmail}><UserPlus className="size-4" aria-hidden="true" /> Invite</Button>
          </div>
        )}
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="font-medium">{m.email}</span>
                <Badge tone={m.status === "active" ? "success" : m.status === "invited" ? "warning" : "neutral"}>{m.status}</Badge>
              </span>
              <span className="flex items-center gap-2">
                {m.role === "owner" ? (
                  <Badge tone="primary">owner</Badge>
                ) : role === "owner" ? (
                  <>
                    <Select value={m.role} onValueChange={(v) => startTransition(async () => { const r = await updateMemberRole(weddingId, m.id, v); if ("error" in r && r.error) toast("error", r.error); else router.refresh(); })}>
                      <SelectTrigger className="h-8 w-32" aria-label={`Role for ${m.email}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="co_planner">Co-planner</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${m.email}`} className="hover:text-destructive" onClick={() => { if (confirm(`Remove ${m.email}?`)) startTransition(async () => { const r = await removeMember(weddingId, m.id); if ("error" in r && r.error) toast("error", r.error); else router.refresh(); }); }}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </>
                ) : (
                  <Badge tone="neutral">{m.role}</Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Archive & danger zone -------------------------- */

function ArchiveCard({ weddingId, wedding, role }: { weddingId: string; wedding: Wedding; role: WeddingRole }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [exporting, setExporting] = useState(false);

  async function exportZip() {
    setExporting(true);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/archive`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast("error", body.error ?? `Export failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `vowplan-${wedding.bride_name}-${wedding.groom_name}-${stamp}.zip`.replace(/\s+/g, "-").toLowerCase();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast("success", "Archive downloaded. It contains your data + documents as JSON + CSV + files.");
    } finally {
      setExporting(false);
    }
  }

  async function destroy() {
    setBusy(true);
    const r = await deleteWeddingCloudData(weddingId, phrase);
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    toast("success", "Workspace deleted. Redirecting…");
    window.location.href = "/app";
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Archive className="size-5 text-primary" aria-hidden="true" /> Export &amp; delete</CardTitle>
        <CardDescription>Take everything with you, or erase the cloud copy for good.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="text-sm">
            <p className="font-medium">Download full archive (ZIP)</p>
            <p className="text-xs text-muted-foreground">JSON data, CSV summaries, and your documents &amp; inspiration images.</p>
          </div>
          <Button variant="outline" onClick={exportZip} disabled={exporting}>{exporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />} Export ZIP</Button>
        </div>

        {role === "owner" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive"><ShieldAlert className="size-4" aria-hidden="true" /> Delete cloud workspace</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanently deletes every record and uploaded file for this wedding from the cloud. This cannot be undone — export first.
              Type <strong>DELETE MY WEDDING</strong> to confirm.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} className="max-w-xs" placeholder="DELETE MY WEDDING" aria-label="Confirmation phrase" />
              <Button variant="destructive" disabled={busy || phrase.trim().toUpperCase() !== "DELETE MY WEDDING"} onClick={destroy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />} Delete everything
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
