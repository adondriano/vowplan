"use client";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Store, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { VENDOR_CATEGORIES } from "@/lib/domain/task-templates";
import { createVendor, updateVendor, deleteVendor } from "@/lib/actions/directory";
import { formatMoney } from "@/lib/domain/format";
import type { Vendor } from "@/lib/domain/types";

const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "destructive"> = {
  considering: "neutral",
  contacted: "info",
  quoted: "warning",
  booked: "success",
  declined: "destructive",
  completed: "success",
};

export function VendorsClient({
  weddingId,
  currency,
  vendors,
}: {
  weddingId: string;
  currency: string;
  vendors: Vendor[];
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [compare, setCompare] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () =>
      vendors.filter((v) => {
        if (statusFilter !== "all" && v.booking_status !== statusFilter) return false;
        if (search && !`${v.name} ${v.category} ${v.contact_person ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [vendors, search, statusFilter],
  );

  const compareList = vendors.filter((v) => compare.has(v.id));
  const booked = vendors.filter((v) => v.booking_status === "booked");

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Vendors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {vendors.length} tracked · {booked.length} booked
          </p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" /> Add vendor</Button>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors…" className="pl-9" aria-label="Search vendors" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="considering">Considering</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {compareList.length >= 2 && (
        <Card className="mt-4">
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">Compare</th>
                  {compareList.map((v) => <th key={v.id} className="px-3 py-2 text-left font-semibold">{v.name}</th>)}
                </tr>
              </thead>
              <tbody className="[&_td]:px-3 [&_td]:py-2 [&_tr]:border-b [&_tr:last-child]:border-0">
                <tr><td className="text-xs font-medium uppercase text-muted-foreground">Quote</td>{compareList.map((v) => <td key={v.id}>{v.quoted_price != null ? formatMoney(Number(v.quoted_price), currency) : "—"}</td>)}</tr>
                <tr><td className="text-xs font-medium uppercase text-muted-foreground">Contract</td>{compareList.map((v) => <td key={v.id}>{v.contracted_price != null ? formatMoney(Number(v.contracted_price), currency) : "—"}</td>)}</tr>
                <tr><td className="text-xs font-medium uppercase text-muted-foreground">Status</td>{compareList.map((v) => <td key={v.id}><Badge tone={STATUS_TONE[v.booking_status]}>{v.booking_status}</Badge></td>)}</tr>
                <tr><td className="text-xs font-medium uppercase text-muted-foreground">Payment terms</td>{compareList.map((v) => <td key={v.id}>{v.payment_terms ?? "—"}</td>)}</tr>
                <tr><td className="text-xs font-medium uppercase text-muted-foreground">Includes</td>{compareList.map((v) => <td key={v.id}>{v.includes_notes ?? "—"}</td>)}</tr>
                <tr><td className="text-xs font-medium uppercase text-muted-foreground">Notes</td>{compareList.map((v) => <td key={v.id}>{v.notes ?? "—"}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="px-3 pb-3 pt-2 text-xs text-muted-foreground">Booking a vendor doesn&apos;t remove the others — comparisons stay for reference.</p>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState className="mt-6" icon={<Store />} title={vendors.length === 0 ? "No vendors yet" : "No vendors match"} description={vendors.length === 0 ? "Track venues, caterers, photographers — quotes and contracts." : "Adjust your filters."} action={<Button onClick={() => setCreating(true)}>Add vendor</Button>} />
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((v) => (
            <li key={v.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={compare.has(v.id)}
                onChange={() => setCompare((s) => { const n = new Set(s); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n; })}
                aria-label={`Compare ${v.name}`}
                className="size-4 cursor-pointer"
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {v.name}
                  <Badge tone="neutral">{v.category}</Badge>
                  <Badge tone={STATUS_TONE[v.booking_status]}>
                    {v.booking_status === "booked" && <CheckCircle2 className="size-3" aria-hidden="true" />}
                    {v.booking_status}
                  </Badge>
                  {v.rating != null && <span className="text-xs text-accent" aria-label={`Rated ${v.rating} of 5`}>{"★".repeat(v.rating)}</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[v.contact_person, v.phone, v.email, v.quoted_price != null ? `quote ${formatMoney(Number(v.quoted_price), currency)}` : null, v.contracted_price != null ? `contract ${formatMoney(Number(v.contracted_price), currency)}` : null].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </div>
              <Select
                value={v.booking_status}
                onValueChange={(val) => startTransition(async () => {
                  const r = await updateVendor(weddingId, v.id, { booking_status: val });
                  if ("error" in r && r.error) toast("error", r.error);
                })}
              >
                <SelectTrigger className="h-8 w-32" aria-label={`Status of ${v.name}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["considering", "contacted", "quoted", "booked", "declined", "completed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${v.name}`} onClick={() => setEditing(v)}><Pencil aria-hidden="true" /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${v.name}`} className="hover:text-destructive" onClick={() => { if (confirm(`Delete vendor "${v.name}"?`)) startTransition(async () => { await deleteVendor(weddingId, v.id); toast("success", "Vendor deleted."); }); }}><Trash2 aria-hidden="true" /></Button>
            </li>
          ))}
        </ul>
      )}

      <VendorDialog open={creating || editing != null} vendor={editing} weddingId={weddingId} currency={currency} onClose={() => { setCreating(false); setEditing(null); }} />
    </div>
  );
}

