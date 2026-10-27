"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  Plus, Search, Upload, Download, Trash2, Pencil, Users, Link2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { GUEST_CATEGORIES } from "@/lib/domain/task-templates";
import { createGroup, updateGroup, deleteGroup, createGuest, deleteGuest, importGuestsCsv, bulkAssignCategory } from "@/lib/actions/guests";
import { generateInvitation } from "@/lib/actions/guests";
import type { Guest, GuestGroup, Invitation } from "@/lib/domain/types";

const SIDE_LABEL = { bride: "Bride's side", groom: "Groom's side", both: "Both", custom: "Custom" } as const;

type GroupWithStats = GuestGroup & {
  guests: Guest[];
  invitation?: Pick<Invitation, "id" | "status" | "max_pax">;
};

export function GuestsClient({
  weddingId,
  groups,
  guests,
  invitations,
}: {
  weddingId: string;
  currency: string;
  groups: GuestGroup[];
  guests: Guest[];
  invitations: Pick<Invitation, "id" | "group_id" | "status" | "max_pax">[];
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sideFilter, setSideFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GuestGroup | null>(null);
  const [managingGroup, setManagingGroup] = useState<GroupWithStats | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows: GroupWithStats[] = useMemo(() => {
    const invByGroup = new Map(invitations.map((i) => [i.group_id, i]));
    return groups
      .map((g) => ({
        ...g,
        guests: guests.filter((x) => x.group_id === g.id),
        invitation: invByGroup.get(g.id),
      }))
      .filter((g) => {
        if (categoryFilter !== "all" && g.category !== categoryFilter) return false;
        if (sideFilter !== "all" && g.side !== sideFilter) return false;
        if (search) {
          const hay = `${g.name} ${g.primary_contact_name ?? ""} ${g.guests.map((x) => `${x.first_name} ${x.last_name ?? ""}`).join(" ")}`.toLowerCase();
          if (!hay.includes(search.toLowerCase())) return false;
        }
        return true;
      });
  }, [groups, guests, invitations, search, categoryFilter, sideFilter]);

  const totalPeople = guests.length;
  const totalPax = groups.reduce((s, g) => s + g.invited_pax, 0);
  const ungrouped = guests.filter((g) => !g.group_id);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function onBulkCategory(cat: string) {
    if (selected.size === 0) return;
    startTransition(async () => {
      const r = await bulkAssignCategory(weddingId, Array.from(selected), cat);
      if ("error" in r && r.error) toast("error", r.error);
      else {
        toast("success", `${selected.size} ${selected.size === 1 ? "household" : "households"} recategorized.`);
        setSelected(new Set());
      }
    });
  }

  async function onBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} household(s) and their invitation links? Responses are kept for records.`)) return;
    startTransition(async () => {
      const { bulkDeleteGroups } = await import("@/lib/actions/guests");
      const r = await bulkDeleteGroups(weddingId, Array.from(selected));
      if ("error" in r && r.error) toast("error", r.error);
      else {
        toast("success", "Households removed.");
        setSelected(new Set());
      }
    });
  }

  async function onGenerateLink(groupId: string) {
    startTransition(async () => {
      const r = await generateInvitation(weddingId, groupId);
      if ("error" in r && r.error) toast("error", r.error);
      else toast("success", "Invitation link created — copy it from the RSVP Manager.");
    });
  }

  function exportCsv() {
    const header = ["group_name", "category", "side", "invited_pax", "first_name", "last_name", "email", "phone", "relationship", "invitation_status"];
    const lines = [header.join(",")];
    for (const g of rows) {
      const base = [g.name, g.category, g.side, g.invited_pax];
      if (g.guests.length === 0) {
        lines.push([g.name, g.category, g.side, g.invited_pax, "", "", g.primary_contact_email ?? "", g.primary_contact_phone ?? "", "", g.invitation?.status ?? ""].map(csvEsc).join(","));
      }
      for (const p of g.guests) {
        lines.push([...base, p.first_name, p.last_name ?? "", p.email ?? "", p.phone ?? "", p.relationship ?? "", g.invitation?.status ?? ""].map(csvEsc).join(","));
      }
    }
    downloadFile(`guests-${weddingId.slice(0, 8)}.csv`, lines.join("\r\n"), "text/csv");
  }

  async function onImportFile(file: File) {
    const text = await file.text();
    startTransition(async () => {
      const r = await importGuestsCsv(weddingId, text);
      if ("error" in r) {
        setImportResult(r.error);
        toast("error", r.error);
      } else {
        const msg = `Created ${r.groupsCreated} households and ${r.guestsCreated} guests${r.duplicatesSkipped ? ` · skipped ${r.duplicatesSkipped} duplicates` : ""}.`;
        setImportResult(msg);
        toast("success", msg);
      }
    });
  }

  async function onDeleteGroup(g: GroupWithStats) {
    if (!confirm(`Delete "${g.name}"${g.guests.length ? ` and ${g.guests.length} guest(s)` : ""}? Their invitation link will stop working.`)) return;
    startTransition(async () => {
      const r = await deleteGroup(weddingId, g.id);
      if ("error" in r && r.error) toast("error", r.error);
      else toast("success", "Household deleted.");
    });
  }

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Guest List</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {groups.length} {groups.length === 1 ? "household" : "households"} · {totalPeople} people · {totalPax.toLocaleString()} invited PAX
            {ungrouped.length > 0 && ` · ${ungrouped.length} ungrouped`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Import guests CSV"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" /> Import CSV
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" aria-hidden="true" /> Export
          </Button>
          <Button onClick={() => setCreatingGroup(true)}>
            <Plus className="size-4" aria-hidden="true" /> Add household
          </Button>
        </div>
      </header>

      {importResult && (
        <p role="status" className="mt-4 rounded-lg border border-info/30 bg-info-soft px-4 py-2.5 text-sm text-info">
          {importResult}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search households or guests…" className="pl-9" aria-label="Search guests" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {GUEST_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sideFilter} onValueChange={setSideFilter}>
          <SelectTrigger className="w-40" aria-label="Filter by side"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any side</SelectItem>
            <SelectItem value="bride">Bride&apos;s side</SelectItem>
            <SelectItem value="groom">Groom&apos;s side</SelectItem>
            <SelectItem value="both">Both</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-2.5">
          <p className="text-sm font-medium text-primary">{selected.size} selected</p>
          <Select onValueChange={onBulkCategory}>
            <SelectTrigger className="h-8 w-44" aria-label="Set category for selected"><SelectValue placeholder="Set category…" /></SelectTrigger>
            <SelectContent>
              {GUEST_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onBulkDelete}>
            <Trash2 className="size-4" aria-hidden="true" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Users />}
          title={groups.length === 0 ? "No households yet" : "No households match"}
          description={groups.length === 0 ? "Add families, couples, or individual friends as households — each can hold several guests and one invitation link." : "Try different filters."}
          action={<Button onClick={() => setCreatingGroup(true)}><Plus className="size-4" aria-hidden="true" /> Add household</Button>}
        />
      ) : (
        <div className="mt-5 space-y-2">
          <div className="hidden items-center gap-3 rounded-lg px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:flex">
            <span className="w-6" />
            <span className="flex-1">Household</span>
            <span className="w-28 text-center">Category</span>
            <span className="w-20 text-center">PAX</span>
            <span className="w-24 text-center">Invitation</span>
            <span className="w-36 text-right">Actions</span>
          </div>
          {rows.map((g) => (
            <div key={g.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
              <Checkbox
                checked={selected.has(g.id)}
                onCheckedChange={() => toggleSelect(g.id)}
                aria-label={`Select ${g.name}`}
                className="size-[18px]"
              />
              <button type="button" onClick={() => setManagingGroup(g)} className="min-w-0 flex-1 cursor-pointer text-left">
                <p className="truncate text-sm font-medium">{g.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {g.guests.length === 0
                    ? g.primary_contact_name ?? "No guests added yet"
                    : g.guests.map((p) => `${p.first_name} ${p.last_name ?? ""}`.trim()).slice(0, 4).join(", ") + (g.guests.length > 4 ? ` +${g.guests.length - 4}` : "")}
                </p>
              </button>
              <div className="w-28 text-center">
                <Badge tone="neutral">{g.category}</Badge>
              </div>
              <div className="w-20 text-center text-sm">
                <span className="font-semibold">{g.invited_pax}</span>
                <span className="text-xs text-muted-foreground"> max</span>
                {g.guests.length > 0 && <span className="block text-xs text-muted-foreground">{g.guests.length} listed</span>}
              </div>
              <div className="w-24 text-center">
                {g.invitation ? (
                  <Badge tone={g.invitation.status === "confirmed" ? "success" : g.invitation.status === "declined" ? "neutral" : g.invitation.status === "cancelled" ? "destructive" : "info"}>
                    {g.invitation.status}
                  </Badge>
                ) : (
                  <Badge tone="warning">no link</Badge>
                )}
              </div>
              <div className="flex w-36 items-center justify-end gap-1">
                {!g.invitation && (
                  <Button variant="ghost" size="icon-sm" onClick={() => onGenerateLink(g.id)} aria-label={`Generate invitation link for ${g.name}`} title="Generate invitation link">
                    <Link2 aria-hidden="true" />
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" onClick={() => setManagingGroup(g)} aria-label={`Manage ${g.name}`} title="Manage household">
                  <Pencil aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => onDeleteGroup(g)} aria-label={`Delete ${g.name}`} className="hover:text-destructive" title="Delete household">
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit household */}
      <GroupDialog
        open={creatingGroup || editingGroup != null}
        group={editingGroup}
        weddingId={weddingId}
        onClose={() => {
          setCreatingGroup(false);
          setEditingGroup(null);
        }}
      />

      {/* Manage household guests */}
      <Dialog open={managingGroup != null} onOpenChange={(o) => !o && setManagingGroup(null)}>
        <DialogContent wide>
          <DialogHeader
            title={managingGroup?.name ?? ""}
            description={`${managingGroup?.guests.length ?? 0} guest(s) · max PAX ${managingGroup?.invited_pax ?? 1} · ${managingGroup ? SIDE_LABEL[managingGroup.side] : ""}`}
          />
          {managingGroup && (
            <ManageGroupBody
              group={managingGroup}
              weddingId={weddingId}
              onDone={() => setManagingGroup(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManageGroupBody({ group, weddingId, onDone }: { group: GroupWithStats; weddingId: string; onDone: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function addGuest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await createGuest(weddingId, {
      first_name: String(fd.get("first_name") ?? ""),
      last_name: String(fd.get("last_name") ?? "") || null,
      email: String(fd.get("email") ?? "") || null,
      phone: String(fd.get("phone") ?? "") || null,
      relationship: String(fd.get("relationship") ?? "") || null,
      group_id: group.id,
      category: group.category,
      side: group.side,
    });
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    toast("success", "Guest added.");
    e.currentTarget.reset();
  }

  async function removeGuest(guestId: string, name: string) {
    if (!confirm(`Remove ${name} from this household?`)) return;
    const r = await deleteGuest(weddingId, guestId);
    if ("error" in r && r.error) toast("error", r.error);
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-lg border border-border">
        {group.guests.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {p.first_name} {p.last_name}
                {p.is_primary_contact && <Badge tone="primary" className="ml-2">contact</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{[p.email, p.phone, p.relationship].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.first_name}`} onClick={() => removeGuest(p.id, p.first_name)} className="hover:text-destructive">
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
        {group.guests.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">No named guests yet — the household invitation still works with PAX only.</li>}
      </ul>

      <form onSubmit={addGuest} className="grid gap-3 rounded-lg border border-dashed border-border-strong p-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="mg-first" required>First name</Label>
          <Input id="mg-first" name="first_name" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="mg-last">Last name</Label>
          <Input id="mg-last" name="last_name" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="mg-email">Email</Label>
          <Input id="mg-email" name="email" type="email" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="mg-phone">Phone</Label>
          <Input id="mg-phone" name="phone" className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="mg-rel" hint="optional">Relationship</Label>
          <Input id="mg-rel" name="relationship" className="mt-1" placeholder="Bride's cousin" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            Add guest to household
          </Button>
        </div>
      </form>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

function GroupDialog({
  open, group, weddingId, onClose,
}: {
  open: boolean;
  group: GuestGroup | null;
  weddingId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      category: String(fd.get("category") ?? "Other"),
      side: String(fd.get("side") ?? "both"),
      primary_contact_name: String(fd.get("contact") ?? "") || null,
      primary_contact_email: String(fd.get("email") ?? "") || null,
      primary_contact_phone: String(fd.get("phone") ?? "") || null,
      invited_pax: Number(fd.get("pax") ?? 2),
      plus_one_allowed: fd.get("plus_one") === "on",
      invitation_type: String(fd.get("type") ?? "household"),
      internal_notes: String(fd.get("notes") ?? "") || null,
    };
    const r = group ? await updateGroup(weddingId, group.id, input) : await createGroup(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) {
      setError(r.error);
      return;
    }
    toast("success", group ? "Household updated." : "Household added.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader
          title={group ? "Edit household" : "Add household"}
          description="A household (family, couple, or individual) shares one invitation with a PAX limit."
        />
        <form onSubmit={onSubmit} className="space-y-4" key={group?.id ?? "new"}>
          <div>
            <Label htmlFor="g-name" required>Household name</Label>
            <Input id="g-name" name="name" required defaultValue={group?.name} className="mt-1.5" placeholder="The Reyes Family" autoFocus />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="g-cat">Category</Label>
              <Select name="category" defaultValue={group?.category ?? "Other"}>
                <SelectTrigger id="g-cat" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GUEST_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="g-side">Side</Label>
              <Select name="side" defaultValue={group?.side ?? "both"}>
                <SelectTrigger id="g-side" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bride">Bride&apos;s side</SelectItem>
                  <SelectItem value="groom">Groom&apos;s side</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="g-pax" required hint="max attendees">Invited PAX</Label>
              <Input id="g-pax" name="pax" type="number" min={1} required defaultValue={group?.invited_pax ?? 2} className="mt-1.5" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="g-contact" hint="optional">Primary contact</Label>
              <Input id="g-contact" name="contact" defaultValue={group?.primary_contact_name ?? ""} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="g-email" hint="optional">Email</Label>
              <Input id="g-email" name="email" type="email" defaultValue={group?.primary_contact_email ?? ""} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="g-phone" hint="optional">Phone</Label>
              <Input id="g-phone" name="phone" defaultValue={group?.primary_contact_phone ?? ""} className="mt-1.5" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="g-type">Invitation type</Label>
              <Select name="type" defaultValue={group?.invitation_type ?? "household"}>
                <SelectTrigger id="g-type" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="household">One invitation for the household</SelectItem>
                  <SelectItem value="individual">Individual (one person)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="mt-6 flex items-center gap-2.5 text-sm">
              <Checkbox name="plus_one" defaultChecked={group?.plus_one_allowed ?? false} />
              Plus-one allowed
            </label>
          </div>
          <div>
            <Label htmlFor="g-notes" hint="private to planners">Internal notes</Label>
            <Input id="g-notes" name="notes" defaultValue={group?.internal_notes ?? ""} className="mt-1.5" />
          </div>
          <FieldError message={error} />
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {group ? "Save changes" : "Add household"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function csvEsc(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
