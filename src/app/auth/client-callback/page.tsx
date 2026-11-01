"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Browser-side completion of implicit auth links. Email links for invites and
 * password resets bounce through Supabase /auth/v1/verify and come back with
 * #access_token=… in the URL fragment, which never reaches the server — so
 * /auth/callback forwards here (browsers preserve the fragment) and this page
 * establishes the session.
 */
function Handler() {
  const params = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next = params.get("next") ?? "/app";
    const safeNext = next.startsWith("/") ? next : "/app";
    const h = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = h.get("access_token");
    const refreshToken = h.get("refresh_token");
    const fragmentError = h.get("error_description") ?? h.get("error");

    (async () => {
      if (fragmentError || !accessToken || !refreshToken) {
        setFailed(true);
        setMessage(fragmentError ?? "This sign-in link is invalid or has expired.");
        return;
      }
      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (sessionError) {
        setFailed(true);
        setMessage(sessionError.message);
        return;
      }
      // Full navigation so the server components pick up the new session cookie.
      window.location.replace(safeNext);
    })();
  }, [params]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      {failed ? (
        <>
          <p className="text-sm text-destructive" role="alert">{message}</p>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground" aria-live="polite">{message}</p>
        </>
      )}
    </main>
  );
}

export default function AuthClientCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Handler />
    </Suspense>
  );
}
