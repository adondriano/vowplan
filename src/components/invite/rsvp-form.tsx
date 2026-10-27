"use client";
import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Pencil, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/domain/format";

type View = {
  wedding: {
    rsvpDeadline: string | null;
    rsvpSettings: Record<string, unknown>;
    dateStatus: string;
    weddingDate: string | null;
    brideName: string;
    groomName: string;
  };
  invitation: { id: string; maxPax: number };
  group: { name: string; invitedPax: number; inviteeNames: { displayName: string }[] };
  response: {
    status: "confirmed" | "declined";
    attendingCount: number;
    mealPreferences: string | null;
    dietaryNotes: string | null;
    accessibilityNotes: string | null;
    messageToCouple: string | null;
    songRequest: string | null;
    submittedAt: string | null;
  } | null;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; status: string; count: number; editDeadlineNote: string }
  | { kind: "closed"; message: string }
  | { kind: "error"; message: string };

export function RsvpForm({
  token, view, primary, muted,
}: {
  token: string;
  view: View;
  primary: string;
  muted: string;
}) {
  const settings = view.wedding.rsvpSettings ?? {};
  const s = {
    closed: (settings.closed as boolean) ?? false,
    allowEdits: (settings.allowEdits as boolean) ?? true,
    mealField: (settings.mealField as boolean) ?? true,
    dietaryField: (settings.dietaryField as boolean) ?? true,
    accessibilityField: (settings.accessibilityField as boolean) ?? true,
    messageField: (settings.messageField as boolean) ?? true,
    songField: (settings.songField as boolean) ?? false,
    mealChoices: (settings.mealChoices as string[] | undefined) ?? ["Chicken", "Beef", "Fish", "Vegetarian"],
    instructions: settings.instructions as string | undefined,
    confirmationCopy: settings.confirmationCopy as string | undefined,
  };

  const deadline = view.wedding.rsvpDeadline;
  const deadlinePassed = deadline ? new Date(deadline + "T23:59:59") < new Date() : false;
  const lockedForEdit = Boolean(view.response) && (!s.allowEdits || deadlinePassed || s.closed);
  const lockedForNew = !view.response && (s.closed || deadlinePassed);

  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [editing, setEditing] = useState(!view.response);
  const [status, setStatus] = useState<"confirmed" | "declined">(view.response?.status ?? "confirmed");
  const [count, setCount] = useState(view.response?.attendingCount ?? Math.min(1, view.invitation.maxPax));
  const [attendees, setAttendees] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const n of view.group.inviteeNames) init[n.displayName] = true;
    return init;
  });
  const [meal, setMeal] = useState(view.response?.mealPreferences ?? "");
  const [dietary, setDietary] = useState(view.response?.dietaryNotes ?? "");
  const [accessibility, setAccessibility] = useState(view.response?.accessibilityNotes ?? "");
  const [message, setMessage] = useState(view.response?.messageToCouple ?? "");
  const [song, setSong] = useState(view.response?.songRequest ?? "");
  const [error, setError] = useState<string | null>(null);

  const max = view.invitation.maxPax;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let attendingCount = status === "declined" ? 0 : count;
    const perGuest = Boolean(settings.requirePerGuestAttendance) && view.group.inviteeNames.length > 0;
    if (perGuest && status === "confirmed") {
      attendingCount = Object.values(attendees).filter(Boolean).length;
      if (attendingCount === 0) {
        setError("Select at least one guest who will attend, or choose 'Sorry, can't make it'.");
        return;
      }
    }
    if (status === "confirmed" && attendingCount > max) {
      setError(`Your invitation allows up to ${max} guest${max === 1 ? "" : "s"}.`);
      return;
    }

    setState({ kind: "busy" });
    try {
      const res = await fetch(`/api/invite/${token}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          attendingCount,
          attendees: view.group.inviteeNames.map((n) => ({
            displayName: n.displayName,
            attending: status === "confirmed" ? (attendees[n.displayName] ?? false) : false,
          })),
          mealPreferences: meal,
          dietaryNotes: dietary,
          accessibilityNotes: accessibility,
          messageToCouple: message,
          songRequest: song,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        if (body.code === "closed") {
          setState({
            kind: "closed",
            message: "RSVPs are closed for this wedding. If you need to change your reply, please contact the couple directly.",
          });
        } else if (body.code === "pax_exceeded") {
          setState({ kind: "idle" });
          setError(`Your invitation allows up to ${body.maxPax ?? max} guest(s).`);
        } else {
          setState({ kind: "idle" });
          setError("Something went wrong sending your response. Please try again.");
        }
        return;
      }
      setState({
        kind: "done",
        status,
        count: attendingCount,
        editDeadlineNote: deadline
          ? `You can edit your response until ${formatDate(deadline, "MMMM d, yyyy")}.`
          : "You can edit your response using this same link.",
      });
      setEditing(false);
    } catch {
      setState({ kind: "idle" });
      setError("Network problem — your response was not saved. Please try again.");
    }
  }

  if (state.kind === "closed") {
    return (
      <div className="rounded-xl border p-5 text-center" style={{ borderColor: `${muted}44` }}>
        <AlertCircle className="mx-auto size-8" style={{ color: muted }} aria-hidden="true" />
        <p className="mt-3 text-sm leading-relaxed">{state.message}</p>
      </div>
    );
  }

  if (state.kind === "done") {
    return (
      <div className="rounded-xl border p-6 text-center" style={{ borderColor: `${primary}44` }}>
        <CheckCircle2 className="mx-auto size-10" style={{ color: primary }} aria-hidden="true" />
        <p className="mt-3 text-lg font-medium">
          {state.status === "confirmed" ? "Thank you — you're on the list!" : "Thank you for letting us know."}
        </p>
        <p className="mt-2 text-sm" style={{ color: muted }}>
          {state.status === "confirmed"
            ? `We've recorded ${state.count} ${state.count === 1 ? "guest" : "guests"}${state.count === 1 ? "" : "s"}.`
            : "Your response has been recorded."}
        </p>
        {s.confirmationCopy && <p className="mx-auto mt-3 max-w-sm text-sm italic" style={{ color: muted }}>{s.confirmationCopy}</p>}
        <p className="mt-3 text-xs" style={{ color: muted }}>{state.editDeadlineNote}</p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-sm underline underline-offset-4"
          style={{ color: primary }}
        >
          <Pencil className="size-3.5" aria-hidden="true" /> Change my response
        </button>
      </div>
    );
  }

  if (!editing && view.response) {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: `${muted}44` }}>
        <p className="flex items-center gap-2 text-sm font-medium">
          <HeartHandshake className="size-4" style={{ color: primary }} aria-hidden="true" />
          {view.response.status === "confirmed"
            ? `You replied YES — ${view.response.attendingCount} attending`
            : "You replied — sorry you can't make it"}
        </p>
        <p className="mt-1 text-xs" style={{ color: muted }}>Updated {formatDate(view.response.submittedAt, "MMM d, yyyy")}</p>
        {lockedForEdit ? (
          <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: `${muted}18`, color: muted }}>
            {s.closed
              ? "RSVPs are closed. Contact the couple for any changes."
              : deadlinePassed
                ? `The RSVP deadline (${formatDate(deadline!, "MMMM d, yyyy")}) has passed. Contact the couple for changes.`
                : "Editing is disabled for this wedding. Contact the couple for changes."}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-sm underline underline-offset-4"
            style={{ color: primary }}
          >
            <Pencil className="size-3.5" aria-hidden="true" /> Edit response
          </button>
        )}
      </div>
    );
  }

  const inputCls =
    "mt-1.5 w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:ring-2";
  const borderStyle = { borderColor: `${muted}55`, ["--tw-ring-color" as string]: `${primary}44` } as React.CSSProperties;

  if (lockedForNew) {
    return (
      <div className="rounded-xl border p-5 text-sm" style={{ borderColor: `${muted}44` }}>
        <p className="font-medium">RSVPs are {s.closed ? "closed" : "past the deadline"}</p>
        <p className="mt-1 text-xs" style={{ color: muted }}>
          {s.closed
            ? "The couple has closed new responses. Contact them directly if you still need to reply."
            : `The RSVP deadline (${formatDate(deadline!, "MMMM d, yyyy")}) has passed. Contact the couple if you still need to reply.`}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {s.instructions && (
        <p className="rounded-xl px-4 py-3 text-sm" style={{ background: `${primary}12`, color: muted }}>
          {s.instructions}
        </p>
      )}

      {/* Attend / decline */}
      <fieldset>
        <legend className="text-sm font-semibold">Will you attend?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              { v: "confirmed", label: "Yes, with joy!" },
              { v: "declined", label: "Sorry, can't make it" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setStatus(opt.v)}
              aria-pressed={status === opt.v}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-3 text-sm font-medium transition-all",
                status === opt.v ? "text-white shadow" : "",
              )}
              style={
                status === opt.v
                  ? { background: primary, borderColor: primary }
                  : { borderColor: `${muted}55`, color: muted }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {status === "confirmed" && (
        <>
          {/* Per-guest selection when named invitees exist */}
          {view.group.inviteeNames.length > 0 && settings.requirePerGuestAttendance ? (
            <fieldset>
              <legend className="text-sm font-semibold">Who&apos;s coming? <span className="font-normal" style={{ color: muted }}>(up to {max})</span></legend>
              <div className="mt-2 space-y-1.5">
                {view.group.inviteeNames.map((n) => (
                  <label key={n.displayName} className="flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm" style={{ borderColor: `${muted}44` }}>
                    <input
                      type="checkbox"
                      checked={attendees[n.displayName] ?? false}
                      onChange={(e) => {
                        const nextOn = e.target.checked;
                        setAttendees((a) => {
                          const updated = { ...a, [n.displayName]: nextOn };
                          const total = Object.values(updated).filter(Boolean).length;
                          if (total > max) return a;
                          setCount(total);
                          return updated;
                        });
                      }}
                      className="size-4"
                      style={{ accentColor: primary }}
                    />
                    {n.displayName}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div>
              <label htmlFor="rsvp-count" className="text-sm font-semibold">
                Number of guests attending <span className="font-normal" style={{ color: muted }}>(max {max})</span>
              </label>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  aria-label="Fewer guests"
                  className="size-10 cursor-pointer rounded-full border text-lg font-semibold"
                  style={{ borderColor: `${muted}55` }}
                >
                  −
                </button>
                <input
                  id="rsvp-count"
                  type="range"
                  min={1}
                  max={max}
                  value={Math.min(count, max)}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="flex-1"
                  style={{ accentColor: primary }}
                  aria-valuetext={`${Math.min(count, max)} guests`}
                />
                <button
                  type="button"
                  onClick={() => setCount((c) => Math.min(max, c + 1))}
                  aria-label="More guests"
                  className="size-10 cursor-pointer rounded-full border text-lg font-semibold"
                  style={{ borderColor: `${muted}55` }}
                >
                  +
                </button>
                <span className="w-6 text-center text-lg font-bold" style={{ color: primary }}>{Math.min(count, max)}</span>
              </div>
            </div>
          )}

          {s.mealField && (
            <div>
              <label htmlFor="rsvp-meal" className="text-sm font-semibold">Meal preference</label>
              <select id="rsvp-meal" value={meal} onChange={(e) => setMeal(e.target.value)} className={inputCls} style={borderStyle}>
                <option value="">Choose one…</option>
                {s.mealChoices.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      {status === "confirmed" && s.dietaryField && (
        <div>
          <label htmlFor="rsvp-dietary" className="text-sm font-semibold" style={{ display: "block" }}>
            Dietary needs or allergies <span className="font-normal" style={{ color: muted }}>(optional)</span>
          </label>
          <input id="rsvp-dietary" value={dietary} onChange={(e) => setDietary(e.target.value)} className={inputCls} style={borderStyle} placeholder="e.g. no shellfish" />
        </div>
      )}

      {status === "confirmed" && s.accessibilityField && (
        <div>
          <label htmlFor="rsvp-access" className="text-sm font-semibold" style={{ display: "block" }}>
            Accessibility or seating requests <span className="font-normal" style={{ color: muted }}>(optional)</span>
          </label>
          <input id="rsvp-access" value={accessibility} onChange={(e) => setAccessibility(e.target.value)} className={inputCls} style={borderStyle} placeholder="e.g. wheelchair access, seat near the aisle" />
        </div>
      )}

      {s.messageField && (
        <div>
          <label htmlFor="rsvp-message" className="text-sm font-semibold" style={{ display: "block" }}>
            Message for the couple <span className="font-normal" style={{ color: muted }}>(optional)</span>
          </label>
          <textarea id="rsvp-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} style={borderStyle} placeholder="We're so happy for you!" />
        </div>
      )}

      {s.songField && (
        <div>
          <label htmlFor="rsvp-song" className="text-sm font-semibold" style={{ display: "block" }}>
            Song request <span className="font-normal" style={{ color: muted }}>(optional)</span>
          </label>
          <input id="rsvp-song" value={song} onChange={(e) => setSong(e.target.value)} className={inputCls} style={borderStyle} placeholder="A song that gets you dancing" />
        </div>
      )}

      {deadline && !deadlinePassed && (
        <p className="text-xs" style={{ color: muted }}>
          Kindly reply by <strong>{formatDate(deadline, "MMMM d, yyyy")}</strong>.
        </p>
      )}
      {deadlinePassed && !s.closed && (
        <p className="text-xs" style={{ color: muted }}>
          The preferred RSVP date has passed — you may still reply, but kindly also message the couple.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "#C2313E18", color: "#8f1d26" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state.kind === "busy"}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-medium text-white shadow transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        style={{ background: primary }}
      >
        {state.kind === "busy" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-5" aria-hidden="true" />}
        {view.response ? "Update my response" : "Send my RSVP"}
      </button>
    </form>
  );
}