function VendorDialog({
  open, vendor, weddingId, currency, onClose,
}: {
  open: boolean;
  vendor: Vendor | null;
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
    const num = (k: string) => (fd.get(k) === "" || fd.get(k) == null ? null : Number(fd.get(k)));
    const input = {
      name: String(fd.get("name") ?? ""),
      category: String(fd.get("category") ?? "Other"),
      contact_person: String(fd.get("contact_person") ?? "") || null,
      phone: String(fd.get("phone") ?? "") || null,
      email: String(fd.get("email") ?? "") || null,
      website: String(fd.get("website") ?? "") || null,
      address: String(fd.get("address") ?? "") || null,
      quoted_price: num("quoted_price"),
      contracted_price: num("contracted_price"),
      booking_status: String(fd.get("booking_status") ?? "considering"),
      rating: fd.get("rating") ? Number(fd.get("rating")) : null,
      meeting_date: String(fd.get("meeting_date") ?? "") || null,
      payment_terms: String(fd.get("payment_terms") ?? "") || null,
      includes_notes: String(fd.get("includes_notes") ?? "") || null,
      notes: String(fd.get("notes") ?? "") || null,
    };
    const r = vendor ? await updateVendor(weddingId, vendor.id, input) : await createVendor(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    toast("success", vendor ? "Vendor updated." : "Vendor added.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader title={vendor ? "Edit vendor" : "Add vendor"} />
        <form onSubmit={onSubmit} className="space-y-4" key={vendor?.id ?? "new"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="v-name" required>Vendor name</Label>
              <Input id="v-name" name="name" required defaultValue={vendor?.name} className="mt-1.5" autoFocus />
            </div>
            <div>
              <Label htmlFor="v-cat">Category</Label>
              <Select name="category" defaultValue={vendor?.category ?? "Other"}>
                <SelectTrigger id="v-cat" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor="v-contact">Contact person</Label><Input id="v-contact" name="contact_person" defaultValue={vendor?.contact_person ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="v-phone">Phone</Label><Input id="v-phone" name="phone" defaultValue={vendor?.phone ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="v-email">Email</Label><Input id="v-email" name="email" type="email" defaultValue={vendor?.email ?? ""} className="mt-1.5" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="v-quote" hint={`(${currency})`}>Quoted price</Label><Input id="v-quote" name="quoted_price" type="number" min="0" step="0.01" defaultValue={vendor?.quoted_price ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="v-contract" hint={`(${currency})`}>Contracted price</Label><Input id="v-contract" name="contracted_price" type="number" min="0" step="0.01" defaultValue={vendor?.contracted_price ?? ""} className="mt-1.5" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="v-status">Booking status</Label>
              <Select name="booking_status" defaultValue={vendor?.booking_status ?? "considering"}>
                <SelectTrigger id="v-status" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["considering", "contacted", "quoted", "booked", "declined", "completed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="v-meeting">Meeting date</Label><Input id="v-meeting" name="meeting_date" type="date" defaultValue={vendor?.meeting_date ?? ""} className="mt-1.5" /></div>
            <div><Label htmlFor="v-rating" hint="1–5">Rating</Label><Input id="v-rating" name="rating" type="number" min="1" max="5" defaultValue={vendor?.rating ?? ""} className="mt-1.5" /></div>
          </div>
          <div><Label htmlFor="v-terms" hint="for comparison">Payment terms</Label><Input id="v-terms" name="payment_terms" defaultValue={vendor?.payment_terms ?? ""} className="mt-1.5" placeholder="50% deposit, 50% on day" /></div>
          <div><Label htmlFor="v-includes" hint="for comparison">Included services</Label><Textarea id="v-includes" name="includes_notes" rows={2} defaultValue={vendor?.includes_notes ?? ""} className="mt-1.5" /></div>
          <div><Label htmlFor="v-notes" hint="private">Notes</Label><Textarea id="v-notes" name="notes" rows={2} defaultValue={vendor?.notes ?? ""} className="mt-1.5" /></div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>{vendor ? "Save changes" : "Add vendor"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
