import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client, SERVER ONLY.
 * The service-role key bypasses RLS — it must never be imported from any
 * client component or referenced with a NEXT_PUBLIC_ name. Used for a
 * handful of privileged operations (auth admin APIs such as invite emails).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** The production origin of this deployment (used for auth email redirects). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://vowplan-vert.vercel.app";
}
