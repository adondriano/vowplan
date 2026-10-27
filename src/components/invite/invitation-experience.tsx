"use client";
import { useEffect, useMemo, useState } from "react";
import { Mail, MapPin, CalendarDays, Gift, HelpCircle, Sparkles, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseInvitationContent, parseInvitationTheme } from "@/lib/domain/invitation";
import { formatDate, formatTime } from "@/lib/domain/format";
import { RsvpForm } from "@/components/invite/rsvp-form";

type View = {
  wedding: {
    brideName: string;
    groomName: string;
    partner1Label: string;
    partner2Label: string;
    weddingDate: string | null;
    dateStatus: string;
    location: string | null;
    rsvpDeadline: string | null;
    invitationContent: { content: unknown; theme: unknown } | null;
    rsvpSettings: Record<string, unknown>;
  };
  invitation: { id: string; greetingName: string | null; maxPax: number; status: string };
  group: { name: string; invitedPax: number; inviteeNames: { displayName: string }[] };
  response: {
    status: "confirmed" | "declined";
    attendingCount: number;
    mealPreferences: string | null;
    dietaryNotes: string | null;
    accessibilityNotes: string | null;
    messageToCouple: string | null;
    songRequest: string | null;
    submittedAt: string;
    updatedAt: string;
  } | null;
};

type PublicDetails = {
  venues: {
    id: string; name: string; role: string; address: string | null; mapUrl: string | null;
    parkingNotes: string | null; transitNotes: string | null; accessibilityNotes: string | null; accommodationNotes: string | null;
  }[];
  schedule: { title: string; startTime: string | null; endTime: string | null; location: string | null; description: string | null }[];
};

const HEADING_FONT: Record<string, string> = {
  cormorant: "var(--font-cormorant)",
  playfair: "var(--font-playfair)",
  ebgaramond: "var(--font-ebgaramond)",
  dancing: "var(--font-dancing)",
};
const SCRIPT_FONT: Record<string, string> = {
  vibes: "var(--font-vibes)",
  dancing: "var(--font-dancing)",
};

