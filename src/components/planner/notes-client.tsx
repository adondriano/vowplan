"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, NotebookPen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createDecision, updateDecision, deleteDecision } from "@/lib/actions/directory";
import { formatDate } from "@/lib/domain/format";
import type { Decision } from "@/lib/domain/types";

const STATUS_TONE: Record<Decision["status"], "neutral" | "success" | "warning" | "info"> = {
  proposed: "info",
  decided: "success",
  deferred: "neutral",
  revisited: "warning",
};

export function NotesClient({ weddingId, decisions }: { weddingId: string; decisions: Decision[] }) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Decision | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = decisions.filter((d) => statusFilter === "all" || d.status === statusFilter);

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Notes &amp; Decisions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your structured decision log — what was decided, when, and by whom.</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="proposed">Proposed</SelectItem>
              <SelectItem value="decided">Decided</SelectItem>
              <SelectItem value="deferred">Deferred</SelectItem>
              <SelectItem value="revisited">Revisit</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" /> New decision</Button>
        </div>
      </header>

      {filtered.length === 0 ? (
        <EmptyState className="mt-6" icon={<NotebookPen />} title={decisions.length === 0 ? "No decisions logged yet" : "Nothing with this status"} description={decisions.length === 0 ? "Log choices like 'Venue: Tagaytay vs Antipolo' with dates and owners." : "Try another filter."} action={<Button onClick={() => setCreating(true)}>Log a decision</Button>} />
      ) : (
        <ol className="mt-5 space-y-2">
          {filtered.map((d) => (
            <li key={d.id} className="card px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {d.title} <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[d.decision_date ? formatDate(d.decision_date, "MMM d, yyyy") : null, d.category, d.responsible ? `by ${d.responsible}` : null].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {d.description && <p className="mt-1.5 text-sm text-foreground-secondary">{d.description}</p>}
                  {d.notes && <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${d.title}`} onClick={() => setEditing(d)}><Pencil aria-hidden="true" /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${d.title}`} className="hover:text-destructive" onClick={() => { if (confirm(`Delete "${d.title}" from the log?`)) startTransition(async () => { await deleteDecision(weddingId, d.id); }); }}><Trash2 aria-hidden="true" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <DecisionDialog open={creating || editing != null} decision={editing} weddingId={weddingId} onClose={() => { setCreating(false); setEditing(null); }} />
    </div>
  );
}

function DecisionDialog({ open, decision, weddingId, onClose }: { open: boolean; decision: Decision | null; weddingId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? "") || null,
      decision_date: String(fd.get("decision_date") ?? "") || null,
      category: String(fd.get("category") ?? "") || null,
      responsible: String(fd.get("responsible") ?? "") || null,
      status: String(fd.get("status") ?? "proposed"),
      notes: String(fd.get("notes") ?? "") || null,
    };
    const r = decision ? await updateDecision(weddingId, decision.id, input) : await createDecision(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    toast("success", decision ? "Decision updated." : "Decision logged.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader title={decision ? "Edit decision" : "Log a decision"} />
        <form onSubmit={onSubmit} className="space-y-4" key={decision?.id ?? "new"}>
          <div>
            <Label htmlFor="dc-title" required>Decision</Label>
            <Input id="dc-title" name="title" required defaultValue={decision?.title} className="mt-1.5" autoFocus placeholder="Venue: chose Tagaytay garden" />
          </div>
          <div><Label htmlFor="dc-desc" hint="context & reasoning">Description</Label><Textarea id="dc-desc" name="description" rows={3} defaultValue={decision?.description ?? ""} className="mt-1.5" /></div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div><Label htmlFor="dc-date">Date</Label><Input id="dc-date" name="decision_date" type="date" defaultValue={decision?.decision_date ?? new Date().toISOString().slice(0, 10)} className="mt-1.5" /></div>
            <div><Label htmlFor="dc-cat" hint="optional">Category</Label><Input id="dc-cat" name="category" defaultValue={decision?.category ?? ""} className="mt-1.5" placeholder="Venue" /></div>
            <div><Label htmlFor="dc-resp" hint="optional">Responsible</Label><Input id="dc-resp" name="responsible" defaultValue={decision?.responsible ?? ""} className="mt-1.5" placeholder="Maria" /></div>
            <div>
              <Label htmlFor="dc-status">Status</Label>
              <Select name="status" defaultValue={decision?.status ?? "proposed"}>
                <SelectTrigger id="dc-status" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="decided">Decided</SelectItem>
                  <SelectItem value="deferred">Deferred</SelectItem>
                  <SelectItem value="revisited">Revisit later</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label htmlFor="dc-notes" hint="optional">Notes</Label><Input id="dc-notes" name="notes" defaultValue={decision?.notes ?? ""} className="mt-1.5" /></div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{decision ? "Save" : "Log decision"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
