"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, HeartHandshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createPartyMember, updatePartyMember, deletePartyMember } from "@/lib/actions/directory";
import { formatDate } from "@/lib/domain/format";
import type { WeddingPartyMember } from "@/lib/domain/types";

export function WeddingPartyClient({ weddingId, members }: { weddingId: string; members: WeddingPartyMember[] }) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<WeddingPartyMember | null>(null);
  const [creating, setCreating] = useState(false);

  const sides = [
    { key: "bride", label: "Bride's side" },
    { key: "groom", label: "Groom's side" },
    { key: "both", label: "Both" },
  ] as const;

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Wedding Party</h1>
          <p className="mt-1 text-sm text-muted-foreground">{members.length} members · roles, attire, and responsibilities</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" /> Add member</Button>
      </header>

      {members.length === 0 ? (
        <EmptyState className="mt-6" icon={<HeartHandshake />} title="No wedding party yet" description="Add your bridesmaids, groomsmen, best man, maid of honor, flower girls…" action={<Button onClick={() => setCreating(true)}>Add first member</Button>} />
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {sides.map((side) => {
            const list = members.filter((m) => m.side === side.key);
            if (list.length === 0) return null;
            return (
              <div key={side.key}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{side.label}</p>
                <ul className="space-y-2">
                  {list.map((m) => (
                    <li key={m.id} className="card flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {m.name} <Badge tone="primary">{m.role}</Badge>
                          {m.rehearsal && <Badge tone="neutral">rehearsal</Badge>}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[m.ceremony_position, m.fitting_date ? `fitting ${formatDate(m.fitting_date, "MMM d")}` : null, m.email, m.phone].filter(Boolean).join(" · ") || "—"}
                        </p>
                        {m.responsibilities && <p className="mt-1 text-xs text-foreground-secondary">{m.responsibilities}</p>}
                        {m.attire_notes && <p className="text-xs text-muted-foreground">Attire: {m.attire_notes}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}><Pencil aria-hidden="true" /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${m.name}`} className="hover:text-destructive" onClick={() => { if (confirm(`Remove ${m.name} from the wedding party?`)) startTransition(async () => { await deletePartyMember(weddingId, m.id); }); }}><Trash2 aria-hidden="true" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <PartyDialog open={creating || editing != null} member={editing} weddingId={weddingId} onClose={() => { setCreating(false); setEditing(null); }} />
    </div>
  );
}

function PartyDialog({ open, member, weddingId, onClose }: { open: boolean; member: WeddingPartyMember | null; weddingId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      role: String(fd.get("role") ?? "Bridesmaid"),
      side: String(fd.get("side") ?? "both"),
      email: String(fd.get("email") ?? "") || null,
      phone: String(fd.get("phone") ?? "") || null,
      attire_notes: String(fd.get("attire_notes") ?? "") || null,
      responsibilities: String(fd.get("responsibilities") ?? "") || null,
      rehearsal: fd.get("rehearsal") === "on",
      ceremony_position: String(fd.get("ceremony_position") ?? "") || null,
      fitting_date: String(fd.get("fitting_date") ?? "") || null,
      notes: String(fd.get("notes") ?? "") || null,
    };
    const r = member ? await updatePartyMember(weddingId, member.id, input) : await createPartyMember(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    toast("success", member ? "Member updated." : "Member added.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader title={member ? "Edit member" : "Add wedding party member"} description="These records stay private to workspace members — guests never see them." />
        <form onSubmit={onSubmit} className="space-y-4" key={member?.id ?? "new"}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor="wp-name" required>Name</Label><Input id="wp-name" name="name" required defaultValue={member?.name} className="mt-1.5" autoFocus /></div>
            <div><Label htmlFor="wp-role">Role</Label><Input id="wp-role" name="role" defaultValue={member?.role ?? "Bridesmaid"} className="mt-1.5" placeholder="Maid of honor" /></div>
            <div>
              <Label htmlFor="wp-side">Side</Label>
              <Select name="side" defaultValue={member?.side ?? "both"}>
                <SelectTrigger id="wp-side" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bride">Bride&apos;s side</SelectItem>
                  <SelectItem value="groom">Groom&apos;s side</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="wp-email" hint="optional">Email</Label><Input id="wp-email" name="email" type="email" defaultValue={member?.email ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="wp-phone" hint="optional">Phone</Label><Input id="wp-phone" name="phone" defaultValue={member?.phone ?? ""} className="mt-1.5" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="wp-attire" hint="optional">Attire notes</Label><Input id="wp-attire" name="attire_notes" defaultValue={member?.attire_notes ?? ""} className="mt-1.5" placeholder="Dusty rose gown, gold heels" /></div>
            <div><Label htmlFor="wp-fitting" hint="optional">Fitting date</Label><Input id="wp-fitting" name="fitting_date" type="date" defaultValue={member?.fitting_date ?? ""} className="mt-1.5" /></div>
          </div>
          <div><Label htmlFor="wp-resp" hint="optional">Responsibilities</Label><Textarea id="wp-resp" name="responsibilities" rows={2} defaultValue={member?.responsibilities ?? ""} className="mt-1.5" placeholder="Plan the bridal shower, lead the processional" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="wp-pos" hint="optional">Ceremony position</Label><Input id="wp-pos" name="ceremony_position" defaultValue={member?.ceremony_position ?? ""} className="mt-1.5" placeholder="First to walk" /></div>
            <label className="mt-6 flex items-center gap-2.5 text-sm"><Checkbox name="rehearsal" defaultChecked={member?.rehearsal ?? false} /> Joins the rehearsal</label>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{member ? "Save" : "Add member"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
