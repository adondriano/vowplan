/**
 * Supabase configuration validation at the feature boundary.
 * Missing configuration produces a helpful status instead of crashes.
 */
export type SupabaseConfigStatus = {
  ok: boolean;
  missing: string[];
  help: string;
};

export function getSupabaseConfig(): SupabaseConfigStatus {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    ok: missing.length === 0,
    missing,
    help: "Add these environment variables (Vercel Project Settings → Environment Variables, or .env.local for local development). They come from your Supabase project: Settings → API.",
    ...(serviceKey ? {} : {}),
  };
}

export const APP_ENCRYPTION_KEY_ENV = "APP_ENCRYPTION_KEY";

/** Server-only encryption key used for invitation token ciphertext. */
