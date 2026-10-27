"use client";
import { useState } from "react";
import { Plus, Trash2, Images, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { MediaAsset } from "@/lib/domain/types";

export function InspirationClient({ weddingId, assets }: { weddingId: string; assets: MediaAsset[] }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  async function addUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    const title = String(fd.get("title") ?? "").trim() || file?.name || "Inspiration";
    const sourceUrl = String(fd.get("source_url") ?? "") || null;
    const sourceNote = String(fd.get("source_note") ?? "") || null;
    const tags = String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    if (!file || file.size === 0) {
      toast("error", "Choose an image first.");
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      toast("error", "Upload an image up to 8 MB.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const path = `${weddingId}/inspiration/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("wedding-media").upload(path, file, { upsert: false });
    if (upErr) {
      setBusy(false);
      toast("error", `Upload failed: ${upErr.message}`);
      return;
    }
    const { error: dbErr } = await supabase.from("media_assets").insert({
      wedding_id: weddingId,
      kind: "inspiration",
      title,
      storage_path: path,
      source_url: sourceUrl,
      source_note: sourceNote,
      tags,
    });
    setBusy(false);
    if (dbErr) {
      toast("error", `Saved the image but not the record: ${dbErr.message}`);
      return;
    }
    toast("success", "Added to your board.");
    setAddOpen(false);
  }

  async function removeAsset(asset: MediaAsset) {
    if (!confirm(`Remove "${asset.title ?? "this image"}" from the board?`)) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.storage.from("wedding-media").remove([asset.storage_path]);
    await supabase.from("media_assets").delete().eq("id", asset.id).eq("wedding_id", weddingId);
    setBusy(false);
    toast("success", "Removed.");
  }

  async function openImage(asset: MediaAsset) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("wedding-media").createSignedUrl(asset.storage_path, 300);
    if (error || !data) return toast("error", "Could not open the image.");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Inspiration Board</h1>
          <p className="mt-1 text-sm text-muted-foreground">Save references, palettes, and ideas — with their sources.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="size-4" aria-hidden="true" /> Add inspiration</Button>
      </header>

      {assets.length === 0 ? (
        <EmptyState className="mt-6" icon={<Images />} title="Your board is empty" description="Pin dress ideas, florals, color palettes, and venue references." action={<Button onClick={() => setAddOpen(true)}>Add first image</Button>} />
      ) : (
        <div className="mt-5 columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
          {assets.map((a) => (
            <figure key={a.id} className="card break-inside-avoid overflow-hidden">
              <button type="button" onClick={() => openImage(a)} className="block w-full cursor-zoom-in" aria-label={`Open ${a.title ?? "image"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/inspiration-image?path=${encodeURIComponent(a.storage_path)}`}
                  alt={a.title ?? "Inspiration image"}
                  loading="lazy"
                  className="w-full object-cover"
                />
              </button>
              <figcaption className="p-2.5">
                <p className="truncate text-xs font-medium">{a.title}</p>
                {a.source_url && (
                  <a href={a.source_url} target="_blank" rel="noreferrer noopener" className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-primary hover:underline">
                    <Link2 className="size-3 shrink-0" aria-hidden="true" /> source
                  </a>
                )}
                {a.source_note && <p className="text-[11px] text-muted-foreground">{a.source_note}</p>}
                {a.tags.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{a.tags.map((t) => <span key={t} className="rounded-full bg-surface-warm px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}</p>}
                <button
                  type="button"
                  onClick={() => removeAsset(a)}
                  className="mt-1.5 flex cursor-pointer items-center gap-1 text-[11px] text-destructive hover:underline"
                >
                  <Trash2 className="size-3" aria-hidden="true" /> remove
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader title="Add inspiration" description="Image + optional source. Saved to your private board." />
          <form onSubmit={addUpload} className="space-y-4">
            <div>
              <Label htmlFor="insp-file" required>Image</Label>
              <input
                id="insp-file"
                name="file"
                type="file"
                required
                accept="image/*"
                className="mt-1.5 block w-full cursor-pointer rounded-lg border border-border bg-surface p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-primary"
              />
            </div>
            <div><Label htmlFor="insp-title">Title</Label><Input id="insp-title" name="title" className="mt-1.5" placeholder="Floral arch idea" /></div>
            <div><Label htmlFor="insp-src" hint="optional">Source URL</Label><Input id="insp-src" name="source_url" type="url" className="mt-1.5" placeholder="https://pinterest.com/…" /></div>
            <div><Label htmlFor="insp-note" hint="optional">Source note</Label><Input id="insp-note" name="source_note" className="mt-1.5" placeholder="Saved from a supplier's page" /></div>
            <div><Label htmlFor="insp-tags" hint="comma-separated">Tags</Label><Input id="insp-tags" name="tags" className="mt-1.5" placeholder="flowers, arch" /></div>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                {busy ? "Adding…" : "Add to board"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
