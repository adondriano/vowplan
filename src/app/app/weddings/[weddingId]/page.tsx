import Link from "next/link";
import {
  Users, MailCheck, Wallet, ListChecks, CalendarDays, AlarmClock, PiggyBank, ArrowRight,
  Heart, TrendingUp, AlertTriangle, Clock,
} from "lucide-react";
import { requireWeddingAccess } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TentativeBanner } from "@/components/planner/sidebar";
import { computePaxTotals } from "@/lib/domain/pax";
import { computeBudgetTotals } from "@/lib/domain/budget";
import { formatDate, countdownLabel, formatMoney, coupleNames, formatTime } from "@/lib/domain/format";
import { QuickActions } from "@/components/planner/quick-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function WeddingDashboard({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await requireWeddingAccess(weddingId);
  const supabase = await createServerClient();

  const [groupsR, invitationsR, responsesR, guestsR, tasksR, eventsR, expensesR, paymentsR] =
    await Promise.all([
      supabase.from("guest_groups").select("id, invited_pax").eq("wedding_id", weddingId),
      supabase.from("guest_invitations").select("id, group_id, max_pax, status").eq("wedding_id", weddingId),
      supabase.from("rsvp_responses").select("invitation_id, status, attending_count").eq("wedding_id", weddingId),
      supabase.from("guests").select("id").eq("wedding_id", weddingId),
      supabase.from("wedding_tasks").select("id, title, status, due_date, priority").eq("wedding_id", weddingId).order("due_date", { ascending: true }),
      supabase.from("wedding_events").select("id, title, event_date, start_time, event_type, location").eq("wedding_id", weddingId).gte("event_date", new Date().toISOString().slice(0, 10)).order("event_date").order("start_time").limit(6),
      supabase.from("expenses").select("*").eq("wedding_id", weddingId),
      supabase.from("expense_payments").select("expense_id, label, amount, due_date, status").eq("status", "scheduled").order("due_date").limit(100),
    ]);

  const groups = groupsR.data ?? [];
  const invitations = invitationsR.data ?? [];
  const responses = responsesR.data ?? [];
  const guests = guestsR.data ?? [];
  const tasks = tasksR.data ?? [];
  const expenses = (expensesR.data ?? []).map((e) => ({
    ...e,
    payments: (paymentsR.data ?? []).filter((p) => p.expense_id === e.id),
  }));

  const pax = computePaxTotals(groups as never, invitations as never, responses as never);
  const budget = computeBudgetTotals(expenses as never, wedding.total_budget, wedding.contingency_pct);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const taskPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).slice(0, 5);
  const upcomingPayments = (paymentsR.data ?? [])
    .filter((p) => p.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 5);
  const expenseById = new Map((expensesR.data ?? []).map((e) => [e.id, e]));

  const isUndecided = wedding.date_status === "undecided" || !wedding.wedding_date;

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-script text-2xl text-primary">wedding dashboard</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{coupleNames(wedding)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            {wedding.wedding_date ? formatDate(wedding.wedding_date) : "Date not set yet"}
            {wedding.date_status === "tentative" && <Badge tone="warning">Tentative date</Badge>}
            {wedding.date_status === "confirmed" && <Badge tone="success">Confirmed</Badge>}
            {wedding.location && <span>· {wedding.location}</span>}
            {wedding.wedding_date && countdownLabel(wedding.wedding_date) && (
              <span className="font-medium text-accent">· {countdownLabel(wedding.wedding_date)}</span>
            )}
          </p>
        </div>
        <QuickActions weddingId={weddingId} />
      </header>

      {wedding.date_status === "tentative" && <div className="mt-4"><TentativeBanner dateLabel={formatDate(wedding.wedding_date)} /></div>}
      {isUndecided && (
        <div className="mb-4 mt-4 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
          No wedding date yet — the checklist dates and countdown will activate once you set one in{" "}
          <Link href={`/app/weddings/${weddingId}/settings`} className="font-medium underline">Settings</Link>.
        </div>
      )}

      {/* Guest & RSVP row */}
      <section aria-label="Guests and RSVPs" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="People invited"
          value={guests.length.toLocaleString()}
          sub={`${groups.length} invitation ${groups.length === 1 ? "group" : "groups"} · ${pax.invitedPax.toLocaleString()} max PAX`}
          icon={<Users />}
          href={`/app/weddings/${weddingId}/guests`}
        />
        <StatCard
          label="Confirmed attendance"
          value={pax.confirmedPax.toLocaleString()}
          sub={`${pax.confirmedGroups} confirmed ${pax.confirmedGroups === 1 ? "household" : "households"}`}
          icon={<Heart />}
          tone="success"
          href={`/app/weddings/${weddingId}/rsvps?status=confirmed`}
        />
        <StatCard
          label="Pending responses"
          value={pax.pendingPax.toLocaleString()}
          sub={`${pax.pendingGroups} ${pax.pendingGroups === 1 ? "household" : "households"} haven't replied`}
          icon={<MailCheck />}
          tone={pax.pendingGroups > 0 ? "warning" : "neutral"}
          href={`/app/weddings/${weddingId}/rsvps?status=pending`}
        />
        <StatCard
          label="Response rate"
          value={`${pax.responseRate}%`}
          sub={`${pax.declinedGroups} declined`}
          icon={<TrendingUp />}
          href={`/app/weddings/${weddingId}/rsvps`}
        />
      </section>

      {/* Money & progress row */}
      <section aria-label="Budget and checklist" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total budget"
          value={wedding.total_budget ? formatMoney(wedding.total_budget, wedding.currency) : "Not set"}
          sub={wedding.total_budget ? `${formatMoney(budget.remainingBudget, wedding.currency)} remaining` : "Set it in Settings"}
          icon={<PiggyBank />}
          tone={budget.totalBudget > 0 && budget.contractedTotal > budget.totalBudget ? "destructive" : "primary"}
          href={`/app/weddings/${weddingId}/budget`}
        />
        <StatCard
          label="Committed"
          value={formatMoney(budget.contractedTotal, wedding.currency)}
          sub={`${formatMoney(budget.paidTotal, wedding.currency)} paid · ${formatMoney(budget.unpaidBalances, wedding.currency)} to go`}
          icon={<Wallet />}
          href={`/app/weddings/${weddingId}/budget`}
        />
        <StatCard
          label="Overdue payments"
          value={formatMoney(budget.overdueAmount, wedding.currency)}
          sub={budget.overdueAmount > 0 ? "Needs attention" : "Nothing overdue"}
          icon={<AlarmClock />}
          tone={budget.overdueAmount > 0 ? "destructive" : "success"}
          href={`/app/weddings/${weddingId}/budget?filter=overdue`}
        />
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Checklist</p>
            <ListChecks className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-0.5 font-display text-2xl font-semibold">
            {doneTasks}/{totalTasks}
          </p>
          <Progress value={taskPct} label="Checklist completion" className="mt-2" tone={taskPct === 100 ? "success" : "primary"} />
          <Link href={`/app/weddings/${weddingId}/checklist`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "View checklist"} <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </Card>
      </section>

      {/* Detail columns */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between !pb-2">
            <CardTitle>Overdue tasks</CardTitle>
            <Link href={`/app/weddings/${weddingId}/checklist?view=overdue`} className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <p className="rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">Nothing overdue. Great pace!</p>
            ) : (
              <ul className="space-y-2">
                {overdueTasks.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive-soft/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(t.due_date, "MMM d")} · {t.priority} priority
                      </p>
                    </div>
                    <Badge tone="destructive" icon={<AlertTriangle className="size-3" />}>Overdue</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between !pb-2">
            <CardTitle>Upcoming payments</CardTitle>
            <Link href={`/app/weddings/${weddingId}/budget`} className="text-xs font-medium text-primary hover:underline">
              Budget
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingPayments.length === 0 ? (
              <p className="rounded-lg bg-surface-warm px-3 py-2.5 text-sm text-muted-foreground">
                No scheduled payments yet — add payment schedules to expenses in the Budget.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingPayments.map((p) => {
                  const overdue = p.due_date! < today;
                  const exp = expenseById.get(p.expense_id);
                  return (
                    <li key={`${p.expense_id}-${p.label}-${p.due_date}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{exp?.title ?? "Expense"}</p>
                        <p className="text-xs text-muted-foreground">{p.label} · due {formatDate(p.due_date, "MMM d")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatMoney(p.amount, wedding.currency)}</p>
                        {overdue ? <Badge tone="destructive">Overdue</Badge> : <Badge tone="neutral" icon={<Clock className="size-3" />}>Scheduled</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between !pb-2">
            <CardTitle>Upcoming milestones &amp; day-of events</CardTitle>
            <Link href={`/app/weddings/${weddingId}/timeline`} className="text-xs font-medium text-primary hover:underline">
              Timeline
            </Link>
          </CardHeader>
          <CardContent>
            {(eventsR.data ?? []).length === 0 ? (
              <EmptyState
                title="Nothing scheduled yet"
                description="Planning milestones and the wedding-day schedule appear here."
                action={<Link href={`/app/weddings/${weddingId}/timeline`}><Button variant="secondary" size="sm">Open timeline</Button></Link>}
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <ul className="space-y-2">
                {(eventsR.data ?? []).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.event_date, "EEE, MMM d")}{e.start_time ? ` · ${formatTime(e.start_time)}` : ""}{e.location ? ` · ${e.location}` : ""}
                      </p>
                    </div>
                    <Badge tone={e.event_type === "wedding_day" ? "primary" : "neutral"}>
                      {e.event_type === "wedding_day" ? "Day-of" : "Milestone"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="!pb-2"><CardTitle>Recommended next steps</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {guests.length === 0 && (
                <NextStep
                  title="Build your guest list"
                  text="Add households and guests, or import a CSV."
                  href={`/app/weddings/${weddingId}/guests`}
                />
              )}
              {guests.length > 0 && invitations.length === 0 && (
                <NextStep
                  title="Generate invitation links"
                  text="Create personal links and QR codes for every household."
                  href={`/app/weddings/${weddingId}/rsvps`}
                />
              )}
              {wedding.total_budget == null && (
                <NextStep
                  title="Set your total budget"
                  text="Track quotes, contracts, and payment schedules."
                  href={`/app/weddings/${weddingId}/settings`}
                />
              )}
              {!wedding.invitation_published && (
                <NextStep
                  title="Design and publish your invitation"
                  text="Choose a theme, arrange sections, then publish."
                  href={`/app/weddings/${weddingId}/invitation`}
                />
              )}
              {pax.pendingGroups > 3 && (
                <NextStep
                  title={`${pax.pendingGroups} households still haven't replied`}
                  text="Send follow-ups before the RSVP deadline."
                  href={`/app/weddings/${weddingId}/rsvps?status=pending`}
                />
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NextStep({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/40">
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{text}</p>
        </div>
        <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
      </Link>
    </li>
  );
}
