import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/domain/tokens";

/**
 * Planner-only: reveals the stored invitation link (decrypted ciphertext).
 * RLS ensures only workspace members can read the row in the first place.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  const { invitationId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: invitation, error } = await supabase
    .from("guest_invitations")
    .select("id, token_ciphertext")
    .eq("id", invitationId)
    .maybeSingle();
  if (error || !invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const token = decryptToken(invitation.token_ciphertext);
  if (!token) return NextResponse.json({ error: "Token could not be decrypted" }, { status: 500 });
  return NextResponse.json({ token });
}
