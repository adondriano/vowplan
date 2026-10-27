"use client";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Armchair, Users, Printer, AlertTriangle, MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createTable, updateTable, deleteTable, assignGuestToTable } from "@/lib/actions/directory";
import type { Guest, SeatingTable, GuestTableAssignment, Invitation } from "@/lib/domain/types";

export function SeatingClient({
  weddingId,
  tables,
  guests,
  assignments,
  groups,
  invitations,
  responses,
}: {
  weddingId: string;
  tables: SeatingTable[];
  guests: Guest[];
  assignments: GuestTableAssignment[];
  groups: { id: string; name: string }[];
  invitations: Pick<Invitation, "id" | "group_id" | "max_pax">[];
  responses: { invitation_id: string; status: string; attending_count: number }[];
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SeatingTable | null>(null);
  const [moving, setMoving] = useState<Guest | null>(null);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

  const assignmentByGuest = useMemo(() => new Map(assignments.map((a) => [a.guest_id, a])), [assignments]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const invByGroup = useMemo(() => new Map(invitations.map((i) => [i.group_id, i])), [invitations]);
  const respByInv = useMemo(() => new Map(responses.map((r) => [r.invitation_id, r])), [responses]);

  /** Expected occupants: confirmed attendees get priority; tentative assignments flagged. */
  const expectedPaxByGroup = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups) {
      const inv = invByGroup.get(g.id);
      if (!inv) continue;
      const r = respByInv.get(inv.id);
      if (r?.status === "confirmed") m.set(g.id, r.attending_count);
    }
    return m;
  }, [groups, invByGroup, respByInv]);

  const unassigned = guests.filter((g) => !assignmentByGuest.has(g.id));
  const totalCapacity = tables.reduce((s, t) => s + t.capacity, 0);
  const totalAssigned = assignments.length;
  const confirmedPax = Array.from(expectedPaxByGroup.values()).reduce((s, n) => s + n, 0);

  function assign(guest: Guest, tableId: string | null) {
    startTransition(async () => {
      const r = await assignGuestToTable(weddingId, guest.id, tableId);
      if ("error" in r && r.error) toast("error", r.error);
      else toast("success", tableId ? `${guest.first_name} seated.` : `${guest.first_name} unassigned.`);
    });
  }

  const filteredUnassigned = showUnassignedOnly ? unassigned : unassigned;

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Seating Planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tables.length} tables · capacity {totalCapacity} · {totalAssigned} assigned · {confirmedPax} confirmed pax
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" aria-hidden="true" /> Print chart</Button>
          <Button onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" /> Add table</Button>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Tables */}
        <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-3">
          {tables.length === 0 && (
            <EmptyState className="sm:col-span-2" icon={<Armchair />} title="No tables yet" description="Create tables (e.g. 'Table 1 — Family side') then assign guests." action={<Button onClick={() => setCreating(true)}>Add table</Button>} />
          )}
          {tables.map((t) => {
            const seated = guests.filter((g) => assignmentByGuest.get(g.id)?.table_id === t.id);
            const over = seated.length > t.capacity;
            return (
              <div key={t.id} className={`card p-4 print:break-inside-avoid ${over ? "border-destructive/40" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-base font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      capacity {t.capacity}{t.location ? ` · ${t.location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 print:hidden">
                    <Badge tone={over ? "destructive" : seated.length === t.capacity ? "warning" : "neutral"}>
                      {seated.length}/{t.capacity}
                    </Badge>
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil aria-hidden="true" /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${t.name}`} className="hover:text-destructive" onClick={() => { if (confirm(`Delete table "${t.name}"? Its guests become unassigned.`)) startTransition(async () => { await deleteTable(weddingId, t.id); }); }}><Trash2 aria-hidden="true" /></Button>
                  </div>
                </div>
                {over && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="size-3.5" aria-hidden="true" /> Over capacity by {seated.length - t.capacity}
                  </p>
                )}
                <ul className="mt-2.5 space-y-1">
                  {seated.map((g) => {
                    const groupName = g.group_id ? groupById.get(g.group_id)?.name : null;
                    const pax = g.group_id ? expectedPaxByGroup.get(g.group_id) : undefined;
                    return (
                      <li key={g.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-warm/50 px-2.5 py-1.5 text-sm print:bg-transparent">
                        <span className="min-w-0 truncate">
                          {g.first_name} {g.last_name}
                          {groupName && pax == null && <span className="text-xs text-muted-foreground"> · {groupName} (not confirmed)</span>}
                        </span>
                        <button type="button" onClick={() => setMoving(g)} className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-surface hover:text-primary print:hidden" aria-label={`Move ${g.first_name} to another table`}>
                          <MoveHorizontal className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                  {seated.length === 0 && <li className="px-1 py-2 text-xs text-muted-foreground">Empty — pick guests from the right panel.</li>}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Unassigned guests */}
        <aside aria-label="Unassigned guests" className="print:hidden">
          <div className="card sticky top-4 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" aria-hidden="true" /> Unassigned ({unassigned.length})
              </p>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox checked={showUnassignedOnly} onCheckedChange={(v) => setShowUnassignedOnly(Boolean(v))} aria-label="Filter view" />
                filter
              </label>
            </div>
            <ul className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto thin-scroll">
              {filteredUnassigned.map((g) => {
                const groupName = g.group_id ? groupById.get(g.group_id)?.name : null;
                const confirmed = g.group_id ? expectedPaxByGroup.get(g.group_id) != null : false;
                return (
                  <li key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
                    <span className="min-w-0 truncate">
                      {g.first_name} {g.last_name}
                      {groupName && <span className="block text-xs text-muted-foreground">{groupName}{confirmed ? " · confirmed" : ""}</span>}
                    </span>
                    <Select onValueChange={(tableId) => assign(g, tableId)}>
                      <SelectTrigger className="h-8 w-24" aria-label={`Seat ${g.first_name}`}><SelectValue placeholder="Seat" /></SelectTrigger>
                      <SelectContent>
                        {tables.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
              {filteredUnassigned.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">{guests.length === 0 ? "Add guests first from the Guest List." : "Everyone has a seat!"}</li>}
            </ul>
          </div>
        </aside>
      </div>

      {/* Move dialog */}
      <Dialog open={moving != null} onOpenChange={(o) => !o && setMoving(null)}>
        <DialogContent>
          <DialogHeader title={`Move ${moving?.first_name ?? ""} ${moving?.last_name ?? ""}`} />
          <div className="grid gap-2">
            {tables.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                className="justify-between"
                onClick={() => {
                  if (moving) assign(moving, t.id);
                  setMoving(null);
                }}
              >
                {t.name}
                <span className="text-xs text-muted-foreground">
                  {guests.filter((g) => assignmentByGuest.get(g.id)?.table_id === t.id).length}/{t.capacity}
                </span>
              </Button>
            ))}
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (moving) assign(moving, null);
                setMoving(null);
              }}
            >
              Remove assignment
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TableDialog open={creating || editing != null} table={editing} weddingId={weddingId} onClose={() => { setCreating(false); setEditing(null); }} />
    </div>
  );
}

function TableDialog({
  open, table, weddingId, onClose,
}: {
  open: boolean;
  table: SeatingTable | null;
  weddingId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      capacity: Number(fd.get("capacity") ?? 8),
      location: String(fd.get("location") ?? "") || null,
    };
    const r = table ? await updateTable(weddingId, table.id, input) : await createTable(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    toast("success", table ? "Table updated." : "Table added.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader title={table ? "Edit table" : "Add table"} />
        <form onSubmit={onSubmit} className="space-y-4" key={table?.id ?? "new"}>
          <div>
            <Label htmlFor="tb-name" required>Table name</Label>
            <Input id="tb-name" name="name" required defaultValue={table?.name} className="mt-1.5" placeholder="Table 1" autoFocus />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tb-cap">Capacity</Label>
              <Input id="tb-cap" name="capacity" type="number" min={1} defaultValue={table?.capacity ?? 8} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="tb-loc" hint="optional">Location / area</Label>
              <Input id="tb-loc" name="location" defaultValue={table?.location ?? ""} className="mt-1.5" placeholder="Near the garden door" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>{table ? "Save" : "Add table"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
