"use client";
import { useMemo, useState, useTransition } from "react";
import {
  Plus, Search, LayoutList, KanbanSquare, CalendarDays, Loader2, Trash2, Pencil,
  Circle, CircleCheck, CircleDot, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, FieldError } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { TASK_CATEGORIES } from "@/lib/domain/task-templates";
import { createTask, updateTask, toggleTaskDone, deleteTask } from "@/lib/actions/tasks";
import { formatDate, daysUntil } from "@/lib/domain/format";
import type { Task } from "@/lib/domain/types";

const PRIORITY_TONE = { low: "neutral", medium: "info", high: "warning", critical: "destructive" } as const;
const STATUS_ICON = { todo: Circle, in_progress: CircleDot, done: CircleCheck } as const;

export function ChecklistClient({
  weddingId,
  tasks,
  initialView,
}: {
  weddingId: string;
  tasks: Task[];
  initialView: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"list" | "board" | "upcoming">(initialView as never);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !`${t.title} ${t.description ?? ""} ${t.assignee ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== "all" && t.category !== category) return false;
      if (status !== "all" && t.status !== status) return false;
      return true;
    });
  }, [tasks, search, category, status]);

  const overdue = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today);
  const doneCount = tasks.filter((t) => t.status === "done").length;

  async function onToggle(task: Task) {
    startTransition(async () => {
      const r = await toggleTaskDone(weddingId, task.id, task.status !== "done");
      if ("error" in r && r.error) toast("error", r.error);
    });
  }
  async function onDelete(task: Task) {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deleteTask(weddingId, task.id);
      if ("error" in r && r.error) toast("error", r.error);
      else toast("success", "Task deleted.");
    });
  }

  const columns = [
    { key: "todo", label: "To do" },
    { key: "in_progress", label: "In progress" },
    { key: "done", label: "Done" },
  ] as const;

  const upcoming = [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const ad = a.due_date ?? "9999";
      const bd = b.due_date ?? "9999";
      return ad < bd ? -1 : 1;
    })
    .slice(0, 15);

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Checklist &amp; Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {doneCount} of {tasks.length} complete{overdue.length > 0 && ` · ${overdue.length} overdue`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" /> New task</Button>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" className="pl-9" aria-label="Search tasks" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {TASK_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="todo">To do</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Tabs value={view} onValueChange={(v) => setView(v as never)}>
          <TabsList aria-label="View mode">
            <TabsTrigger value="list"><LayoutList className="size-4" aria-hidden="true" /> List</TabsTrigger>
            <TabsTrigger value="board"><KanbanSquare className="size-4" aria-hidden="true" /> Board</TabsTrigger>
            <TabsTrigger value="upcoming"><CalendarDays className="size-4" aria-hidden="true" /> Upcoming</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<ListChecks />}
          title={tasks.length === 0 ? "No tasks yet" : "No tasks match your filters"}
          description={tasks.length === 0 ? "Create your first task, or enable the starter checklist from onboarding." : "Try adjusting search or filters."}
          action={<Button onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" /> New task</Button>}
        />
      ) : view === "list" ? (
        <ul className="mt-5 space-y-2">
          {filtered.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={onToggle} onEdit={() => setEditing(t)} onDelete={() => onDelete(t)} busy={pending} />
          ))}
        </ul>
      ) : view === "board" ? (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {columns.map((col) => (
            <div key={col.key} className="rounded-xl border border-border bg-surface-warm/40 p-3">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label} · {filtered.filter((t) => t.status === col.key).length}
              </p>
              <div className="space-y-2">
                {filtered.filter((t) => t.status === col.key).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEditing(t)}
                    className="w-full cursor-pointer rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition-shadow hover:shadow-md"
                  >
                    <p className={cn("text-sm font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                      {t.due_date && (
                        <Badge tone={t.status !== "done" && t.due_date < today ? "destructive" : "neutral"}>
                          {formatDate(t.due_date, "MMM d")}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
                {filtered.filter((t) => t.status === col.key).length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nothing here</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ol className="mt-5 space-y-2">
          {upcoming.map((t, i) => {
            const days = daysUntil(t.due_date);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-primary/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.due_date ? formatDate(t.due_date, "EEE, MMM d") : "No due date"}
                      {days != null && days >= 0 && ` · in ${days} day${days === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                </button>
              </li>
            );
          })}
          {upcoming.length === 0 && (
            <EmptyState icon={<CircleCheck />} title="All caught up!" description="No outstanding tasks." />
          )}
        </ol>
      )}

      <TaskDialog
        open={creating || editing != null}
        task={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        weddingId={weddingId}
      />
    </div>
  );
}

