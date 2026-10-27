"use server";
import { createServerClient } from "@/lib/supabase/server";
import { requireWeddingAccess } from "@/lib/server/weddings";
import { revalidatePath } from "next/cache";

/**
 * Archive data assembly lives in the export route handler; this action module
 * covers the destructive cloud cleanup with strict owner + confirmation
 * requirements (confirmationCode is a human-typed phrase, not a secret).
 */

export type CleanupResult =
  | { ok: true; removed: Record<string, number>; warnings: string[] }
  | { error: string };

export async function deleteWeddingCloudData(
  weddingId: string,
  confirmationCode: string,
): Promise<CleanupResult> {
  const access = await requireWeddingAccess(weddingId);
  if (access.role !== "owner") {
    return { error: "Only the workspace owner can delete cloud data." };
  }
  const expected = "DELETE MY WEDDING";
  if (confirmationCode.trim().toUpperCase() !== expected) {
    return { error: `Type "${expected}" exactly to confirm deletion.` };
  }

  const supabase = await createServerClient();
  const removed: Record<string, number> = {};
  const warnings: string[] = [];

  // Delete storage objects for this wedding (both buckets), best-effort.
  for (const bucket of ["wedding-media", "invitation-public"]) {
    const { data: listed, error: listErr } = await supabase.storage
      .from(bucket)
      .list(weddingId, { limit: 1000 });
    if (listErr) {
      warnings.push(`Storage bucket "${bucket}" could not be listed: ${listErr.message}`);
      continue;
    }
    const paths = (listed ?? []).map((o) => `${weddingId}/${o.name}`);
    if (paths.length) {
      const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
      if (rmErr) warnings.push(`Storage bucket "${bucket}": ${rmErr.message}`);
      else removed[bucket] = paths.length;
    }
  }

  // Delete the wedding row; ON DELETE CASCADE removes every child record.
  const { error } = await supabase.from("weddings").delete().eq("id", weddingId);
  if (error) return { error: `Database cleanup failed: ${error.message}. ${warnings.length ? `Storage warnings: ${warnings.join("; ")}` : "Storage files were removed."}` };

  // Verify.
  const { data: check } = await supabase.from("weddings").select("id").eq("id", weddingId).maybeSingle();
  if (check) return { error: "Deletion could not be verified; some records may remain." };

  revalidatePath("/app");
  return { ok: true, removed, warnings };
}
