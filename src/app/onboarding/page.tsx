"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ArrowLeft, PartyPopper, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY"];
const STYLES = ["Romantic floral", "Minimalist modern", "Classic formal", "Garden", "Cinematic editorial", "Beach", "Rustic", "Other"];

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — couple details
  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");
  const [partner1Label, setPartner1Label] = useState("Bride");
  const [partner2Label, setPartner2Label] = useState("Groom");
  const [weddingDate, setWeddingDate] = useState("");
  const [dateStatus, setDateStatus] = useState<"tentative" | "confirmed" | "undecided">("tentative");
  const [location, setLocation] = useState("");
  const [currency, setCurrency] = useState("PHP");

  // Step 3 — preferences (optional)
  const [weddingStyle, setWeddingStyle] = useState<string>("");
  const [guestCount, setGuestCount] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [createDefaults, setCreateDefaults] = useState(true);

  const canNext1 = brideName.trim().length > 0 && groomName.trim().length > 0;

  async function finish() {
    setBusy(true);
    setError(null);
    // Workspace creation runs through the onboarding API route.
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brideName,
        groomName,
        partner1Label,
        partner2Label,
        weddingDate: weddingDate || null,
        dateStatus,
        location: location || null,
        currency,
        guestCountEstimate: guestCount ? Number(guestCount) : null,
        totalBudget: totalBudget ? Number(totalBudget) : null,
        weddingStyle: weddingStyle || null,
        rsvpDeadline: rsvpDeadline || null,
        createDefaults,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create the workspace.");
      return;
    }
    toast("success", "Your wedding workspace is ready!");
    router.push(`/app/weddings/${body.weddingId}`);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <p className="font-script text-2xl text-primary">let&apos;s begin</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Set up your wedding workspace</h1>
        <ol className="mt-6 flex items-center justify-center gap-2" aria-label="Progress">
          {[1, 2, 3].map((s) => (
            <li key={s} aria-current={step === s ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                  step > s && "border-success bg-success text-white",
                  step === s && "border-primary bg-primary text-white",
                  step < s && "border-border bg-surface text-muted-foreground",
                )}
              >
                {step > s ? <CheckCircle2 className="size-4" aria-hidden="true" /> : s}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="card p-6" aria-live="polite">
        {step === 1 && (
          <section aria-label="Couple details">
            <h2 className="font-display text-xl font-semibold">The couple</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="bride">{partner1Label || "Partner 1"} name</Label>
                <Input id="bride" value={brideName} onChange={(e) => setBrideName(e.target.value)} className="mt-1.5" placeholder="Maria" required />
              </div>
              <div>
                <Label htmlFor="groom">{partner2Label || "Partner 2"} name</Label>
                <Input id="groom" value={groomName} onChange={(e) => setGroomName(e.target.value)} className="mt-1.5" placeholder="Juan" required />
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="label1" hint="customizable">Label</Label>
                <Input id="label1" value={partner1Label} onChange={(e) => setPartner1Label(e.target.value)} className="mt-1.5" placeholder="Bride" />
              </div>
              <div>
                <Label htmlFor="label2" hint="customizable">Label</Label>
                <Input id="label2" value={partner2Label} onChange={(e) => setPartner2Label(e.target.value)} className="mt-1.5" placeholder="Groom" />
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="date">Wedding date</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(
                  [
                    { v: "undecided", label: "Not set yet" },
                    { v: "tentative", label: "Tentative date" },
                    { v: "confirmed", label: "Confirmed date" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setDateStatus(opt.v)}
                    aria-pressed={dateStatus === opt.v}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                      dateStatus === opt.v
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {dateStatus !== "undecided" && (
                <Input id="date" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} className="mt-2" aria-label="Wedding date" />
              )}
              {dateStatus === "tentative" && (
                <p className="mt-2 text-xs text-warning">Marked tentative — VowPlan will show it as provisional everywhere.</p>
              )}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="location" hint="optional">Wedding location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1.5" placeholder="Tagaytay City" />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <FieldError message={error} />
            <div className="mt-6 flex justify-end">
              <Button onClick={() => canNext1 && setStep(2)} disabled={!canNext1}>
                Continue <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-label="Workspace">
            <h2 className="font-display text-xl font-semibold">Your workspace</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              VowPlan will create a private planning workspace for{" "}
              <strong className="text-foreground">
                {brideName || "Partner 1"} &amp; {groomName || "Partner 2"}
              </strong>
              . You can invite your partner or a co-planner later from Settings — they
              accept the invite by signing up with the email you specify.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-foreground-secondary">
              <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" aria-hidden="true" /> Private checklist, budget, guests, vendors, seating</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" aria-hidden="true" /> Digital invitation website with personal guest links</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" aria-hidden="true" /> RSVP tracking with PAX limits and QR cards</li>
            </ul>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="size-4" aria-hidden="true" /> Back</Button>
              <Button onClick={() => setStep(3)}>Continue <ArrowRight className="size-4" aria-hidden="true" /></Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-label="Preferences">
            <h2 className="font-display text-xl font-semibold">Planning preferences <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="style">Wedding style</Label>
                <Select value={weddingStyle} onValueChange={setWeddingStyle}>
                  <SelectTrigger id="style" className="mt-1.5"><SelectValue placeholder="Choose a style" /></SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="guests">Estimated guests</Label>
                <Input id="guests" type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} className="mt-1.5" placeholder="120" />
              </div>
              <div>
                <Label htmlFor="budget" hint={`in ${currency}`}>Total budget</Label>
                <Input id="budget" type="number" min={0} value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} className="mt-1.5" placeholder="500000" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="deadline">RSVP deadline</Label>
                <Input id="deadline" type="date" value={rsvpDeadline} onChange={(e) => setRsvpDeadline(e.target.value)} className="mt-1.5" />
              </div>
              <div className="sm:col-span-2 flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-warm/50 p-3.5">
                <div>
                  <p className="text-sm font-medium">Starter checklist &amp; categories</p>
                  <p className="text-xs text-muted-foreground">Creates ~30 suggested tasks, budget categories, and a day-of schedule skeleton you can edit.</p>
                </div>
                <Switch checked={createDefaults} onCheckedChange={setCreateDefaults} aria-label="Create default checklist" />
              </div>
            </div>
            <FieldError message={error} />
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="size-4" aria-hidden="true" /> Back</Button>
              <Button size="lg" onClick={finish} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PartyPopper className="size-4" aria-hidden="true" />}
                {busy ? "Creating…" : "Create workspace"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
