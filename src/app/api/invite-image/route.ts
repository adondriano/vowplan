import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Serves published invitation images from the public invitation bucket.
 * Authorization: the path's wedding must currently have a PUBLISHED
 * invitation (checked via a narrowly-scoped RPC — no wedding rows exposed).
 * Guests can only reach assets embedded in the published invitation.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") ?? "";
  if (!/^[0-9a-f-]{36}\/[\w\-./]{1,300}$/.test(path)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  const weddingId = path.split("/")[0];

  const supabase = createPublicClient();
  const { data: published } = await supabase.rpc("is_invitation_published", {
    p_wedding_id: weddingId,
  });
  if (!published) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  const { data } = supabase.storage.from("invitation-public").getPublicUrl(path);
  try {
    const res = await fetch(data.publicUrl, { redirect: "follow" });
    if (res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) {
      return new NextResponse(res.body, {
        headers: {
          "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch {
    /* fall through */
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
