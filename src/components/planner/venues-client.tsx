"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, MapPin, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createVenue, updateVenue, deleteVenue } from "@/lib/actions/directory";
import { formatMoney } from "@/lib/domain/format";
import type { Venue, Vendor } from "@/lib/domain/types";

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "destructive"> = {
  considering: "neutral",
  optioned: "info",
  booked: "success",
  declined: "destructive",
};

export function VenuesClient({
  weddingId,
  currency,
  venues,
  vendors,
}: {
  weddingId: string;
  currency: string;
  venues: Venue[];
  vendors: Pick<Vendor, "id" | "name">[];
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Venue | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Venues &amp; Logistics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ceremony and reception venues, capacity, and guest-facing details.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" /> Add venue</Button>
      </header>

      {venues.length === 0 ? (
        <EmptyState className="mt-6" icon={<MapPin />} title="No venues yet" description="Record your church, garden, hall — or candidates you're still touring." action={<Button onClick={() => setCreating(true)}>Add venue</Button>} />
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {venues.map((v) => (
            <div key={v.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 font-display text-lg font-semibold">
                    {v.name}
                    <Badge tone="neutral">{v.role}</Badge>
                    {v.is_public && <Badge tone="success" icon={<Globe className="size-3" />}>on invitation</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {v.venue_type} {v.capacity ? `· capacity ${v.capacity}` : ""}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[v.booking_status]}>{v.booking_status}</Badge>
              </div>
              {v.address && <p className="mt-2 text-sm text-foreground-secondary">{v.address}</p>}
              {v.rental_price != null && <p className="mt-1 text-sm font-medium">{formatMoney(Number(v.rental_price), currency)} rental</p>}
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {v.parking_notes && <p>Parking: {v.parking_notes}</p>}
                {v.transit_notes && <p>Transit: {v.transit_notes}</p>}
                {v.accessibility_notes && <p>Accessibility: {v.accessibility_notes}</p>}
                {v.setup_start && <p>Setup from {v.setup_start}{v.teardown_end ? ` · teardown until ${v.teardown_end}` : ""}</p>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {v.map_url && (
                  <a href={v.map_url} target="_blank" rel="noreferrer noopener">
                    <Button size="sm" variant="outline"><ExternalLink className="size-3.5" aria-hidden="true" /> Map</Button>
                  </a>
                )}
                <Button size="sm" variant="secondary" onClick={() => setEditing(v)}><Pencil className="size-3.5" aria-hidden="true" /> Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startTransition(async () => {
                    const r = await updateVenue(weddingId, v.id, { is_public: !v.is_public });
                    if ("error" in r && r.error) toast("error", r.error);
                    else toast("success", v.is_public ? "Hidden from the invitation." : "Guests can see this venue on the invitation.");
                  })}
                >
                  <Globe className="size-3.5" aria-hidden="true" /> {v.is_public ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete venue "${v.name}"?`)) startTransition(async () => { await deleteVenue(weddingId, v.id); toast("success", "Venue deleted."); }); }}>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <VenueDialog open={creating || editing != null} venue={editing} vendors={vendors} weddingId={weddingId} currency={currency} onClose={() => { setCreating(false); setEditing(null); }} />
    </div>
  );
}

function VenueDialog({
  open, venue, vendors, weddingId, currency, onClose,
}: {
  open: boolean;
  venue: Venue | null;
  vendors: Pick<Vendor, "id" | "name">[];
  weddingId: string;
  currency: string;
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
      venue_type: String(fd.get("venue_type") ?? "") || null,
      role: String(fd.get("role") ?? "reception"),
      address: String(fd.get("address") ?? "") || null,
      map_url: String(fd.get("map_url") ?? "") || null,
      contact_name: String(fd.get("contact_name") ?? "") || null,
      contact_phone: String(fd.get("contact_phone") ?? "") || null,
      contact_email: String(fd.get("contact_email") ?? "") || null,
      capacity: fd.get("capacity") ? Number(fd.get("capacity")) : null,
      booking_status: String(fd.get("booking_status") ?? "considering"),
      rental_price: fd.get("rental_price") ? Number(fd.get("rental_price")) : null,
      facilities: String(fd.get("facilities") ?? ""),
      setup_start: String(fd.get("setup_start") ?? "") || null,
      teardown_end: String(fd.get("teardown_end") ?? "") || null,
      restrictions: String(fd.get("restrictions") ?? "") || null,
      parking_notes: String(fd.get("parking_notes") ?? "") || null,
      accessibility_notes: String(fd.get("accessibility_notes") ?? "") || null,
      transit_notes: String(fd.get("transit_notes") ?? "") || null,
      accommodation_notes: String(fd.get("accommodation_notes") ?? "") || null,
      vendor_id: String(fd.get("vendor_id") ?? "") || null,
      is_public: fd.get("is_public") === "on",
    };
    const r = venue ? await updateVenue(weddingId, venue.id, input) : await createVenue(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    toast("success", venue ? "Venue updated." : "Venue added.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader title={venue ? "Edit venue" : "Add venue"} description="Only construct map links from real addresses you supply." />
        <form onSubmit={onSubmit} className="space-y-4" key={venue?.id ?? "new"}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="ve-name" required>Name</Label>
              <Input id="ve-name" name="name" required defaultValue={venue?.name} className="mt-1.5" autoFocus placeholder="San Iglesia Parish" />
            </div>
            <div>
              <Label htmlFor="ve-role">Role</Label>
              <Select name="role" defaultValue={venue?.role ?? "reception"}>
                <SelectTrigger id="ve-role" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ceremony">Ceremony</SelectItem>
                  <SelectItem value="reception">Reception</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="ve-type" hint="optional">Type</Label><Input id="ve-type" name="venue_type" defaultValue={venue?.venue_type ?? ""} className="mt-1.5" placeholder="Church, garden, hotel…" /></div>
            <div><Label htmlFor="ve-cap" hint="optional">Capacity</Label><Input id="ve-cap" name="capacity" type="number" min="1" defaultValue={venue?.capacity ?? ""} className="mt-1.5" /></div>
          </div>
          <div><Label htmlFor="ve-addr" hint="optional">Address</Label><Input id="ve-addr" name="address" defaultValue={venue?.address ?? ""} className="mt-1.5" /></div>
          <div><Label htmlFor="ve-map" hint="optional — paste from Google Maps">Map URL</Label><Input id="ve-map" name="map_url" type="url" defaultValue={venue?.map_url ?? ""} className="mt-1.5" placeholder="https://maps.google.com/…" /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor="ve-cname" hint="optional">Contact</Label><Input id="ve-cname" name="contact_name" defaultValue={venue?.contact_name ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="ve-cphone" hint="optional">Phone</Label><Input id="ve-cphone" name="contact_phone" defaultValue={venue?.contact_phone ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="ve-cemail" hint="optional">Email</Label><Input id="ve-cemail" name="contact_email" type="email" defaultValue={venue?.contact_email ?? ""} className="mt-1.5" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="ve-status">Booking status</Label>
              <Select name="booking_status" defaultValue={venue?.booking_status ?? "considering"}>
                <SelectTrigger id="ve-status" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="considering">Considering</SelectItem>
                  <SelectItem value="optioned">Optioned</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="ve-price" hint={`(${currency})`}>Rental price</Label><Input id="ve-price" name="rental_price" type="number" min="0" step="0.01" defaultValue={venue?.rental_price ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="ve-vendor" hint="optional">Linked vendor</Label>
              <Select name="vendor_id" defaultValue={venue?.vendor_id ?? ""}>
                <SelectTrigger id="ve-vendor" className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="ve-setup" hint="optional">Setup window starts</Label><Input id="ve-setup" name="setup_start" type="time" defaultValue={venue?.setup_start ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="ve-tear" hint="optional">Teardown ends</Label><Input id="ve-tear" name="teardown_end" type="time" defaultValue={venue?.teardown_end ?? ""} className="mt-1.5" /></div>
          </div>
          <div><Label htmlFor="ve-fac" hint="optional">Included facilities</Label><Input id="ve-fac" name="facilities" defaultValue={venue?.facilities ?? ""} className="mt-1.5" placeholder="Sound system, parking for 40, bridal room" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="ve-park" hint="optional">Parking notes</Label><Input id="ve-park" name="parking_notes" defaultValue={venue?.parking_notes ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="ve-transit" hint="optional">Directions / transit</Label><Input id="ve-transit" name="transit_notes" defaultValue={venue?.transit_notes ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="ve-access" hint="optional">Accessibility</Label><Input id="ve-access" name="accessibility_notes" defaultValue={venue?.accessibility_notes ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="ve-accom" hint="optional">Nearby accommodation</Label><Input id="ve-accom" name="accommodation_notes" defaultValue={venue?.accommodation_notes ?? ""} className="mt-1.5" /></div>
          </div>
          <div><Label htmlFor="ve-restrict" hint="optional">Restrictions &amp; requirements</Label><Textarea id="ve-restrict" name="restrictions" rows={2} defaultValue={venue?.restrictions ?? ""} className="mt-1.5" placeholder="No red wine, curfew 11 PM…" /></div>
          <label className="flex items-center gap-3 rounded-lg border border-border bg-surface-warm/50 p-3 text-sm">
            <Switch name="is_public" defaultChecked={venue?.is_public ?? false} />
            <span><span className="font-medium">Show on the invitation website</span><span className="block text-xs text-muted-foreground">Guests see the name, address, map, parking, and access notes.</span></span>
          </label>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>{venue ? "Save changes" : "Add venue"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
