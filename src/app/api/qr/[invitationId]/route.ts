import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createServerClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/domain/tokens";

/**
 * Planner-only QR generation for an invitation.
 * ?format=svg|png — high error correction, generous quiet zone.
 * The QR encodes ONLY the invitation URL (never personal data).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  const { invitationId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "svg" ? "svg" : "png";

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: invitation, error } = await supabase
    .from("guest_invitations")
    .select("token_ciphertext")
    .eq("id", invitationId)
    .maybeSingle();
  if (error || !invitation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = decryptToken(invitation.token_ciphertext);
  if (!token) return NextResponse.json({ error: "Token unavailable" }, { status: 500 });

  const inviteUrl = `${url.origin}/invite/${token}`;

  if (format === "svg") {
    const svg = await QRCode.toString(inviteUrl, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 4,
      color: { dark: "#3B2A2E", light: "#FFFFFF" },
    });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="invitation-${invitationId.slice(0, 8)}.svg"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const png = await QRCode.toBuffer(inviteUrl, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 4,
    width: 720,
    color: { dark: "#3B2A2E", light: "#FFFFFF" },
  });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="invitation-${invitationId.slice(0, 8)}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
