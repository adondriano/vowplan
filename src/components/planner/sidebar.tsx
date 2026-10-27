"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ListChecks, CalendarClock, Users, MailCheck, Globe, Store, Wallet,
  MapPin, Armchair, HeartHandshake, FolderOpen, Images, NotebookPen, BarChart3, Settings,
  Menu, X, Heart, ChevronDown, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export const PLANNER_NAV = [
  {
    section: "Overview",
    items: [
      { href: "", label: "Dashboard", icon: LayoutDashboard },
      { href: "/checklist", label: "Checklist & Tasks", icon: ListChecks },
      { href: "/timeline", label: "Timeline & Schedule", icon: CalendarClock },
    ],
  },
  {
    section: "Guests",
    items: [
      { href: "/guests", label: "Guest List", icon: Users },
      { href: "/rsvps", label: "RSVP Manager", icon: MailCheck },
      { href: "/invitation", label: "Invitation Website", icon: Globe },
    ],
  },
  {
    section: "Money & Venue",
    items: [
      { href: "/budget", label: "Budget & Payments", icon: Wallet },
      { href: "/vendors", label: "Vendors", icon: Store },
      { href: "/venues", label: "Venues & Logistics", icon: MapPin },
    ],
  },
  {
    section: "The Day",
    items: [
      { href: "/seating", label: "Seating Planner", icon: Armchair },
      { href: "/wedding-party", label: "Wedding Party", icon: HeartHandshake },
    ],
  },
  {
    section: "Records",
    items: [
      { href: "/documents", label: "Documents", icon: FolderOpen },
      { href: "/inspiration", label: "Inspiration Board", icon: Images },
      { href: "/notes", label: "Notes & Decisions", icon: NotebookPen },
    ],
  },
  {
    section: "Wrap-up",
    items: [
      { href: "/reports", label: "Reports & Exports", icon: BarChart3 },
      { href: "/settings", label: "Settings & Archive", icon: Settings },
    ],
  },
] as const;

export function PlannerSidebar({
  weddingId,
  weddingName,
  dateLabel,
  dateTentative,
  otherWeddings,
}: {
  weddingId: string;
  weddingName: string;
  dateLabel: string;
  dateTentative: boolean;
  otherWeddings: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const base = `/app/weddings/${weddingId}`;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <nav aria-label="Planner sections" className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4">
        <Link href="/app" className="flex items-center gap-2 text-primary">
          <Heart className="size-4" aria-hidden="true" />
          <span className="font-display text-lg font-semibold tracking-tight">VowPlan</span>
        </Link>
        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setSwitcherOpen((o) => !o)}
            aria-expanded={switcherOpen}
            aria-haspopup="menu"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-warm cursor-pointer"
          >
            <span className="block truncate font-display text-sm font-semibold text-foreground">
              {weddingName}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {dateLabel}
              {dateTentative && <Badge tone="warning" className="!px-1.5 !py-0 !text-[10px]">Tentative</Badge>}
            </span>
          </button>
          {otherWeddings.length > 0 && switcherOpen && (
            <div role="menu" className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg animate-scale-in">
              {otherWeddings.map((w) => (
                <Link
                  key={w.id}
                  role="menuitem"
                  href={`/app/weddings/${w.id}`}
                  onClick={() => setSwitcherOpen(false)}
                  className="block truncate px-3 py-2 text-sm text-foreground-secondary hover:bg-primary-soft hover:text-primary"
                >
                  {w.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll px-2 py-3">
        {PLANNER_NAV.map((group) => (
          <div key={group.section} className="mb-3">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.section}
            </p>
            <ul>
              {group.items.map((item) => {
                const href = `${base}${item.href}`;
                const active = item.href === "" ? pathname === base : pathname.startsWith(href);
                return (
                  <li key={item.href}>
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-foreground-secondary hover:bg-surface-warm hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={signOut}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-warm hover:text-foreground cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 hover:bg-surface-warm cursor-pointer"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="truncate font-display text-base font-semibold">{weddingName}</span>
        <span className="w-9" aria-hidden="true" />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface shadow-xl animate-fade-up">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-2 z-10 rounded-lg p-2 hover:bg-surface-warm cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
            {nav}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-surface lg:block">
        {nav}
      </aside>
    </>
  );
}

export function TentativeBanner({ dateLabel }: { dateLabel: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        The wedding date ({dateLabel}) is <strong>tentative</strong>. Tasks, countdowns, and
        schedules treat it as provisional — update it in Settings when it&apos;s confirmed.
      </p>
    </div>
  );
}

export function MobileNavHint() {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground lg:hidden">
      <ChevronDown className="size-3" aria-hidden="true" />
    </div>
  );
}
