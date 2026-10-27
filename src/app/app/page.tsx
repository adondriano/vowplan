import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, Plus, CalendarDays, Users, Inbox } from "lucide-react";
import { listWeddingsForUser } from "@/lib/server/weddings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AcceptInviteButtons } from "@/components/planner/accept-invite";
import { formatDate, countdownLabel } from "@/lib/domain/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your weddings" };

export default async function WorkspaceListPage() {
  const { weddings, pendingInvites } = await listWeddingsForUser();
  if (weddings.length === 0 && pendingInvites.length === 0) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="size-5 text-primary" aria-hidden="true" />
          <h1 className="font-display text-2xl font-semibold">Your weddings</h1>
        </div>
        <Link href="/onboarding">
          <Button size="sm"><Plus className="size-4" aria-hidden="true" /> New wedding</Button>
        </Link>
      </div>

      {pendingInvites.length > 0 && (
        <section aria-label="Pending invitations" className="mt-6 rounded-xl border border-accent/30 bg-accent-soft p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-accent">
            <Inbox className="size-4" aria-hidden="true" />
            You have been invited to co-plan {pendingInvites.length === 1 ? "a wedding" : `${pendingInvites.length} weddings`}
          </p>
          <div className="mt-3 space-y-2">
            {pendingInvites.map((inv) => (
              <AcceptInviteButtons key={inv.wedding_id} weddingId={inv.wedding_id} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4">
        {weddings.map((w) => (
          <Link
            key={w.id}
            href={`/app/weddings/${w.id}`}
            className="card group flex items-center justify-between gap-4 p-5 transition-shadow hover:shadow-md"
          >
            <div className="min-w-0">
              <p className="font-script text-lg text-primary">
                {[w.bride_name, w.groom_name].filter(Boolean).join(" & ") || "Untitled wedding"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {w.wedding_date ? formatDate(w.wedding_date) : "Date not set"}
                  {w.date_status === "tentative" && <Badge tone="warning">Tentative</Badge>}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden="true" />
                  {w.guest_count_estimate ? `~${w.guest_count_estimate} guests` : "Guest count TBD"}
                </span>
              </p>
              {w.wedding_date && countdownLabel(w.wedding_date) && (
                <p className="mt-1 text-xs font-medium text-accent">{countdownLabel(w.wedding_date)}</p>
              )}
            </div>
            <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>

      {weddings.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={<Heart />}
          title="No weddings yet"
          description="Accept an invitation above, or create your own wedding workspace."
          action={<Link href="/onboarding"><Button>Create a wedding</Button></Link>}
        />
      )}
    </main>
  );
}
