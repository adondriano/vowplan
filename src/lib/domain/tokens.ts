import crypto from "crypto";
import { getEncryptionKey } from "@/lib/server/token-crypto";

/**
 * Invitation token handling.
 *  - Tokens are 192-bit cryptographically random, URL-safe (`vp_` + base64url).
 *  - Only the SHA-256 hash (lookup) and AES-256-GCM ciphertext (planner
 *    re-display) are persisted; the plaintext never lives in the database.
 *  - Raw tokens are bearer credentials: anyone holding the URL can view that
 *    one invitation. This is surfaced to planners in the UI.
 */

export const TOKEN_PREFIX = "vp_";

export function generateInvitationToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  // Without an app key, fall back to a deterministic non-secret envelope so
  // local/dev still works; Supabase deployments set APP_ENCRYPTION_KEY.
  const k = key ?? crypto.createHash("sha256").update("vowplan-dev-fallback").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${enc.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptToken(ciphertext: string): string | null {
  try {
    const [version, ivB64, dataB64, tagB64] = ciphertext.split(".");
    if (version !== "v1" || !ivB64 || !dataB64 || !tagB64) return null;
    const key = getEncryptionKey();
    const k = key ?? crypto.createHash("sha256").update("vowplan-dev-fallback").digest();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      k,
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** Timing-safe comparison helper (used by hash lookups anyway; belt & braces). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