function TaskRow({
  task, onToggle, onEdit, onDelete, busy,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const Icon = STATUS_ICON[task.status];
  return (
    <li className="card flex items-center gap-3 px-4 py-3">
      <Checkbox
        checked={task.status === "done"}
        onCheckedChange={() => onToggle(task)}
        aria-label={task.status === "done" ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        disabled={busy}
        className="size-5"
      />
      <Icon
        className={cn("size-4 shrink-0", task.status === "done" ? "text-success" : task.status === "in_progress" ? "text-info" : "text-muted-foreground")}
        aria-hidden="true"
      />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 cursor-pointer text-left">
        <p className={cn("truncate text-sm font-medium", task.status === "done" && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {TASK_CATEGORIES.find((c) => c.id === task.category)?.label ?? task.category}
          {task.due_date && ` · due ${formatDate(task.due_date, "MMM d, yyyy")}`}
          {task.assignee && ` · ${task.assignee}`}
          {task.relative_days != null && ` · auto-shifts with wedding date`}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        {task.status !== "done" && task.due_date && task.due_date < today && (
          <Badge tone="destructive">Overdue</Badge>
        )}
        <Badge tone={PRIORITY_TONE[task.priority]} className="hidden sm:inline-flex">{task.priority}</Badge>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${task.title}`}>
          <Pencil aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Delete ${task.title}`} className="hover:text-destructive">
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

function TaskDialog({
  open, task, onClose, weddingId,
}: {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  weddingId: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? "") || null,
      category: String(fd.get("category") ?? "other"),
      priority: String(fd.get("priority") ?? "medium"),
      status: String(fd.get("status") ?? "todo"),
      due_date: String(fd.get("due_date") ?? "") || null,
      assignee: String(fd.get("assignee") ?? "") || null,
      relative_days: fd.get("relative_days") ? Number(fd.get("relative_days")) : null,
      notes: String(fd.get("notes") ?? "") || null,
    };
    const r = task ? await updateTask(weddingId, task.id, input) : await createTask(weddingId, input);
    setBusy(false);
    if ("error" in r && r.error) {
      setError(r.error);
      return;
    }
    toast("success", task ? "Task updated." : "Task created.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader
          title={task ? "Edit task" : "New task"}
          description={task?.relative_days != null ? "This task shifts automatically when the wedding date changes." : undefined}
        />
        <form onSubmit={onSubmit} className="space-y-4" key={task?.id ?? "new"}>
          <div>
            <Label htmlFor="t-title" required>Title</Label>
            <Input id="t-title" name="title" required defaultValue={task?.title} className="mt-1.5" autoFocus />
          </div>
          <div>
            <Label htmlFor="t-desc" hint="optional">Description</Label>
            <Textarea id="t-desc" name="description" defaultValue={task?.description ?? ""} className="mt-1.5" rows={2} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="t-cat">Category</Label>
              <Select name="category" defaultValue={task?.category ?? "other"}>
                <SelectTrigger id="t-cat" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-pri">Priority</Label>
              <Select name="priority" defaultValue={task?.priority ?? "medium"}>
                <SelectTrigger id="t-pri" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-status">Status</Label>
              <Select name="status" defaultValue={task?.status ?? "todo"}>
                <SelectTrigger id="t-status" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="t-due">Due date</Label>
              <Input id="t-due" name="due_date" type="date" defaultValue={task?.due_date ?? ""} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="t-assignee" hint="who does it">Assignee</Label>
              <Input id="t-assignee" name="assignee" defaultValue={task?.assignee ?? ""} className="mt-1.5" placeholder="Maria" />
            </div>
            <div>
              <Label htmlFor="t-rel" hint="days before wedding">Relative to date</Label>
              <Input id="t-rel" name="relative_days" type="number" defaultValue={task?.relative_days ?? ""} className="mt-1.5" placeholder="e.g. 90" />
            </div>
          </div>
          <FieldError message={error} />
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {task ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
