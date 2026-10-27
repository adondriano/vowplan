import JSZip from "jszip";

/**
 * Wedding archive (ZIP) — export/import format.
 * The archive contains full wedding data as JSON + CSV, plus a manifest with
 * record counts and the schema version so reopening can validate integrity.
 * Cloud deletion always requires a separate, explicit confirmation step.
 */

export const ARCHIVE_SCHEMA_VERSION = 1;

export type ArchiveManifest = {
  app: "VowPlan";
  schemaVersion: number;
  exportedAt: string;
  counts: Record<string, number>;
};

export type WeddingArchiveData = {
  wedding: Record<string, unknown>;
  members: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  events: Record<string, unknown>[];
  guestGroups: Record<string, unknown>[];
  guests: Record<string, unknown>[];
  invitations: Record<string, unknown>[];
  rsvps: Record<string, unknown>[];
  rsvpAttendees: Record<string, unknown>[];
  rsvpHistory: Record<string, unknown>[];
  budgetCategories: Record<string, unknown>[];
  vendors: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  expensePayments: Record<string, unknown>[];
  venues: Record<string, unknown>[];
  seatingTables: Record<string, unknown>[];
  tableAssignments: Record<string, unknown>[];
  weddingParty: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  mediaAssets: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  invitationVersions: Record<string, unknown>[];
  auditEvents: Record<string, unknown>[];
};

export const ARCHIVE_FILES: { key: keyof WeddingArchiveData; file: string }[] = [
  { key: "wedding", file: "wedding.json" },
  { key: "members", file: "members.json" },
  { key: "tasks", file: "tasks.json" },
  { key: "events", file: "timeline.json" },
  { key: "guestGroups", file: "guest-groups.json" },
  { key: "guests", file: "guests.json" },
  { key: "invitations", file: "invitations.json" },
  { key: "rsvps", file: "rsvps.json" },
  { key: "rsvpAttendees", file: "rsvp-attendees.json" },
  { key: "rsvpHistory", file: "rsvp-history.json" },
  { key: "budgetCategories", file: "budget-categories.json" },
  { key: "vendors", file: "vendors.json" },
  { key: "expenses", file: "expenses.json" },
  { key: "expensePayments", file: "expense-payments.json" },
  { key: "venues", file: "venues.json" },
  { key: "seatingTables", file: "seating.json" },
  { key: "tableAssignments", file: "seating-assignments.json" },
  { key: "weddingParty", file: "wedding-party.json" },
  { key: "documents", file: "documents.json" },
  { key: "mediaAssets", file: "media.json" },
  { key: "decisions", file: "decisions.json" },
  { key: "invitationVersions", file: "invitation.json" },
  { key: "auditEvents", file: "audit.json" },
];

export async function buildArchiveZip(
  data: WeddingArchiveData,
  meta: { weddingName: string },
): Promise<Buffer> {
  const zip = new JSZip();
  const counts: Record<string, number> = {};
  for (const { key, file } of ARCHIVE_FILES) {
    const value = data[key];
    if (key === "wedding") {
      zip.file(file, JSON.stringify(value ?? {}, null, 2));
      continue;
    }
    const arr = Array.isArray(value) ? value : [];
    counts[key] = arr.length;
    zip.file(file, JSON.stringify(arr, null, 2));
  }

  const manifest: ArchiveManifest = {
    app: "VowPlan",
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // CSV copies for spreadsheet-friendly access
  zip.folder("csv");
  zip.file("csv/README.txt", "CSV copies of the core planning tables.\r\n");
  zip.file("csv/guests.csv", toCsvFromObjects((data.guests ?? []) as Record<string, unknown>[]));
  zip.file("csv/rsvps.csv", toCsvFromObjects((data.rsvps ?? []) as Record<string, unknown>[]));
  zip.file("csv/tasks.csv", toCsvFromObjects((data.tasks ?? []) as Record<string, unknown>[]));
  zip.file("csv/expenses.csv", toCsvFromObjects((data.expenses ?? []) as Record<string, unknown>[]));

  // Manifest note about privacy
  zip.file(
    "README.txt",
    [
      `VowPlan wedding archive — ${meta.weddingName}`,
      `Exported ${manifest.exportedAt} (schema v${manifest.schemaVersion})`,
      "",
      "This archive contains personal information (guest names, contacts,",
      "RSVPs, and financial data). Store it securely and share it only with",
      "the wedding owners. VowPlan does not store any archive password;",
      "protection of this file is your responsibility.",
    ].join("\r\n"),
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function toCsvFromObjects(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join(
      "\r\n",
    ) + "\r\n"
  );
}

export type ParsedArchive = {
  manifest: ArchiveManifest;
  data: WeddingArchiveData;
};

export async function parseArchiveZip(file: ArrayBuffer | Uint8Array): Promise<ParsedArchive> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("Not a VowPlan archive: manifest.json missing.");
  const manifest = JSON.parse(await manifestFile.async("string")) as ArchiveManifest;
  if (manifest.app !== "VowPlan") throw new Error("Not a VowPlan archive.");
  if (manifest.schemaVersion > ARCHIVE_SCHEMA_VERSION) {
    throw new Error(
      `Archive schema v${manifest.schemaVersion} is newer than this app supports (v${ARCHIVE_SCHEMA_VERSION}).`,
    );
  }

  const data: WeddingArchiveData = {
    wedding: {},
    members: [], tasks: [], events: [], guestGroups: [], guests: [], invitations: [],
    rsvps: [], rsvpAttendees: [], rsvpHistory: [], budgetCategories: [], vendors: [],
    expenses: [], expensePayments: [], venues: [], seatingTables: [], tableAssignments: [],
    weddingParty: [], documents: [], mediaAssets: [], decisions: [], invitationVersions: [],
    auditEvents: [],
  };
  for (const { key, file: fileName } of ARCHIVE_FILES) {
    const f = zip.file(fileName);
    if (!f) continue;
    const json = JSON.parse(await f.async("string"));
    data[key] = json as never;
  }

  // Cross-reference integrity check: invitations → groups; rsvps → invitations.
  const groupIds = new Set(data.guestGroups.map((g) => g.id));
  const invIds = new Set(data.invitations.map((i) => i.id));
  const brokenInvitations = data.invitations.filter((i) => !groupIds.has(i.group_id)).length;
  const brokenRsvps = data.rsvps.filter((r) => !invIds.has(r.invitation_id)).length;
  if (brokenInvitations > 0 || brokenRsvps > 0) {
    throw new Error(
      `Archive references are inconsistent: ${brokenInvitations} orphan invitations, ${brokenRsvps} orphan RSVPs.`,
    );
  }

  return { manifest, data };
}
