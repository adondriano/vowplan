import Link from "next/link";
import { Heart, CalendarHeart, Wallet, QrCode, Users, ShieldCheck, Sparkles, ArrowRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Users, title: "Guests & households", text: "Invite families as one group with PAX limits, sides, categories, and CSV import." },
  { icon: QrCode, title: "Invitations with QR codes", text: "Each household gets a unique, revocable link and a printable QR card — no accounts needed." },
  { icon: CalendarHeart, title: "RSVP manager", text: "Track pending, confirmed, and declined responses with deadlines and follow-ups." },
  { icon: Wallet, title: "Real budget tracking", text: "Quotes, contracts, deposit schedules, balances, and over-budget alerts." },
  { icon: LayoutDashboard, title: "Planning workspace", text: "Checklists, timeline, vendors, venues, seating, documents, and reports." },
  { icon: ShieldCheck, title: "Private by design", text: "Row-level security keeps planner data private; guests only see their own invitation." },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Heart className="size-5 text-primary" aria-hidden="true" />
          <span className="font-display text-xl font-semibold tracking-tight">VowPlan</span>
        </div>
        <nav className="flex items-center gap-2" aria-label="Main">
          <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link href="/signup"><Button size="sm">Start planning</Button></Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 text-center md:pt-20">
          <p className="mb-4 font-script text-3xl text-primary">the wedding planning studio</p>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-semibold leading-tight text-foreground md:text-6xl">
            Plan the celebration.
            <br />
            <span className="text-primary">Share the joy.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            VowPlan is a private planning workspace for the couple and a beautiful
            digital invitation with personal links and QR codes for every guest.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">
                Create your wedding workspace <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">Sign in</Button>
            </Link>
          </div>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
            Romantic floral, minimalist, classic, garden, and cinematic invitation themes
          </p>
        </section>

        <section className="border-y border-border bg-surface/60" aria-label="Features">
          <div className="mx-auto grid max-w-6xl gap-4 px-6 py-14 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card p-5">
                <f.icon className="size-5 text-primary" aria-hidden="true" />
                <h2 className="mt-3 font-display text-lg font-semibold">{f.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-muted-foreground">
        VowPlan — a full-stack wedding planning studio. Invitation links are personal bearer links; only share them with your guests.
      </footer>
    </div>
  );
}
