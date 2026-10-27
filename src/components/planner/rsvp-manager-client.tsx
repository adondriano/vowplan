"use client";
import { useMemo, useState, useTransition } from "react";
import {
  Copy, QrCode, Download, Send, PhoneCall, RotateCcw, Search, MailCheck,
  Printer, Pencil, CheckCircle2, XCircle, Clock, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { computePaxTotals } from "@/lib/domain/pax";
import {
  markInvitationSent, markInvitationContacted, setInvitationFollowUp, restoreInvitationAction, adminUpdateRsvp, updateGreeting,
} from "@/lib/actions/guests";
import { formatDate, relativeTime, formatMoney } from "@/lib/domain/format";
import type { Guest, GuestGroup, Invitation, RsvpResponse, Wedding } from "@/lib/domain/types";

type Row = {
  invitation: Invitation;
  group: GuestGroup;
  guests: Guest[];
  response: RsvpResponse | null;
};

export function RsvpManagerClient({
  weddingId,
  wedding,
  invitations,
  groups,
  guests,
  responses,
  initialStatusFilter,
}: {
  weddingId: string;
  wedding: Wedding;
  invitations: Invitation[];
  groups: GuestGroup[];
  guests: Guest[];
  responses: RsvpResponse[];
  initialStatusFilter: string;
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [search, setSearch] = useState("");
  const [qrRow, setQrRow] = useState<Row | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);

  const rows: Row[] = useMemo(() => {
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const guestsByGroup = new Map<string, Guest[]>();
    for (const g of guests) {
      if (!g.group_id) continue;
      const list = guestsByGroup.get(g.group_id) ?? [];
      list.push(g);
      guestsByGroup.set(g.group_id, list);
    }
    const responseByInv = new Map(responses.map((r) => [r.invitation_id, r]));
    return invitations
      .map((inv) => {
        const group = groupById.get(inv.group_id);
        if (!group) return null;
        return {
          invitation: inv,
          group,
          guests: guestsByGroup.get(inv.group_id) ?? [],
          response: responseByInv.get(inv.id) ?? null,
        };
      })
      .filter(Boolean) as Row[];
  }, [invitations, groups, guests, responses]);

  const today = new Date().toISOString().slice(0, 10);
  const pax = computePaxTotals(groups, invitations, responses);
  const deadlinePassed = wedding.rsvp_deadline ? wedding.rsvp_deadline < today : false;

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all") {
          const s = effectiveStatus(r);
          if (statusFilter === "awaiting_response" && !(s === "sent" || s === "pending" || s === "ready")) return false;
          if (statusFilter !== "awaiting_response" && s !== statusFilter) return false;
        }
        if (search) {
          const hay = `${r.group.name} ${r.invitation.greeting_name ?? ""} ${r.guests.map((g) => g.first_name).join(" ")}`.toLowerCase();
          if (!hay.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [rows, statusFilter, search],
  );

  function copyLink(r: Row) {
    startTransition(async () => {
      const res = await fetch(`/api/invitations/${r.invitation.id}/token`);
      if (!res.ok) {
        toast("error", "Could not retrieve the link.");
        return;
      }
      const { token } = await res.json();
      const url = `${window.location.origin}/invite/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast("success", `Link copied for ${r.group.name}.`);
      } catch {
        toast("error", "Clipboard unavailable — the link is: " + url);
      }
    });
  }

  function copyInviteMessage(r: Row) {
    startTransition(async () => {
      const res = await fetch(`/api/invitations/${r.invitation.id}/token`);
      if (!res.ok) return toast("error", "Could not retrieve the link.");
      const { token } = await res.json();
      const url = `${window.location.origin}/invite/${token}`;
      const names = [wedding.bride_name, wedding.groom_name].filter(Boolean).join(" & ");
      const greeting = r.invitation.greeting_name ?? r.group.name;
      const msg = `Dear ${greeting}, you are warmly invited to the wedding of ${names}` +
        (wedding.wedding_date ? ` on ${formatDate(wedding.wedding_date, "MMMM d, yyyy")}` : "") +
        `. View your invitation and RSVP here: ${url}` +
        (wedding.rsvp_deadline ? ` (kindly reply by ${formatDate(wedding.rsvp_deadline, "MMMM d, yyyy")})` : "");
      try {
        await navigator.clipboard.writeText(msg);
        toast("success", "Invitation message copied.");
      } catch {
        toast("error", "Clipboard unavailable.");
      }
    });
  }

  function downloadQr(r: Row, format: "png" | "svg") {
    window.open(`/api/qr/${r.invitation.id}?format=${format}`, "_blank");
  }

  function printQrSheet() {
    window.print();
  }

  async function doAction(fn: () => Promise<{ error?: string } | { ok: true }>, successMsg: string) {
    const r = await fn();
    if ("error" in r && r.error) toast("error", r.error);
    else toast("success", successMsg);
  }

  const rsvpSettings = wedding.rsvp_settings ?? {};

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">RSVP Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Responses, follow-ups, and guest links{wedding.rsvp_deadline && ` · deadline ${formatDate(wedding.rsvp_deadline, "MMM d, yyyy")}`}
            {deadlinePassed && <Badge tone="destructive" className="ml-2">Deadline passed</Badge>}
            {"rsvpSettings" in wedding && (rsvpSettings as { closed?: boolean }).closed && <Badge tone="destructive" className="ml-2">RSVPs closed</Badge>}
          </p>
        </div>
        <Button variant="outline" onClick={printQrSheet}>
          <Printer className="size-4" aria-hidden="true" /> Print link sheet
        </Button>
      </header>

      <section aria-label="RSVP summary" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Confirmed PAX" value={pax.confirmedPax.toLocaleString()} sub={`${pax.confirmedGroups} households`} tone="success" icon={<CheckCircle2 />} />
        <StatCard label="Pending PAX" value={pax.pendingPax.toLocaleString()} sub={`${pax.pendingGroups} households to follow up`} tone={pax.pendingGroups > 0 ? "warning" : "neutral"} icon={<Clock />} />
        <StatCard label="Declined" value={pax.declinedGroups.toLocaleString()} sub="households" icon={<XCircle />} />
        <StatCard label="Response rate" value={`${pax.responseRate}%`} sub={`${pax.invitedPax.toLocaleString()} invited PAX total`} icon={<MailCheck />} />
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search households…" className="pl-9" aria-label="Search RSVPs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All invitations</SelectItem>
            <SelectItem value="awaiting_response">Awaiting response</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="follow_up">Needs follow-up</SelectItem>
            <SelectItem value="cancelled">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Link2 />}
          title={rows.length === 0 ? "No invitation links yet" : "Nothing matches this filter"}
          description={rows.length === 0 ? "Generate personal links from the Guest List — each household gets a private invitation URL and QR code." : "Try a different filter."}
        />
      ) : (
        <ul className="mt-5 space-y-2">
          {filtered.map((r) => {
            const s = effectiveStatus(r);
            return (
              <li key={r.invitation.id} className="card px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {r.group.name}
                      <StatusBadge status={s} />
                      {r.invitation.max_pax > 1 && <Badge tone="neutral">up to {r.invitation.max_pax} pax</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.response
                        ? r.response.status === "confirmed"
                          ? `${r.response.attending_count} attending · updated ${relativeTime(r.response.updated_at)}`
                          : `Declined · ${relativeTime(r.response.submitted_at)}`
                        : r.invitation.sent_at
                          ? `Sent ${relativeTime(r.invitation.sent_at)} · awaiting response`
                          : "Link ready — not yet marked as sent"}
                      {r.invitation.last_contacted_at && ` · last contact ${relativeTime(r.invitation.last_contacted_at)}`}
                    </p>
                    {r.response?.message_to_couple && (
                      <p className="mt-1.5 rounded-lg bg-surface-warm px-3 py-1.5 text-xs italic text-foreground-secondary">
                        “{r.response.message_to_couple}”
                      </p>
                    )}
                    {(r.response?.dietary_notes || r.response?.accessibility_notes) && (
                      <p className="mt-1 text-xs text-info">
                        {r.response?.dietary_notes && `Dietary: ${r.response.dietary_notes}`}
                        {r.response?.dietary_notes && r.response?.accessibility_notes && " · "}
                        {r.response?.accessibility_notes && `Access: ${r.response.accessibility_notes}`}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => copyLink(r)} title="Copy RSVP link">
                      <Copy aria-hidden="true" /> Link
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setQrRow(r)} title="Show QR code">
                      <QrCode aria-hidden="true" /> QR
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copyInviteMessage(r)} title="Copy invitation message">
                      <Send aria-hidden="true" /> Message
                    </Button>
                    {s !== "confirmed" && s !== "declined" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => doAction(() => markInvitationSent(weddingId, r.invitation.id), "Marked as sent (you shared the link).")}
                        title="Mark as sent"
                      >
                        Mark sent
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const notes = prompt(`Follow-up notes for ${r.group.name} (optional):`, r.invitation.follow_up_notes ?? "");
                        if (notes === null) return;
                        doAction(async () => {
                          const a = await markInvitationContacted(weddingId, r.invitation.id, notes);
                          if ("error" in a && a.error) return a;
                          return setInvitationFollowUp(weddingId, r.invitation.id);
                        }, "Marked for follow-up.");
                      }}
                      title="Mark contacted / needs follow-up"
                    >
                      <PhoneCall aria-hidden="true" /> Follow-up
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditRow(r)} title="Edit response or greeting">
                      <Pencil aria-hidden="true" /> Edit
                    </Button>
                  </div>
                </div>

                {r.invitation.status === "cancelled" && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive-soft/60 px-3 py-2 text-xs text-destructive">
                    <span>Link revoked — the old URL no longer opens the invitation.</span>
                    <Button size="sm" variant="outline" onClick={() => doAction(() => restoreInvitationAction(weddingId, r.invitation.id), "New link issued — copy it again.")}>
                      <RotateCcw className="size-3.5" aria-hidden="true" /> Re-issue link
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* QR dialog */}
      <Dialog open={qrRow != null} onOpenChange={(o) => !o && setQrRow(null)}>
        <DialogContent>
          <DialogHeader
            title={`QR code — ${qrRow?.group.name ?? ""}`}
            description="Scanning opens this household's personal invitation. The QR encodes only the link, never personal data."
          />
          {qrRow && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border border-border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qr/${qrRow.invitation.id}?format=svg`}
                  alt={`QR code linking to the invitation for ${qrRow.group.name}`}
                  width={220}
                  height={220}
                />
              </div>
              <p className="break-all text-center text-xs text-muted-foreground">Printable cards include the URL below the code for manual entry.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => downloadQr(qrRow, "png")}>
                  <Download aria-hidden="true" /> PNG
                </Button>
                <Button variant="outline" onClick={() => downloadQr(qrRow, "svg")}>
                  <Download aria-hidden="true" /> SVG
                </Button>
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer aria-hidden="true" /> Print card
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit response / greeting dialog */}
      {editRow && (
        <EditRsvpDialog
          row={editRow}
          weddingId={weddingId}
          currency={wedding.currency}
          onClose={() => setEditRow(null)}
        />
      )}
    </div>
  );
}

