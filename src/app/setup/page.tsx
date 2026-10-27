import Link from "next/link";
import { Settings2, ExternalLink, CheckCircle2 } from "lucide-react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const config = getSupabaseConfig();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <div className="card p-8">
        <Settings2 className="size-8 text-primary" aria-hidden="true" />
        <h1 className="mt-3 font-display text-2xl font-semibold">Connect your Supabase project</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          VowPlan needs its database connection before the planner, invitations, and RSVPs
          come alive. Everything else is already deployed.
        </p>

        <div className="mt-6 space-y-2" aria-live="polite">
          {config.ok ? (
            <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Configuration detected. Try reloading the app.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">Missing environment variables:</p>
              <ul className="space-y-1.5">
                {config.missing.map((m) => (
                  <li key={m} className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 font-mono text-xs text-warning">
                    {m}
                  </li>
                ))}
              </ul>
              <p className="pt-2 text-xs leading-relaxed text-muted-foreground">{config.help}</p>
            </>
          )}
        </div>

        <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-foreground-secondary">
          <li>Create (or restore) a Supabase project.</li>
          <li>Apply the migration in <code className="rounded bg-surface-warm px-1 font-mono text-xs">supabase/migrations/</code>.</li>
          <li>
            Add <code className="rounded bg-surface-warm px-1 font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code className="rounded bg-surface-warm px-1 font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{" "}
            <code className="rounded bg-surface-warm px-1 font-mono text-xs">APP_ENCRYPTION_KEY</code> to the environment.
          </li>
          <li>Redeploy or reload this page.</li>
        </ol>

        <div className="mt-8 flex gap-3">
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
            <Button variant="outline">
              Open Supabase dashboard <ExternalLink className="size-4" aria-hidden="true" />
            </Button>
          </a>
          <Link href="/"><Button variant="ghost">Back to home</Button></Link>
        </div>
      </div>
    </main>
  );
}
