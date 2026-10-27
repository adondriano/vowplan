"use client";
import { useState } from "react";
import Link from "next/link";
import { UserPlus, Wallet, ListPlus, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { createGuest } from "@/lib/actions/guests";
import { createExpense } from "@/lib/actions/budget";
import { createTask } from "@/lib/actions/tasks";

export function QuickActions({ weddingId }: { weddingId: string }) {
  const { toast } = useToast();
  const [dialog, setDialog] = useState<null | "guest" | "expense" | "task">(null);
  const [busy, setBusy] = useState(false);

  async function addGuest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await createGuest(weddingId, {
      first_name: String(fd.get("firstName") ?? ""),
      last_name: String(fd.get("lastName") ?? "") || null,
    });
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    setDialog(null);
    toast("success", "Guest added to the list.");
  }

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await createExpense(weddingId, {
      title: String(fd.get("title") ?? ""),
      estimated_amount: Number(fd.get("amount") ?? 0),
    });
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    setDialog(null);
    toast("success", "Expense added to the budget.");
  }

  async function addTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await createTask(weddingId, {
      title: String(fd.get("title") ?? ""),
      due_date: String(fd.get("due") ?? "") || null,
    });
    setBusy(false);
    if ("error" in r && r.error) return toast("error", r.error);
    setDialog(null);
    toast("success", "Task added to the checklist.");
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setDialog("guest")}>
          <UserPlus className="size-4" aria-hidden="true" /> Guest
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDialog("expense")}>
          <Wallet className="size-4" aria-hidden="true" /> Expense
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDialog("task")}>
          <ListPlus className="size-4" aria-hidden="true" /> Task
        </Button>
        <Link href={`/app/weddings/${weddingId}/invitation`}>
          <Button size="sm" variant="gold">
            <Globe className="size-4" aria-hidden="true" /> Invitation
          </Button>
        </Link>
      </div>

      <Dialog open={dialog === "guest"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader title="Quick add guest" description="You can add full details later from the Guest List." />
          <form onSubmit={addGuest} className="space-y-3">
            <div>
              <Label htmlFor="qa-first" required>First name</Label>
              <Input id="qa-first" name="firstName" required className="mt-1.5" autoFocus />
            </div>
            <div>
              <Label htmlFor="qa-last">Last name</Label>
              <Input id="qa-last" name="lastName" className="mt-1.5" />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Add guest
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "expense"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader title="Quick add expense" description="Estimates are enough to start — refine details in the Budget." />
          <form onSubmit={addExpense} className="space-y-3">
            <div>
              <Label htmlFor="qa-exp-title" required>Title</Label>
              <Input id="qa-exp-title" name="title" required className="mt-1.5" placeholder="Catering deposit" autoFocus />
            </div>
            <div>
              <Label htmlFor="qa-exp-amount">Estimated amount</Label>
              <Input id="qa-exp-amount" name="amount" type="number" min="0" step="0.01" className="mt-1.5" placeholder="25000" />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Add expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "task"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader title="Quick add task" />
          <form onSubmit={addTask} className="space-y-3">
            <div>
              <Label htmlFor="qa-task-title" required>Task</Label>
              <Input id="qa-task-title" name="title" required className="mt-1.5" autoFocus placeholder="Book florist" />
            </div>
            <div>
              <Label htmlFor="qa-task-due">Due date</Label>
              <Input id="qa-task-due" name="due" type="date" className="mt-1.5" />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Add task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
