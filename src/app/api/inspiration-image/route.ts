import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** Planner-only: streams private inspiration images via a short signed URL. RLS guards the row. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") ?? "";
  if (!/^[0-9a-f-]{36}\/inspiration\/[\w.\-]{1,240}$/.test(path)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  const supabase = await createServerClient();
  const { data: signed, error } = await supabase.storage
    .from("wedding-media")
    .createSignedUrl(path, 300);
  if (error || !signed) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const res = await fetch(signed.signedUrl);
    if (res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) {
      return new NextResponse(res.body, {
        headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=60" },
      });
    }
  } catch {
    /* fall through */
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
