"use client";
import { useMemo, useState, useTransition } from "react";
import {
  Plus, Trash2, Printer, CalendarClock, ArrowUp, ArrowDown,
  PartyPopper, Flag, Eye, EyeOff, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, FieldError } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { createEvent, updateEvent, deleteEvent, reorderEvents } from "@/lib/actions/timeline";
import { formatDate, formatTime } from "@/lib/domain/format";
import type { WeddingEvent } from "@/lib/domain/types";

/** Detects overlapping wedding-day entries (same date, intersecting times). */
function findOverlaps(events: WeddingEvent[]): Set<string> {
  const overlapping = new Set<string>();
  const byDate = new Map<string, WeddingEvent[]>();
  for (const e of events) {
    if (e.event_type !== "wedding_day" || !e.event_date || !e.start_time) continue;
    const list = byDate.get(e.event_date) ?? [];
    list.push(e);
    byDate.set(e.event_date, list);
  }
  for (const [, list] of byDate) {
    const sorted = [...list].sort((a, b) => (a.start_time! < b.start_time! ? -1 : 1));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const aEnd = a.end_time ?? a.start_time!;
      if (aEnd > b.start_time!) {
        overlapping.add(a.id);
        overlapping.add(b.id);
      }
    }
  }
  return overlapping;
}

