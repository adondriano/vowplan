"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Landing for the password-reset email link (via /auth/callback?next= here).
 * The reset link signs the user in, so updateUser() sets the new password.
 */
export default function AccountPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick something you don&apos;t use anywhere else.</p>

      {done ? (
        <div className="card mt-6 space-y-3 p-6" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <KeyRound className="size-4" aria-hidden="true" /> Password updated
          </p>
          <Link href="/app" className="text-sm font-medium text-primary hover:underline">
            Continue to your planner
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6" aria-label="Set new password">
          <div>
            <Label htmlFor="np-password" required>New password</Label>
            <Input
              id="np-password"
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
          <div>
            <Label htmlFor="np-confirm" required>Confirm password</Label>
            <Input
              id="np-confirm"
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
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? "Saving…" : "Save password"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Link expired?{" "}
            <Link href="/reset-password" className="font-medium text-primary hover:underline">
              Request a new one
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