function EditRsvpDialog({ row, weddingId, onClose }: { row: Row; weddingId: string; currency: string; onClose: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const maxPax = row.invitation.max_pax;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    let hadError = false;

    const greeting = String(fd.get("greeting") ?? "");
    const g = await updateGreeting(weddingId, row.invitation.id, greeting);
    if ("error" in g && g.error) {
      toast("error", g.error);
      hadError = true;
    }

    if (row.response) {
      const status = String(fd.get("status"));
      const count = Number(fd.get("count") ?? 0);
      const r = await adminUpdateRsvp(weddingId, row.response.id, {
        status,
        attending_count: status === "confirmed" ? count : 0,
      });
      if ("error" in r && r.error) {
        toast("error", r.error);
        hadError = true;
      }
    }
    setBusy(false);
    if (!hadError) {
      toast("success", "Invitation updated.");
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader
          title={`Edit — ${row.group.name}`}
          description={row.response ? "Planner corrections are allowed even after the deadline and are recorded in the response history." : "Set the greeting guests see when they open their invitation."}
        />
        <form onSubmit={save} className="space-y-4">
          <div>
            <label htmlFor="er-greeting" className="text-sm font-medium">Personal greeting on the invitation</label>
            <Input id="er-greeting" name="greeting" defaultValue={row.invitation.greeting_name ?? row.group.name} className="mt-1.5" placeholder="e.g. Tita Baby & Family" />
          </div>
          {row.response ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="er-status" className="text-sm font-medium">Response status</label>
                <Select name="status" defaultValue={row.response.status}>
                  <SelectTrigger id="er-status" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="er-count" className="text-sm font-medium">Attending count (max {maxPax})</label>
                <Input id="er-count" name="count" type="number" min={0} max={maxPax} defaultValue={row.response.attending_count} className="mt-1.5" />
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-surface-warm px-3 py-2.5 text-xs text-muted-foreground">
              No response yet. Planners can record a response here after the guest replies by phone or message.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "neutral" | "primary" | "success" | "warning" | "destructive" | "info"; label: string }> = {
    draft: { tone: "neutral", label: "Draft" },
    ready: { tone: "info", label: "Link ready" },
    sent: { tone: "primary", label: "Sent" },
    pending: { tone: "warning", label: "Pending" },
    confirmed: { tone: "success", label: "Confirmed" },
    declined: { tone: "neutral", label: "Declined" },
    follow_up: { tone: "warning", label: "Follow up" },
    cancelled: { tone: "destructive", label: "Revoked" },
  };
  const v = map[status] ?? map.ready;
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

export function effectiveStatus(r: Row): string {
  if (r.invitation.status === "cancelled") return "cancelled";
  if (r.invitation.status === "follow_up") return "follow_up";
  if (r.response) return r.response.status;
  if (r.invitation.status === "confirmed") return "confirmed";
  if (r.invitation.status === "declined") return "declined";
  if (r.invitation.sent_at) return "sent";
  return r.invitation.status;
}

// re-exported for potential reuse
export { formatMoney };
