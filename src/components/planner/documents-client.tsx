"use client";
import { useState } from "react";
import { Plus, Trash2, FolderOpen, FileText, Loader2, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/domain/format";
import type { WeddingDocument, Vendor } from "@/lib/domain/types";

const DOC_TYPES = ["Contract", "Quote", "Receipt", "Invoice", "Timeline", "Checklist", "Venue document", "Ceremony document", "Guest list", "Other"];

export function DocumentsClient({
  weddingId,
  documents,
  vendors,
}: {
  weddingId: string;
  documents: WeddingDocument[];
  vendors: Pick<Vendor, "id" | "name">[];
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    const title = String(fd.get("title") ?? "").trim() || file?.name || "Document";
    const docType = String(fd.get("doc_type") ?? "Other");
    const vendorId = String(fd.get("vendor_id") ?? "") || null;
    const notes = String(fd.get("notes") ?? "") || null;
    if (!file || file.size === 0) {
      toast("error", "Choose a file first.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast("error", "Files are limited to 15 MB.");
      return;
    }
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain"];
    if (!allowed.includes(file.type) && !/\.(pdf|docx?|xlsx?|txt|png|jpe?g|webp)$/i.test(file.name)) {
      toast("error", "Unsupported file type.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const path = `${weddingId}/documents/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("wedding-media")
      .upload(path, file, { upsert: false });
    if (upErr) {
      setBusy(false);
      toast("error", `Upload failed: ${upErr.message}`);
      return;
    }
    const { error: dbErr } = await supabase.from("wedding_documents").insert({
      wedding_id: weddingId,
      title,
      doc_type: docType,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type || null,
      vendor_id: vendorId,
      notes,
    });
    setBusy(false);
    if (dbErr) {
      toast("error", `Saved the file but not the record: ${dbErr.message}`);
      return;
    }
    toast("success", "Document uploaded to your private vault.");
    setUploadOpen(false);
  }

  async function openDoc(doc: WeddingDocument) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("wedding-media").createSignedUrl(doc.storage_path, 300);
    if (error || !data) {
      toast("error", "Could not open the file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function deleteDoc(doc: WeddingDocument) {
    if (!confirm(`Delete "${doc.title}"? The file is removed from storage too.`)) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.storage.from("wedding-media").remove([doc.storage_path]);
    await supabase.from("wedding_documents").delete().eq("id", doc.id).eq("wedding_id", weddingId);
    setBusy(false);
    toast("success", "Document deleted.");
  }

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Private contracts, quotes, and receipts — signed URLs only, never public.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}><Plus className="size-4" aria-hidden="true" /> Upload document</Button>
      </header>

      {documents.length === 0 ? (
        <EmptyState className="mt-6" icon={<FolderOpen />} title="No documents yet" description="Upload vendor contracts, quotations, and receipts (max 15 MB each)." action={<Button onClick={() => setUploadOpen(true)}>Upload first document</Button>} />
      ) : (
        <ul className="mt-5 space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
              <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {d.title} <Badge tone="neutral">{d.doc_type}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB · ` : ""}
                  {formatDate(d.created_at, "MMM d, yyyy")}
                  {d.vendor_id && ` · ${vendors.find((v) => v.id === d.vendor_id)?.name ?? "vendor"}`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openDoc(d)}><ExternalLink className="size-3.5" aria-hidden="true" /> Open</Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Delete ${d.title}`} className="hover:text-destructive" disabled={busy} onClick={() => deleteDoc(d)}><Trash2 aria-hidden="true" /></Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader title="Upload document" description="Stored privately — only workspace members can open it via signed URLs." />
          <form onSubmit={upload} className="space-y-4">
            <div>
              <Label htmlFor="doc-file" required>File</Label>
              <input
                id="doc-file"
                name="file"
                type="file"
                required
                className="mt-1.5 block w-full cursor-pointer rounded-lg border border-border bg-surface p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-primary"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
              />
            </div>
            <div>
              <Label htmlFor="doc-title">Title</Label>
              <Input id="doc-title" name="title" className="mt-1.5" placeholder="Catering contract v2" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="doc-type">Type</Label>
                <Select name="doc_type" defaultValue="Contract">
                  <SelectTrigger id="doc-type" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="doc-vendor" hint="optional">Vendor</Label>
                <Select name="vendor_id" defaultValue="">
                  <SelectTrigger id="doc-vendor" className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="doc-notes" hint="optional">Notes</Label>
              <Input id="doc-notes" name="notes" className="mt-1.5" />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4 rotate-180" aria-hidden="true" />}
                {busy ? "Uploading…" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