export function TimelineClient({
  weddingId,
  weddingDate,
  dateTentative,
  events,
  vendors,
}: {
  weddingId: string;
  weddingDate: string | null;
  dateTentative: boolean;
  events: WeddingEvent[];
  vendors: { id: string; name: string }[];
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<WeddingEvent | null>(null);
  const [creating, setCreating] = useState<null | "wedding_day" | "planning_milestone">(null);

  const planning = useMemo(() => events.filter((e) => e.event_type === "planning_milestone"), [events]);
  const dayOf = useMemo(
    () =>
      events
        .filter((e) => e.event_type === "wedding_day")
        .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "") || a.sort_order - b.sort_order),
    [events],
  );
  const overlaps = useMemo(() => findOverlaps(events), [events]);

  function move(e: WeddingEvent, dir: -1 | 1) {
    const idx = dayOf.findIndex((x) => x.id === e.id);
    const swapWith = dayOf[idx + dir];
    if (!swapWith) return;
    const reordered = [...dayOf];
    reordered[idx] = swapWith;
    reordered[idx + dir] = e;
    startTransition(async () => {
      await reorderEvents(weddingId, reordered.map((x) => x.id));
    });
  }

  async function togglePublic(e: WeddingEvent) {
    startTransition(async () => {
      const r = await updateEvent(weddingId, e.id, { is_public: !e.is_public });
      if ("error" in r && r.error) toast("error", r.error);
      else toast("success", e.is_public ? "Hidden from the invitation." : "Guests can now see this entry.");
    });
  }

  async function onDelete(e: WeddingEvent) {
    if (!confirm(`Delete "${e.title}" from the timeline?`)) return;
    startTransition(async () => {
      const r = await deleteEvent(weddingId, e.id);
      if ("error" in r && r.error) toast("error", r.error);
    });
  }

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Timeline &amp; Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planning milestones and the wedding-day schedule{dateTentative ? " (tentative date)" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" /> Print
          </Button>
          <Button onClick={() => setCreating("wedding_day")}>
            <Plus className="size-4" aria-hidden="true" /> Schedule entry
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Wedding-day schedule */}
        <section aria-label="Wedding-day schedule">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <PartyPopper className="size-5 text-primary" aria-hidden="true" /> Wedding-day schedule
            </h2>
            {overlaps.size > 0 && (
              <Badge tone="warning" icon={<AlertTriangle className="size-3" />}>
                {overlaps.size} overlap{overlaps.size > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {dayOf.length === 0 ? (
            <EmptyState
              icon={<CalendarClock />}
              title="No schedule entries"
              description="Build the run-of-show: hair, ceremony, reception…"
              action={<Button size="sm" onClick={() => setCreating("wedding_day")}>Add first entry</Button>}
            />
          ) : (
            <ol className="space-y-2">
              {dayOf.map((e, i) => (
                <li
                  key={e.id}
                  className={cn(
                    "card flex items-center gap-3 px-4 py-3 print:break-inside-avoid",
                    overlaps.has(e.id) && "border-warning/40",
                  )}
                >
                  <div className="flex flex-col text-muted-foreground print:hidden">
                    <button type="button" onClick={() => move(e, -1)} disabled={i === 0} aria-label={`Move ${e.title} up`} className="cursor-pointer rounded p-0.5 hover:bg-surface-warm disabled:opacity-30">
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => move(e, 1)} disabled={i === dayOf.length - 1} aria-label={`Move ${e.title} down`} className="cursor-pointer rounded p-0.5 hover:bg-surface-warm disabled:opacity-30">
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="w-24 shrink-0 text-xs font-semibold text-primary">
                    {e.start_time ? formatTime(e.start_time) : "—"}
                    {e.end_time && <span className="block font-normal text-muted-foreground">to {formatTime(e.end_time)}</span>}
                  </div>
                  <button type="button" onClick={() => setEditing(e)} className="min-w-0 flex-1 cursor-pointer text-left">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.event_date ? formatDate(e.event_date, "EEE, MMM d") : "date TBD"}
                      {e.location && ` · ${e.location}`}
                      {e.coordinator && ` · ${e.coordinator}`}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1 print:hidden">
                    {overlaps.has(e.id) && <AlertTriangle className="size-4 text-warning" aria-label="Overlaps with another entry" />}
                    <button
                      type="button"
                      onClick={() => togglePublic(e)}
                      aria-label={e.is_public ? `Hide ${e.title} from guests` : `Show ${e.title} to guests`}
                      className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-surface-warm"
                    >
                      {e.is_public ? <Eye className="size-4 text-success" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                    </button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onDelete(e)} aria-label={`Delete ${e.title}`} className="hover:text-destructive">
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                  {e.is_public && <Badge tone="success" className="hidden print:inline-flex">Guest-visible</Badge>}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            <Eye className="inline size-3.5" aria-hidden="true" /> Guest-visible entries appear on the published invitation website — you choose each one.
          </p>
        </section>

        {/* Planning milestones */}
        <section aria-label="Planning milestones">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <Flag className="size-5 text-accent" aria-hidden="true" /> Planning milestones
            </h2>
            <Button variant="outline" size="sm" onClick={() => setCreating("planning_milestone")}>
              <Plus className="size-4" aria-hidden="true" /> Milestone
            </Button>
          </div>
          {planning.length === 0 ? (
            <EmptyState
              icon={<Flag />}
              title="No milestones yet"
              description="Mark big planning moments: venue booking, dress fitting, RSVP deadline…"
              action={<Button size="sm" onClick={() => setCreating("planning_milestone")}>Add milestone</Button>}
            />
          ) : (
            <ol className="relative space-y-3 border-l-2 border-border pl-5">
              {planning.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1.5 size-3.5 rounded-full border-2 border-accent bg-background" aria-hidden="true" />
                  <div className="card flex items-center justify-between gap-3 px-4 py-3">
                    <button type="button" onClick={() => setEditing(e)} className="min-w-0 cursor-pointer text-left">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.event_date ? formatDate(e.event_date, "EEE, MMM d, yyyy") : "date TBD"}
                        {e.description && ` · ${e.description}`}
                      </p>
                    </button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onDelete(e)} aria-label={`Delete ${e.title}`} className="hover:text-destructive print:hidden">
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <EventDialog
        open={creating != null || editing != null}
        eventType={editing?.event_type ?? creating ?? "wedding_day"}
        event={editing}
        weddingDate={weddingDate}
        vendors={vendors}
        weddingId={weddingId}
        onClose={() => {
          setCreating(null);
          setEditing(null);
        }}
      />
    </div>
  );
}

function EventDialog({
  open, event, eventType, weddingDate, vendors, weddingId, onClose,
}: {
  open: boolean;
  event: WeddingEvent | null;
  eventType: "wedding_day" | "planning_milestone";
  weddingDate: string | null;
  vendors: { id: string; name: string }[];
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
      title: String(fd.get("title") ?? ""),
      event_type: String(fd.get("event_type") ?? "wedding_day") as "wedding_day" | "planning_milestone",
      event_date: String(fd.get("event_date") ?? "") || null,
      start_time: String(fd.get("start_time") ?? "") || null,
      end_time: String(fd.get("end_time") ?? "") || null,
      location: String(fd.get("location") ?? "") || null,
      description: String(fd.get("description") ?? "") || null,
      coordinator: String(fd.get("coordinator") ?? "") || null,
      vendor_id: String(fd.get("vendor_id") ?? "") || null,
      is_public: fd.get("is_public") === "on",
    };
    const r = event ? await updateEvent(weddingId, event.id, input) : await createEvent(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) {
      setError(r.error);
      return;
    }
    toast("success", event ? "Entry updated." : "Added to the timeline.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader title={event ? "Edit timeline entry" : "New timeline entry"} />
        <form onSubmit={onSubmit} className="space-y-4" key={event?.id ?? "new"}>
          <div>
            <Label htmlFor="e-title" required>Title</Label>
            <Input id="e-title" name="title" required defaultValue={event?.title} className="mt-1.5" autoFocus placeholder="Ceremony" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="e-type">Type</Label>
              <Select name="event_type" defaultValue={eventType}>
                <SelectTrigger id="e-type" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wedding_day">Wedding-day schedule</SelectItem>
                  <SelectItem value="planning_milestone">Planning milestone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="e-date" hint={weddingDate ? `wedding: ${formatDate(weddingDate)}` : undefined}>Date</Label>
              <Input id="e-date" name="event_date" type="date" defaultValue={event?.event_date ?? weddingDate ?? ""} className="mt-1.5" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="e-start">Start time</Label>
              <Input id="e-start" name="start_time" type="time" defaultValue={event?.start_time ?? ""} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="e-end">End time</Label>
              <Input id="e-end" name="end_time" type="time" defaultValue={event?.end_time ?? ""} className="mt-1.5" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="e-loc" hint="optional">Location</Label>
              <Input id="e-loc" name="location" defaultValue={event?.location ?? ""} className="mt-1.5" placeholder="Church hall" />
            </div>
            <div>
              <Label htmlFor="e-coord" hint="optional">Coordinator</Label>
              <Input id="e-coord" name="coordinator" defaultValue={event?.coordinator ?? ""} className="mt-1.5" placeholder="Maid of honor" />
            </div>
          </div>
          <div>
            <Label htmlFor="e-vendor" hint="optional">Related vendor</Label>
            <Select name="vendor_id" defaultValue={event?.vendor_id ?? ""}>
              <SelectTrigger id="e-vendor" className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="e-desc" hint="optional">Setup / teardown notes</Label>
            <Textarea id="e-desc" name="description" defaultValue={event?.description ?? ""} className="mt-1.5" rows={2} />
          </div>
          {eventType === "wedding_day" && (
            <label className="flex items-center gap-3 rounded-lg border border-border bg-surface-warm/50 p-3 text-sm">
              <Switch name="is_public" defaultChecked={event?.is_public ?? false} />
              <span>
                <span className="font-medium">Show on the invitation website</span>
                <span className="block text-xs text-muted-foreground">Guests only see entries you explicitly publish.</span>
              </span>
            </label>
          )}
          <FieldError message={error} />
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>
              {busy && <span className="animate-spin"><Loader2 className="size-4" aria-hidden="true" /></span>}
              {event ? "Save changes" : "Add entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
