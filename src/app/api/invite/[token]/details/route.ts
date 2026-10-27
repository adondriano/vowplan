import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";

/** Public wedding details (only explicitly public venues + schedule). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^vp_[A-Za-z0-9_-]{20,120}$/.test(token)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_wedding_details", { p_token: token });
  if (error || !data) {
    return NextResponse.json({ venues: [], schedule: [] });
  }
  // Cache-busting: personalized, short-lived.
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
