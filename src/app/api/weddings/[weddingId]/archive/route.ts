import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireWeddingAccess } from "@/lib/server/weddings";
import { buildArchiveZip, type WeddingArchiveData } from "@/lib/domain/archive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABLES: { key: keyof WeddingArchiveData; table: string; single?: boolean }[] = [
  { key: "wedding", table: "weddings", single: true },
  { key: "members", table: "wedding_members" },
  { key: "tasks", table: "wedding_tasks" },
  { key: "events", table: "wedding_events" },
  { key: "guestGroups", table: "guest_groups" },
  { key: "guests", table: "guests" },
  { key: "invitations", table: "guest_invitations" },
  { key: "rsvps", table: "rsvp_responses" },
  { key: "rsvpAttendees", table: "rsvp_attendees" },
  { key: "rsvpHistory", table: "rsvp_response_history" },
  { key: "budgetCategories", table: "budget_categories" },
  { key: "vendors", table: "vendors" },
  { key: "expenses", table: "expenses" },
  { key: "expensePayments", table: "expense_payments" },
  { key: "venues", table: "venues" },
  { key: "seatingTables", table: "seating_tables" },
  { key: "tableAssignments", table: "guest_table_assignments" },
  { key: "weddingParty", table: "wedding_party_members" },
  { key: "documents", table: "wedding_documents" },
  { key: "mediaAssets", table: "media_assets" },
  { key: "decisions", table: "decisions" },
  { key: "invitationVersions", table: "invitation_versions" },
  { key: "auditEvents", table: "audit_events" },
];

/** Full data + files export. Owner/co-planner only (RLS + access check). */
export async function POST(_request: Request, { params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const access = await requireWeddingAccess(weddingId);
  if (access.role === "viewer") {
    return NextResponse.json({ error: "Viewers cannot export the workspace." }, { status: 403 });
  }
  const supabase = await createServerClient();

  const data = {} as WeddingArchiveData;
  for (const { key, table, single } of TABLES) {
    const query = supabase.from(table).select("*");
    // expense_payments has no wedding_id column — filter through expenses.
    if (table === "expense_payments") {
      const { data: expenseIds } = await supabase.from("expenses").select("id").eq("wedding_id", weddingId);
      const ids = (expenseIds ?? []).map((r) => r.id as string);
      const { data: rows, error } = ids.length
        ? await supabase.from(table).select("*").in("expense_id", ids)
        : { data: [], error: null };
      if (error) return NextResponse.json({ error: `Export failed on ${table}: ${error.message}` }, { status: 500 });
      (data as Record<string, unknown>)[key] = rows ?? [];
      continue;
    }
    if (table === "rsvp_attendees" || table === "rsvp_response_history") {
      // Join tables keyed by invitation, not wedding_id.
      const { data: invRows } = await supabase.from("guest_invitations").select("id").eq("wedding_id", weddingId);
      const ids = (invRows ?? []).map((r) => r.id as string);
      const { data: rows, error } = ids.length
        ? await supabase.from(table).select("*").in("invitation_id", ids)
        : { data: [], error: null };
      if (error) return NextResponse.json({ error: `Export failed on ${table}: ${error.message}` }, { status: 500 });
      (data as Record<string, unknown>)[key] = rows ?? [];
      continue;
    }
    if (single) {
      const { data: row, error } = await query.eq("id", weddingId).maybeSingle();
      if (error) return NextResponse.json({ error: `Export failed: ${error.message}` }, { status: 500 });
      (data as Record<string, unknown>)[key] = row ?? {};
      continue;
    }
    const { data: rows, error } = await query.eq("wedding_id", weddingId);
    if (error) return NextResponse.json({ error: `Export failed on ${table}: ${error.message}` }, { status: 500 });
    (data as Record<string, unknown>)[key] = rows ?? [];
  }

  // Attach uploaded files (documents + inspiration) under files/.
  const zipEntries: { path: string; bytes: ArrayBuffer }[] = [];
  for (const doc of (data.documents ?? []) as { storage_path: string; title: string }[]) {
    const { data: file } = await supabase.storage.from("wedding-media").download(doc.storage_path);
    if (file) zipEntries.push({ path: `files/documents/${doc.storage_path.split("/").pop()}`, bytes: await file.arrayBuffer() });
  }
  for (const asset of (data.mediaAssets ?? []) as { storage_path: string }[]) {
    const { data: file } = await supabase.storage.from("wedding-media").download(asset.storage_path);
    if (file) zipEntries.push({ path: `files/inspiration/${asset.storage_path.split("/").pop()}`, bytes: await file.arrayBuffer() });
  }

  const zip = await buildArchiveZip(data, {
    weddingName: `${access.wedding.bride_name} & ${access.wedding.groom_name}`,
  });

  // Append collected files into the generated archive under files/.
  const JSZip = (await import("jszip")).default;
  const finalZip = new JSZip();
  await finalZip.loadAsync(zip);
  for (const entry of zipEntries) finalZip.file(entry.path, entry.bytes);
  const out = await finalZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="vowplan-archive-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
