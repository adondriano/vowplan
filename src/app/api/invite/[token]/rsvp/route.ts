import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { invitationContentSchema } from "@/lib/domain/invitation";

const MAX_BODY = 8000; // bytes — RSVP payloads are small

/**
 * Public RSVP submission. Flow:
 *   1. rate limit per IP (DB-backed sliding window, works on serverless)
 *   2. zod-validate the payload shape
 *   3. delegate ALL authorization to the submit_rsvp SECURITY DEFINER RPC,
 *      which enforces token validity, deadline/closed rules, and the PAX cap
 *   4. return a minimal, sanitized result
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!/^vp_[A-Za-z0-9_-]{20,120}$/.test(token)) {
    return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ipHash = Buffer.from(ip).toString("base64url").slice(0, 40); // avoid storing raw IPs

  const supabase = createPublicClient();

  // 1) rate limit — generous for humans, hostile to scripts
  const { data: allowed, error: rlErr } = await supabase.rpc("check_rate_limit", {
    p_key: `rsvp:${ipHash}`,
    p_max: 12,
    p_window_seconds: 3600,
  });
  if (rlErr || allowed === false) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", message: "Too many attempts — please wait a minute and try again." },
      { status: 429 },
    );
  }

  // 2) validate payload shape
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) throw new Error("too_large");
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "confirmed" && status !== "declined") {
    return NextResponse.json({ ok: false, code: "invalid_status" }, { status: 400 });
  }
  const attendingCount = Number(body.attendingCount ?? 0);
  if (!Number.isInteger(attendingCount) || attendingCount < 0 || attendingCount > 20) {
    return NextResponse.json({ ok: false, code: "invalid_count" }, { status: 400 });
  }
  const str = (v: unknown, len = 500) =>
    typeof v === "string" && v.trim() !== "" ? v.slice(0, len) : "";

  const payload = {
    status,
    attendingCount: status === "declined" ? 0 : attendingCount,
    mealPreferences: str(body.mealPreferences, 200),
    dietaryNotes: str(body.dietaryNotes, 500),
    accessibilityNotes: str(body.accessibilityNotes, 500),
    messageToCouple: str(body.messageToCouple, 1000),
    songRequest: str(body.songRequest, 200),
    attendees: Array.isArray(body.attendees)
      ? (body.attendees as unknown[]).slice(0, 30).map((a) => {
          const o = (a ?? {}) as Record<string, unknown>;
          return {
            displayName: str(o.displayName, 200) || "Guest",
            attending: Boolean(o.attending),
          };
        })
      : null,
  };
  // Content schema double-checks string lengths on free-form fields.
  void invitationContentSchema.safeParse({ reminders: [payload.dietaryNotes] });

  // 3) authoritative, atomic submission inside the database
  const { data, error } = await supabase.rpc("submit_rsvp", {
    p_token: token,
    p_payload: payload,
  });
  if (error) {
    return NextResponse.json({ ok: false, code: "server_error" }, { status: 500 });
  }

  const result = data as { ok: boolean; code?: string; maxPax?: number; attendingCount?: number; status?: string };
  if (!result?.ok) {
    const statusMap: Record<string, number> = {
      invalid_token: 404,
      revoked_token: 410,
      expired_token: 410,
      closed: 403,
      pax_exceeded: 422,
      invalid_status: 400,
    };
    return NextResponse.json(
      { ok: false, code: result?.code ?? "error", maxPax: result?.maxPax },
      { status: statusMap[result?.code ?? "error"] ?? 400 },
    );
  }

  // 4) minimal response
  return NextResponse.json({
    ok: true,
    status: result.status,
    attendingCount: result.attendingCount,
  });
}
