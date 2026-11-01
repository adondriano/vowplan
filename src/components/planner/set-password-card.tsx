"use client";
/**
 * Shown on /app to accounts created via an email invite: Supabase creates
 * them without a password (they sign in through the invite link), so we ask
 * them to choose one before their session expires — otherwise they'd be
 * locked out of the account the invite created.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export function SetPasswordCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    if (password.length < 8) {
      toast("error", "Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirm) {
      toast("error", "Passwords don't match.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      });
      if (error) {
        toast("error", error.message);
        return;
      }
      toast("success", "Password set — you can now sign in with your email and password.");
      router.refresh();
    });
  }

  return (
    <section aria-label="Set your password" className="rounded-xl border border-accent/30 bg-accent-soft p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-accent">
        <KeyRound className="size-4" aria-hidden="true" /> Finish setting up your account
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        You joined through an email invitation. Choose a password so you can sign in next time.
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex-1">
          <Label htmlFor="sp-password">New password</Label>
          <Input
            id="sp-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5"
            placeholder="At least 8 characters"
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="sp-confirm">Confirm password</Label>
          <Input
            id="sp-confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1.5"
            placeholder="Repeat password"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </section>
  );
}