export function InvitationExperience({ token, view }: { token: string; view: View }) {
  const content = useMemo(() => parseInvitationContent(view.wedding.invitationContent?.content ?? {}), [view]);
  const theme = useMemo(() => parseInvitationTheme(view.wedding.invitationContent?.theme ?? {}), [view]);
  const [opened, setOpened] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (opened && !reducedMotion) {
      // small scroll hint after reveal
      window.scrollTo({ top: 0 });
    }
  }, [opened, reducedMotion]);

  const couple = [view.wedding.brideName, view.wedding.groomName].filter(Boolean).join(" & ");
  const greeting = view.invitation.greetingName ?? view.group.name;
  const visible = new Set(content.sections.filter((s) => s.visible).map((s) => s.id));
  const order = content.sections.filter((s) => s.visible).map((s) => s.id);

  const bg = theme.palette.bg ?? "#FDF4F1";
  const primary = theme.palette.primary ?? "#9D2C4E";
  const accent = theme.palette.accent ?? "#A16207";
  const text = theme.palette.text ?? "#3B2A2E";
  const muted = theme.palette.muted ?? "#8A777C";
  const dark = isDark(bg);

  return (
    <div
      className="min-h-dvh"
      style={{ background: bg, color: text, ["--inv-primary" as string]: primary, ["--inv-accent" as string]: accent }}
    >
      {/* Envelope opening */}
      {!opened && (
        <EnvelopeOverlay
          monogram={content.monogramText || coupleInitials(view.wedding.brideName, view.wedding.groomName)}
          greeting={greeting}
          primary={primary}
          onOpen={() => setOpened(true)}
          reducedMotion={reducedMotion}
          dark={dark}
        />
      )}

      <div className={cn("transition-opacity duration-700", opened ? "opacity-100" : "pointer-events-none h-0 overflow-hidden opacity-0")}>
        {/* Ornament top */}
        {theme.ornament === "floral" && <FloralDivider color={primary} className="mx-auto mt-8 w-48" />}

        <main className="mx-auto max-w-xl px-5 pb-32">
          {order.map((sectionId) => {
            if (!visible.has(sectionId)) return null;
            switch (sectionId) {
              case "cover":
                return (
                  <section key={sectionId} className="pt-14 text-center">
                    <p className="text-[11px] uppercase tracking-[0.28em]" style={{ color: muted }}>
                      {content.coverKicker}
                    </p>
                    <h1
                      className="mt-4 text-5xl font-semibold leading-tight sm:text-6xl"
                      style={{ fontFamily: HEADING_FONT[theme.headingFont], color: primary }}
                    >
                      {content.coverHeading || couple}
                    </h1>
                    {view.wedding.weddingDate && (
                      <p className="mt-4 text-sm" style={{ color: muted }}>
                        {formatDate(view.wedding.weddingDate, "EEEE · MMMM d, yyyy")}
                        {view.wedding.dateStatus === "tentative" && (
                          <span className="ml-2 rounded-full border border-current px-2 py-0.5 text-[10px] uppercase tracking-wide">tentative</span>
                        )}
                      </p>
                    )}
                    {theme.ornament === "floral" && <FloralDivider color={primary} className="mx-auto mt-6 w-40" />}
                    {theme.ornament === "geometric" && <hr className="mx-auto mt-6 w-16 border-current opacity-40" />}
                  </section>
                );
              case "greeting":
                return (
                  <section key={sectionId} className="pt-10 text-center">
                    <p className="text-2xl" style={{ fontFamily: SCRIPT_FONT[theme.scriptFont], color: primary }}>
                      Dear {greeting},
                    </p>
                  </section>
                );
              case "invitation":
                return (
                  <section key={sectionId} className="pt-8 text-center">
                    <p className="mx-auto max-w-md text-[15px] leading-relaxed" style={{ color: text }}>
                      {content.invitationMessage ||
                        `You are warmly invited to celebrate the wedding of ${couple}${view.wedding.location ? ` in ${view.wedding.location}` : ""}.`}
                    </p>
                  </section>
                );
              case "story":
                if (!content.story) return null;
                return (
                  <InvSection key={sectionId} title={content.storyTitle} accent={accent} headingFont={HEADING_FONT[theme.headingFont]}>
                    <p className="whitespace-pre-line text-[15px] leading-relaxed">{content.story}</p>
                  </InvSection>
                );
              case "date":
                return (
                  <section key={sectionId} className="pt-12 text-center">
                    <CalendarDays className="mx-auto size-6" style={{ color: accent }} aria-hidden="true" />
                    <h2 className="mt-3 text-2xl font-semibold" style={{ fontFamily: HEADING_FONT[theme.headingFont] }}>
                      {view.wedding.weddingDate ? formatDate(view.wedding.weddingDate, "MMMM d, yyyy") : "Date to be announced"}
                    </h2>
                    {view.wedding.weddingDate && (
                      <p className="mt-1 text-sm" style={{ color: muted }}>
                        {new Date(view.wedding.weddingDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" })}
                      </p>
                    )}
                    {content.ceremonyTime && <p className="mt-2 text-sm">Ceremony · {content.ceremonyTime}</p>}
                    {content.receptionTime && <p className="mt-1 text-sm">Reception · {content.receptionTime}</p>}
                    {view.wedding.location && <p className="mt-2 text-sm" style={{ color: muted }}>{view.wedding.location}</p>}
                  </section>
                );
              case "venues":
                return <PublicVenuesSection key={sectionId} token={token} content={content} accent={accent} headingFont={HEADING_FONT[theme.headingFont]} />;
              case "ceremony":
              case "reception":
                return null; // covered by date + venues
              case "schedule":
                return <PublicScheduleSection key={sectionId} token={token} accent={accent} headingFont={HEADING_FONT[theme.headingFont]} />;
              case "dressCode":
                if (!content.dressCode) return null;
                return (
                  <InvSection key={sectionId} title="Dress Code" accent={accent} headingFont={HEADING_FONT[theme.headingFont]}>
                    <div className="flex items-start gap-3">
                      <Sun className="mt-0.5 size-5 shrink-0" style={{ color: accent }} aria-hidden="true" />
                      <p className="text-[15px]">{content.dressCode}</p>
                    </div>
                  </InvSection>
                );
              case "gallery":
                if (content.galleryPaths.length === 0) return null;
                return (
                  <InvSection key={sectionId} title="Our Gallery" accent={accent} headingFont={HEADING_FONT[theme.headingFont]}>
                    <GalleryGrid paths={content.galleryPaths} />
                  </InvSection>
                );
              case "reminders":
                if (content.reminders.length === 0) return null;
                return (
                  <InvSection key={sectionId} title="Friendly Reminders" accent={accent} headingFont={HEADING_FONT[theme.headingFont]}>
                    <ul className="space-y-2">
                      {content.reminders.map((r, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[15px]">
                          <Sparkles className="mt-1 size-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </InvSection>
                );
              case "faq":
                if (content.faq.length === 0) return null;
                return (
                  <InvSection key={sectionId} title="FAQ" accent={accent} headingFont={HEADING_FONT[theme.headingFont]}>
                    <div className="space-y-3">
                      {content.faq.filter((f) => f.q || f.a).map((f, i) => (
                        <details key={i} className="rounded-xl border p-3.5" style={{ borderColor: `${muted}44` }}>
                          <summary className="cursor-pointer text-sm font-medium">
                            <HelpCircle className="mr-2 inline size-4" style={{ color: accent }} aria-hidden="true" />
                            {f.q}
                          </summary>
                          <p className="mt-2 text-sm leading-relaxed" style={{ color: muted }}>{f.a}</p>
                        </details>
                      ))}
                    </div>
                  </InvSection>
                );
              case "gifts":
                if (!content.giftNote && content.registry.length === 0) return null;
                return (
                  <InvSection key={sectionId} title="Gifts" accent={accent} headingFont={HEADING_FONT[theme.headingFont]}>
                    <Gift className="mb-2 size-5" style={{ color: accent }} aria-hidden="true" />
                    {content.giftNote && <p className="text-[15px] leading-relaxed">{content.giftNote}</p>}
                    {content.registry.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {content.registry.map((r) => (
                          <li key={r.url}>
                            <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-sm underline underline-offset-4" style={{ color: primary }}>
                              {r.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </InvSection>
                );
              case "rsvp":
                return (
                  <InvSection key={sectionId} title="RSVP" accent={accent} headingFont={HEADING_FONT[theme.headingFont]}>
                    <RsvpForm
                      token={token}
                      view={view}
                      primary={primary}
                      muted={muted}
                    />
                  </InvSection>
                );
              case "closing":
                return (
                  <section key={sectionId} className="pt-14 text-center">
                    {theme.ornament === "floral" && <FloralDivider color={primary} className="mx-auto mb-5 w-40" />}
                    <p className="text-3xl" style={{ fontFamily: SCRIPT_FONT[theme.scriptFont], color: primary }}>
                      {content.closingMessage || "With love and gratitude"}
                    </p>
                    <p className="mt-3 text-sm" style={{ color: muted }}>
                      {couple}
                    </p>
                  </section>
                );
              default:
                return null;
            }
          })}
        </main>
      </div>
    </div>
  );
}

function InvSection({
  title, children, accent, headingFont,
}: {
  title: string;
  children: React.ReactNode;
  accent: string;
  headingFont: string;
}) {
  return (
    <section className="pt-12">
      <h2 className="text-center text-xl font-semibold uppercase tracking-[0.18em]" style={{ fontFamily: headingFont, color: accent, fontSize: "0.95rem" }}>
        {title}
      </h2>
      <div className="mt-5 rounded-2xl border p-5 sm:p-6" style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.45)" }}>
        {children}
      </div>
    </section>
  );
}

function PublicVenuesSection({
  token, content, accent, headingFont,
}: {
  token: string;
  content: ReturnType<typeof parseInvitationContent>;
  accent: string;
  headingFont: string;
}) {
  const [details, setDetails] = useState<PublicDetails | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!content.venueIds.length) return;
    let cancelled = false;
    fetch(`/api/invite/${token}/details`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PublicDetails) => !cancelled && setDetails(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token, content.venueIds.length]);

  if (!content.venueIds.length) return null;
  const venues = (details?.venues ?? []).filter((v) => content.venueIds.includes(v.id));

  return (
    <InvSection title="Where" accent={accent} headingFont={headingFont}>
      {failed && <p className="text-sm opacity-70">Venue details will appear here shortly.</p>}
      {!details && !failed && (
        <div className="space-y-2" aria-busy="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-black/5" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-black/5" />
        </div>
      )}
      <div className="space-y-4">
        {venues.map((v) => (
          <div key={v.id}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
              {v.name} <span className="font-normal opacity-70">· {v.role}</span>
            </p>
            {v.address && <p className="ml-6 mt-0.5 text-sm opacity-80">{v.address}</p>}
            <div className="ml-6 mt-1 space-y-0.5 text-xs opacity-75">
              {v.parkingNotes && <p>Parking: {v.parkingNotes}</p>}
              {v.transitNotes && <p>Getting there: {v.transitNotes}</p>}
              {v.accessibilityNotes && <p>Accessibility: {v.accessibilityNotes}</p>}
            </div>
            {v.mapUrl && (
              <a
                href={v.mapUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-6 mt-1.5 inline-block rounded-full px-4 py-1.5 text-xs font-medium text-white no-underline"
                style={{ background: accent }}
              >
                Open in Maps
              </a>
            )}
          </div>
        ))}
        {details && venues.length === 0 && <p className="text-sm opacity-70">Venue details coming soon.</p>}
      </div>
    </InvSection>
  );
}

function PublicScheduleSection({ token, accent, headingFont }: { token: string; accent: string; headingFont: string }) {
  const [details, setDetails] = useState<PublicDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invite/${token}/details`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PublicDetails) => !cancelled && setDetails(d))
      .catch(() => !cancelled && setDetails({ venues: [], schedule: [] }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const schedule = details?.schedule ?? [];

  return (
    <InvSection title="The Day" accent={accent} headingFont={headingFont}>
      {schedule.length === 0 ? (
        <p className="text-sm opacity-75">The full program will be shared soon.</p>
      ) : (
        <ol className="space-y-3">
          {schedule.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-20 shrink-0 text-sm font-semibold" style={{ color: accent }}>
                {s.startTime ? formatTime(s.startTime) : "—"}
              </span>
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                {s.location && <p className="text-xs opacity-70">{s.location}</p>}
                {s.description && <p className="text-xs opacity-70">{s.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </InvSection>
  );
}

function GalleryGrid({ paths }: { paths: string[] }) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {paths.map((p) =>
        failed.has(p) ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p}
            src={`/api/invite-image?path=${encodeURIComponent(p)}`}
            alt="Wedding photo"
            loading="lazy"
            className="aspect-[4/3] w-full rounded-lg object-cover"
            onError={() => setFailed((s) => new Set(s).add(p))}
          />
        ),
      )}
    </div>
  );
}

function EnvelopeOverlay({
  monogram, greeting, primary, onOpen, reducedMotion, dark,
}: {
  monogram: string;
  greeting: string;
  primary: string;
  onOpen: () => void;
  reducedMotion: boolean;
  dark: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6"
      style={{ background: dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.55)", backdropFilter: "blur(10px)" }}
      role="dialog"
      aria-label="Open your invitation"
    >
      <div
        className={cn(
          "relative w-full max-w-sm rounded-3xl border bg-white/85 p-10 text-center shadow-xl",
          !reducedMotion && "animate-fade-up",
        )}
        style={{ borderColor: `${primary}33` }}
      >
        <FloralDivider color={primary} className="mx-auto w-44" />
        <p className="mt-5 text-5xl" style={{ fontFamily: "var(--font-vibes)", color: primary }}>
          {monogram}
        </p>
        <p className="mt-3 text-sm opacity-80">for</p>
        <p className="mt-1 text-lg font-medium">{greeting}</p>
        <button
          type="button"
          onClick={onOpen}
          autoFocus
          className="mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full px-7 py-3 text-sm font-medium text-white shadow transition-transform hover:scale-[1.03] active:scale-95"
          style={{ background: primary }}
        >
          <Mail className="size-4" aria-hidden="true" />
          Open invitation
        </button>
        <p className="mt-4 text-xs opacity-60">You may be asked to RSVP — it takes under a minute.</p>
      </div>
    </div>
  );
}

export function FloralDivider({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 24" fill="none" className={className} aria-hidden="true">
      <path d="M10 12 H 80" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <path d="M120 12 H 190" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <g transform="translate(100 12)">
        <path d="M0 -6 C 3 -3, 3 3, 0 6 C -3 3, -3 -3, 0 -6 Z" stroke={color} strokeWidth="1" fill="none" />
        <circle r="1.6" fill={color} opacity="0.7" />
        <path d="M-7 0 C -5 -2.5, -2 -2.5, -1 0 C -2 2.5, -5 2.5, -7 0 Z" stroke={color} strokeWidth="0.8" fill="none" opacity="0.8" />
        <path d="M7 0 C 5 -2.5, 2 -2.5, 1 0 C 2 2.5, 5 2.5, 7 0 Z" stroke={color} strokeWidth="0.8" fill="none" opacity="0.8" />
      </g>
    </svg>
  );
}

function coupleInitials(a?: string | null, b?: string | null) {
  const i = (s?: string | null) => (s ?? "").trim().charAt(0).toUpperCase();
  return [i(a), i(b)].filter(Boolean).join(" & ") || "W";
}

function isDark(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
