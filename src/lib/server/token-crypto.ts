import { createHash } from "crypto";
import { APP_ENCRYPTION_KEY_ENV } from "@/lib/supabase/config";

/**
 * Derives the AES-256-GCM key for invitation-token reveal ciphertexts.
 * Node-only: must never be imported from Edge middleware or client bundles.
 */
export function getEncryptionKey(): Buffer | null {
  const raw = process.env[APP_ENCRYPTION_KEY_ENV];
  if (!raw) return null;
  // Accept 32-byte hex (64 chars) or any passphrase (derive via sha256).
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  return createHash("sha256").update(raw).digest();
}
