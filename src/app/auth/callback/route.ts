import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Auth email-link landing. Handles both flows Supabase can emit:
 * - ?code=...            → PKCE exchange (OAuth / magic-link style redirects)
 * - ?token_hash=...&type=… → token-hash links embedded in invite/recovery emails
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "recovery" | "signup" | "email",
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // No code/token in the query — the link carries its session in the URL
  // #fragment (implicit flow), which only the browser can see. Browsers
  // preserve the fragment across redirects, so hand off to the client page.
  return NextResponse.redirect(`${origin}/auth/client-callback?next=${encodeURIComponent(next)}`);
}
