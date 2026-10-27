"use client";
import { useMemo, useState, useTransition } from "react";
import { Save, Rocket, Eye, Loader2, Undo2, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { saveInvitationDraft, publishInvitation, unpublishInvitation, ensureInitialDraft } from "@/lib/actions/settings";
import { updateEvent } from "@/lib/actions/timeline";
import { TEMPLATE_PRESETS, type InvitationContent, type InvitationTheme } from "@/lib/domain/invitation";
import { formatDate, formatTime } from "@/lib/domain/format";
import type { InvitationVersion, Venue, WeddingEvent } from "@/lib/domain/types-extended";
import { cn } from "@/lib/utils";

export function InvitationStudio({
  weddingId,
  weddingName,
  weddingDate,
  dateStatus,
  rsvpDeadline,
  isPublished,
  content: initialContent,
  theme: initialTheme,
  publishedContent,
  versions,
  venues,
  publicEvents,
}: {
  weddingId: string;
  weddingName: string;
  weddingDate: string | null;
  dateStatus: string;
  rsvpDeadline: string | null;
  isPublished: boolean;
  content: InvitationContent;
  theme: InvitationTheme;
  publishedContent: InvitationContent | null;
  versions: InvitationVersion[];
  venues: Venue[];
  publicEvents: WeddingEvent[];
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState<InvitationContent>(initialContent);
  const [theme, setTheme] = useState<InvitationTheme>(initialTheme);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const patchContent = (p: Partial<InvitationContent>) => {
    setContent((c) => ({ ...c, ...p }));
    setDirty(true);
  };
  const patchTheme = (p: Partial<InvitationTheme>) => {
    setTheme((t) => ({ ...t, ...p }));
    setDirty(true);
  };

  const sections = useMemo(() => content.sections, [content.sections]);

  function toggleSection(id: string, visible: boolean) {
    patchContent({ sections: sections.map((s) => (s.id === id ? { ...s, visible } : s)) });
  }
  function moveSection(id: string, dir: -1 | 1) {
    const idx = sections.findIndex((s) => s.id === id);
    const swap = sections[idx + dir];
    if (!swap) return;
    const next = [...sections];
    next[idx] = swap;
    next[idx + dir] = sections[idx];
    patchContent({ sections: next });
  }

  function saveDraft() {
    startTransition(async () => {
      const r = await saveInvitationDraft(weddingId, content, theme);
      if ("error" in r && r.error) toast("error", r.error);
      else {
        toast("success", "Draft saved. Publish when you're ready — guests still see the last published version.");
        setDirty(false);
      }
    });
  }

  function publish() {
    startTransition(async () => {
      await ensureInitialDraft(weddingId);
      // Save current edits into a new draft version first, then publish it.
      const saved = await saveInvitationDraft(weddingId, content, theme);
      if ("error" in saved && saved.error) {
        toast("error", saved.error);
        return;
      }
      const r = await publishInvitation(weddingId, saved.versionId);
      if ("error" in r && r.error) toast("error", r.error);
      else toast("success", "Invitation published! Guest links now show this version.");
    });
  }

  function unpublish() {
    if (!confirm("Unpublish the invitation? Guest links will show a polite 'not yet available' page.")) return;
    startTransition(async () => {
      await unpublishInvitation(weddingId);
      toast("success", "Invitation unpublished.");
    });
  }

  function toggleEventPublic(e: WeddingEvent) {
    startTransition(async () => {
      const r = await updateEvent(weddingId, e.id, { is_public: !e.is_public });
      if ("error" in r && r.error) toast("error", r.error);
    });
  }

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Invitation Website</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {isPublished ? (
              <>
                <Badge tone="success" icon={<CheckCircle2 className="size-3" />}>Published</Badge>
                {publishedContent && <span>Guest links show the published version.</span>}
              </>
            ) : (
              <>
                <Badge tone="warning">Not published</Badge>
                <span>Guest links show a placeholder until you publish.</span>
              </>
            )}
            {dirty && <Badge tone="info">Unsaved edits</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="size-4" aria-hidden="true" /> Preview
          </Button>
          <Button variant="secondary" onClick={saveDraft} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />} Save draft
          </Button>
          {isPublished ? (
            <Button variant="outline" onClick={unpublish} disabled={pending}>
              <Undo2 className="size-4" aria-hidden="true" /> Unpublish
            </Button>
          ) : (
            <Button variant="gold" onClick={publish} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Rocket className="size-4" aria-hidden="true" />} Publish
            </Button>
          )}
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Theme */}
        <Card>
          <CardHeader><CardTitle>Theme</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(TEMPLATE_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patchTheme({ ...preset.theme, template: id as never, palette: { ...theme.palette, ...(preset.theme.palette ?? {}) } })}
                  aria-pressed={theme.template === id}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3 text-left transition-all",
                    theme.template === id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-border-strong",
                  )}
                >
                  <span
                    className="block h-10 w-full rounded-lg border border-black/5"
                    style={{ background: `linear-gradient(135deg, ${preset.theme.palette?.bg ?? "#fff"}, ${preset.theme.palette?.primary ?? "#9D2C4E"}22)` }}
                    aria-hidden="true"
                  />
                  <span className="mt-2 block text-xs font-semibold">{preset.label}</span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">{preset.description}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["bg", "primary", "accent"] as const).map((key) => (
                <div key={key}>
                  <Label htmlFor={`pal-${key}`} className="!text-xs capitalize">{key}</Label>
                  <input
                    id={`pal-${key}`}
                    type="color"
                    value={theme.palette[key]}
                    onChange={(e) => patchTheme({ palette: { ...theme.palette, [key]: e.target.value } })}
                    className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-border bg-surface p-1"
                    aria-label={`${key} color`}
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="th-heading">Heading font</Label>
                <Select value={theme.headingFont} onValueChange={(v) => patchTheme({ headingFont: v as never })}>
                  <SelectTrigger id="th-heading" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cormorant">Cormorant (elegant serif)</SelectItem>
                    <SelectItem value="playfair">Playfair (editorial)</SelectItem>
                    <SelectItem value="ebgaramond">EB Garamond (classic)</SelectItem>
                    <SelectItem value="dancing">Dancing Script</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="th-script">Script accent</Label>
                <Select value={theme.scriptFont} onValueChange={(v) => patchTheme({ scriptFont: v as never })}>
                  <SelectTrigger id="th-script" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vibes">Great Vibes</SelectItem>
                    <SelectItem value="dancing">Dancing Script</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="th-ornament">Ornament</Label>
              <Select value={theme.ornament} onValueChange={(v) => patchTheme({ ornament: v as never })}>
                <SelectTrigger id="th-ornament" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="floral">Floral</SelectItem>
                  <SelectItem value="geometric">Geometric rules</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Cover & message */}
        <Card>
          <CardHeader><CardTitle>Cover &amp; invitation message</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ic-kicker">Cover kicker</Label>
              <Input id="ic-kicker" value={content.coverKicker} onChange={(e) => patchContent({ coverKicker: e.target.value })} className="mt-1.5" placeholder="Together with their families" />
            </div>
            <div>
              <Label htmlFor="ic-heading">Cover heading</Label>
              <Input id="ic-heading" value={content.coverHeading} onChange={(e) => patchContent({ coverHeading: e.target.value })} className="mt-1.5" placeholder={weddingName} />
            </div>
            <div>
              <Label htmlFor="ic-monogram" hint="e.g. M & J">Monogram</Label>
              <Input id="ic-monogram" maxLength={6} value={content.monogramText} onChange={(e) => patchContent({ monogramText: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="ic-msg" hint="shown after the cover">Invitation message</Label>
              <Textarea id="ic-msg" rows={4} value={content.invitationMessage} onChange={(e) => patchContent({ invitationMessage: e.target.value })} className="mt-1.5" placeholder="request the honour of your presence…" />
            </div>
            <div>
              <Label htmlFor="ic-closing">Closing message</Label>
              <Textarea id="ic-closing" rows={2} value={content.closingMessage} onChange={(e) => patchContent({ closingMessage: e.target.value })} className="mt-1.5" placeholder="With love, Maria & Juan" />
            </div>
          </CardContent>
        </Card>

        {/* Sections visibility & order */}
        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
            <p className="text-xs text-muted-foreground">Hide what you don&apos;t need and reorder the flow.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {sections.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="flex-1 text-sm capitalize">{s.id.replace(/([A-Z])/g, " $1").trim()}</span>
                  <button type="button" onClick={() => moveSection(s.id, -1)} disabled={i === 0} aria-label={`Move ${s.id} up`} className="cursor-pointer rounded px-1.5 text-muted-foreground hover:bg-surface-warm disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveSection(s.id, 1)} disabled={i === sections.length - 1} aria-label={`Move ${s.id} down`} className="cursor-pointer rounded px-1.5 text-muted-foreground hover:bg-surface-warm disabled:opacity-30">↓</button>
                  <Switch checked={s.visible} onCheckedChange={(v) => toggleSection(s.id, v)} aria-label={`Toggle ${s.id} section`} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader><CardTitle>Details shown to guests</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ic-ceremony">Ceremony time text</Label>
                <Input id="ic-ceremony" value={content.ceremonyTime} onChange={(e) => patchContent({ ceremonyTime: e.target.value })} className="mt-1.5" placeholder="3:00 in the afternoon" />
              </div>
              <div>
                <Label htmlFor="ic-reception">Reception time text</Label>
                <Input id="ic-reception" value={content.receptionTime} onChange={(e) => patchContent({ receptionTime: e.target.value })} className="mt-1.5" placeholder="5:30 onwards" />
              </div>
            </div>
            <div>
              <Label htmlFor="ic-map" hint="Google Maps link">Map URL</Label>
              <Input id="ic-map" type="url" value={content.mapUrl} onChange={(e) => patchContent({ mapUrl: e.target.value })} className="mt-1.5" placeholder="https://maps.google.com/…" />
            </div>
            <div>
              <Label htmlFor="ic-dress">Dress code</Label>
              <Input id="ic-dress" value={content.dressCode} onChange={(e) => patchContent({ dressCode: e.target.value })} className="mt-1.5" placeholder="Semi-formal · muted tones" />
            </div>
            <div>
              <Label>Publishable venues</Label>
              <p className="mb-1.5 text-xs text-muted-foreground">Only venues you marked public in Venues &amp; Logistics can appear.</p>
              <div className="space-y-1.5">
                {venues.filter((v) => v.is_public).length === 0 && (
                  <p className="rounded-lg bg-surface-warm px-3 py-2 text-xs text-muted-foreground">No public venues yet — mark one public from the Venues page.</p>
                )}
                {venues
                  .filter((v) => v.is_public)
                  .map((v) => {
                    const checked = content.venueIds.includes(v.id);
                    return (
                      <label key={v.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm">
                        <Switch
                          checked={checked}
                          onCheckedChange={(on) =>
                            patchContent({ venueIds: on ? [...content.venueIds, v.id] : content.venueIds.filter((x) => x !== v.id) })
                          }
                          aria-label={`Toggle ${v.name}`}
                        />
                        <span>{v.name} <span className="text-xs text-muted-foreground">({v.role})</span></span>
                      </label>
                    );
                  })}
              </div>
            </div>
            <div>
              <Label>Wedding-day schedule on the invitation</Label>
              <p className="mb-1.5 text-xs text-muted-foreground">You control every entry — toggle guests&apos; visibility of the run-of-show.</p>
              <div className="space-y-1.5">
                {publicEvents.length === 0 && (
                  <p className="rounded-lg bg-surface-warm px-3 py-2 text-xs text-muted-foreground">No guest-visible schedule entries yet — enable the eye icon on Timeline entries.</p>
                )}
                {publicEvents.map((e) => (
                  <label key={e.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm">
                    <Switch checked defaultChecked onCheckedChange={() => toggleEventPublic(e)} aria-label={`Toggle ${e.title}`} />
                    <span>{e.title} <span className="text-xs text-muted-foreground">{e.start_time ? formatTime(e.start_time) : ""}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="ic-gift" hint="optional">Gift / registry note</Label>
              <Textarea id="ic-gift" rows={2} value={content.giftNote} onChange={(e) => patchContent({ giftNote: e.target.value })} className="mt-1.5" placeholder="Your presence is the greatest gift…" />
            </div>
            <div>
              <Label>FAQ</Label>
              <div className="space-y-2">
                {content.faq.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Input value={f.q} onChange={(e) => patchContent({ faq: content.faq.map((x, xi) => (xi === i ? { ...x, q: e.target.value } : x)) })} placeholder="Question" aria-label={`FAQ ${i + 1} question`} />
                      <Input value={f.a} onChange={(e) => patchContent({ faq: content.faq.map((x, xi) => (xi === i ? { ...x, a: e.target.value } : x)) })} placeholder="Answer" aria-label={`FAQ ${i + 1} answer`} />
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove FAQ" onClick={() => patchContent({ faq: content.faq.filter((_, xi) => xi !== i) })} className="mt-1 hover:text-destructive">
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => patchContent({ faq: [...content.faq, { q: "", a: "" }] })}>
                  <Plus className="size-4" aria-hidden="true" /> Add FAQ
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="ic-reminders">Important reminders (one per line)</Label>
              <Textarea
                id="ic-reminders"
                rows={3}
                value={content.reminders.join("\n")}
                onChange={(e) => patchContent({ reminders: e.target.value.split("\n").filter((x) => x.trim() !== "").slice(0, 12) })}
                className="mt-1.5"
                placeholder={"Doors open at 2:30 PM\nParking is available at the venue"}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader className="flex items-center justify-between !pb-2">
          <CardTitle>Version history</CardTitle>
          <Badge tone={isPublished ? "success" : "neutral"}>{isPublished ? "Live" : "Draft only"}</Badge>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved versions yet — the first save creates v1.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {versions.slice(0, 6).map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>
                    Version {v.version} · saved {formatDate(v.created_at, "MMM d, HH:mm")}
                    {v.published && <Badge tone="success" className="ml-2">published</Badge>}
                  </span>
                  {v.published && <span className="text-xs text-muted-foreground">live since {formatDate(v.published_at, "MMM d")}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Drafts never change what guests see. Publishing promotes the newest draft; the previous published version is archived here.
          </p>
        </CardContent>
      </Card>

      {/* Preview modal — renders the same component guests will see */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent wide className="!max-w-4xl">
          <DialogHeader title="Preview — how guests will see it" description="This is your current draft, including unpublished edits." />
          <div className="rounded-xl border border-border">
            <PreviewFrame
              weddingName={weddingName}
              weddingDate={weddingDate}
              dateStatus={dateStatus}
              rsvpDeadline={rsvpDeadline}
              content={content}
              theme={theme}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <DialogClose asChild><Button variant="secondary">Close preview</Button></DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewFrame({
  weddingName,
  weddingDate,
  dateStatus,
  rsvpDeadline,
  content,
  theme,
}: {
  weddingName: string;
  weddingDate: string | null;
  dateStatus: string;
  rsvpDeadline: string | null;
  content: InvitationContent;
  theme: InvitationTheme;
}) {
  const visible = new Set(content.sections.filter((s) => s.visible).map((s) => s.id));
  return (
    <div className="p-6" style={{ background: theme.palette.bg, color: theme.palette.text }}>
      <div className="text-center">
        <p className="font-script text-2xl" style={{ color: theme.palette.primary }}>
          {content.monogramText || "M & J"}
        </p>
        {visible.has("cover") && (
          <>
            <p className="mt-2 text-xs uppercase tracking-[0.2em]" style={{ color: theme.palette.muted }}>{content.coverKicker}</p>
            <h3 className="mt-2 font-display text-3xl font-semibold">{content.coverHeading || weddingName}</h3>
            {weddingDate && (
              <p className="mt-1 text-sm" style={{ color: theme.palette.muted }}>
                {formatDate(weddingDate, "EEEE, MMMM d, yyyy")}
                {dateStatus === "tentative" && " · tentative"}
              </p>
            )}
          </>
        )}
        {visible.has("invitation") && content.invitationMessage && (
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed">{content.invitationMessage}</p>
        )}
        {visible.has("venues") && content.venueIds.length > 0 && (
          <p className="mt-3 text-sm">Venue details included · {content.venueIds.length} public venue(s)</p>
        )}
        {visible.has("schedule") && <p className="mt-2 text-sm">Guest-visible schedule included</p>}
        {visible.has("dressCode") && content.dressCode && <p className="mt-2 text-sm">Dress code: {content.dressCode}</p>}
        {visible.has("rsvp") && (
          <p className="mt-4 inline-block rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: theme.palette.primary }}>
            RSVP section · deadline {rsvpDeadline ? formatDate(rsvpDeadline, "MMM d, yyyy") : "none set"}
          </p>
        )}
        <p className="mt-4 text-xs" style={{ color: theme.palette.muted }}>Template: {TEMPLATE_PRESETS[theme.template].label}</p>
      </div>
    </div>
  );
}
