/**
 * RLS + secure RPC integration tests.
 * Runs against a local Postgres with the VowPlan migration applied.
 * Emulates Supabase roles: each query runs in a transaction with
 * `set_config('role', ...)` and `request.jwt.claim.sub` set, exactly like
 * Supabase's PostgREST connection does.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool, PoolClient } from "pg";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://vowplan:vowplan@localhost:5432/vowplan";

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

async function q(client: PoolClient, sql: string, params: unknown[] = []) {
  const r = await client.query(sql, params);
  return r.rows;
}

/** Run a query as a given role with a given user id (JWT sub emulation). */
async function asUser(
  client: PoolClient,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: any[]; error?: string }> {
  try {
    await client.query("begin");
    await client.query("select set_config('role', 'authenticated', true)");
    await client.query(
      "select set_config('request.jwt.claim.sub', $1, true)",
      [userId ?? ""],
    );
    const r = await client.query(sql, params);
    await client.query("commit");
    return { rows: r.rows };
  } catch (e: any) {
    await client.query("rollback");
    return { rows: [], error: String(e.message ?? e) };
  }
}

/** Run a query as the anon role (no JWT sub). */
async function asAnon(client: PoolClient, sql: string, params: unknown[] = []) {
  try {
    await client.query("begin");
    await client.query("select set_config('role', 'anon', true)");
    const r = await client.query(sql, params);
    await client.query("commit");
    return { rows: r.rows };
  } catch (e: any) {
    await client.query("rollback");
    return { rows: [], error: String(e.message ?? e) };
  }
}

const uuid = () => null as unknown as string;
let A: string; // owner
let B: string; // co-planner
let C: string; // outsider
let W: string; // wedding
let GROUP: string;
let INV: string;
let TOKEN: string; // raw token (held by planner/browser only)
let GUEST1: string;
let GUEST2: string;

beforeAll(async () => {});

beforeEach(async () => {
  const client = await pool.connect();
  try {
    // wipe data tables (keep schema)
    const tables = [
      "rate_limit_events", "wedding_audit_events", "invitation_versions", "decisions",
      "wedding_documents", "media_assets", "wedding_party_members", "guest_table_assignments",
      "seating_tables", "venues", "expense_payments", "expenses", "budget_categories",
      "vendors", "rsvp_response_history", "rsvp_attendees", "rsvp_responses",
      "guest_invitations", "guests", "guest_groups", "wedding_events", "wedding_tasks",
      "wedding_members", "weddings", "profiles",
    ];
    for (const t of tables) {
      await client.query(`delete from public.${t}`);
    }
    await client.query(`delete from auth.users`);

    // users A, B, C
    const mk = async (email: string) => {
      const rows = await q(
        client,
        `insert into auth.users (email) values ($1) returning id`,
        [email],
      );
      const id = rows[0].id;
      await q(client, `insert into public.profiles (id, display_name) values ($1, $2)`, [
        id,
        email,
      ]);
      return id as string;
    };
    A = await mk("a@test.dev");
    B = await mk("b@test.dev");
    C = await mk("c@test.dev");

    // wedding owned by A with co-planner B
    W = (
      await q(
        client,
        `insert into public.weddings (owner_id, bride_name, groom_name, wedding_date, date_status, rsvp_deadline)
         values ($1, 'Maria', 'Juan', current_date + 120, 'tentative', current_date + 60) returning id`,
        [A],
      )
    )[0].id as string;

    await q(
      client,
      `insert into public.wedding_members (wedding_id, user_id, email, role, status)
       values ($1, $2, 'b@test.dev', 'co_planner', 'active')`,
      [W, B],
    );

    // guest group + guests + invitation
    GROUP = (
      await q(
        client,
        `insert into public.guest_groups (wedding_id, name, invited_pax, category, side)
         values ($1, 'The Reyes Family', 4, 'Bride''s family', 'bride') returning id`,
        [W],
      )
    )[0].id as string;

    GUEST1 = (
      await q(
        client,
        `insert into public.guests (wedding_id, group_id, first_name, last_name, is_primary_contact)
         values ($1, $2, 'Carmen', 'Reyes', true) returning id`,
        [W, GROUP],
      )
    )[0].id as string;
    GUEST2 = (
      await q(
        client,
        `insert into public.guests (wedding_id, group_id, first_name, last_name)
         values ($1, $2, 'Marco', 'Reyes') returning id`,
        [W, GROUP],
      )
    )[0].id as string;

    // token: generate like the app does (raw token only exists here)
    TOKEN = "vp_" + require("crypto").randomBytes(24).toString("base64url");
    const hash = require("crypto").createHash("sha256").update(TOKEN).digest("hex");
    INV = (
      await q(
        client,
        `insert into public.guest_invitations (wedding_id, group_id, token_hash, token_ciphertext, max_pax, greeting_name, status)
         values ($1, $2, $3, 'cipher', 4, 'The Reyes Family', 'ready') returning id`,
        [W, GROUP, hash],
      )
    )[0].id as string;
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await pool.end();
});

describe("workspace membership RLS", () => {
  it("owner sees own wedding; co-planner sees it; outsider does not", async () => {
    const c = await pool.connect();
    try {
      const owner = await asUser(c, A, `select id from public.weddings where id = $1`, [W]);
      expect(owner.rows).toHaveLength(1);
      const cop = await asUser(c, B, `select id from public.weddings where id = $1`, [W]);
      expect(cop.rows).toHaveLength(1);
      const out = await asUser(c, C, `select id from public.weddings where id = $1`, [W]);
      expect(out.rows).toHaveLength(0);
    } finally {
      c.release();
    }
  });

  it("outsider cannot read guests, invitations, RSVPs, or budget", async () => {
    const c = await pool.connect();
    try {
      for (const [table, col] of [
        ["guests", "id"],
        ["guest_invitations", "id"],
        ["rsvp_responses", "id"],
        ["expenses", "id"],
        ["vendors", "id"],
        ["wedding_tasks", "id"],
      ] as const) {
        const r = await asUser(c, C, `select ${col} from public.${table}`);
        expect(r.rows, table).toHaveLength(0);
      }
    } finally {
      c.release();
    }
  });

  it("anonymous role cannot read any private table", async () => {
    const c = await pool.connect();
    try {
      const tables = [
        "profiles", "weddings", "wedding_members", "wedding_tasks", "wedding_events",
        "guest_groups", "guests", "guest_invitations", "rsvp_responses", "rsvp_attendees",
        "rsvp_response_history", "budget_categories", "vendors", "expenses",
        "expense_payments", "venues", "seating_tables", "guest_table_assignments",
        "wedding_party_members", "media_assets", "wedding_documents", "decisions",
        "invitation_versions", "wedding_audit_events", "rate_limit_events",
      ];
      for (const t of tables) {
        const r = await asAnon(c, `select count(*)::int as n from public.${t}`);
        // Either permission denied or RLS-filtered to zero rows — both secure.
        expect(r.rows[0]?.n ?? 0, `${t} leaked rows to anon`).toBe(0);
      }
    } finally {
      c.release();
    }
  });

  it("only the owner can add members; co-planner cannot", async () => {
    const c = await pool.connect();
    try {
      const byCop = await asUser(
        c,
        B,
        `insert into public.wedding_members (wedding_id, email, role, status)
         values ($1, 'x@test.dev', 'viewer', 'invited') returning id`,
        [W],
      );
      expect(byCop.error ?? "").toContain("new row violates row-level security");

      const byOwner = await asUser(
        c,
        A,
        `insert into public.wedding_members (wedding_id, email, role, status)
         values ($1, 'x@test.dev', 'viewer', 'invited') returning id`,
        [W],
      );
      expect(byOwner.rows).toHaveLength(1);
    } finally {
      c.release();
    }
  });
});

describe("invitation token security", () => {
  it("get_invitation_view returns sanitized data, no other guests or internal notes", async () => {
    const c = await pool.connect();
    try {
      const r = await asAnon(c, `select public.get_invitation_view($1) as v`, [TOKEN]);
      const v = r.rows[0].v;
      expect(v).not.toBeNull();
      expect(v.wedding.brideName).toBe("Maria");
      expect(v.invitation.maxPax).toBe(4);
      expect(v.group.inviteeNames.map((g: any) => g.displayName)).toEqual([
        "Carmen Reyes",
        "Marco Reyes",
      ]);
      // must not leak internal columns
      expect(JSON.stringify(v)).not.toContain("internal_notes");
      expect(JSON.stringify(v)).not.toContain("internalNotes");
      expect(JSON.stringify(v)).not.toContain(GUEST1);
      expect(JSON.stringify(v)).not.toContain("totalBudget");
    } finally {
      c.release();
    }
  });

  it("invalid token returns null; revoked token returns error code", async () => {
    const c = await pool.connect();
    try {
      const bad = await asAnon(c, `select public.get_invitation_view($1) as v`, ["vp_nope"]);
      expect(bad.rows[0].v).toBeNull();

      await q(c, `update public.guest_invitations set token_revoked_at = now() where id = $1`, [INV]);
      const rev = await asAnon(c, `select public.get_invitation_view($1) as v`, [TOKEN]);
      expect(rev.rows[0].v.error).toBe("revoked");
    } finally {
      c.release();
    }
  });

  it("submit_rsvp enforces the PAX cap", async () => {
    const c = await pool.connect();
    try {
      const tooMany = await asAnon(
        c,
        `select public.submit_rsvp($1, $2) as r`,
        [TOKEN, JSON.stringify({ status: "confirmed", attendingCount: 5 })],
      );
      expect(tooMany.rows[0].r.ok).toBe(false);
      expect(tooMany.rows[0].r.code).toBe("pax_exceeded");

      const ok = await asAnon(
        c,
        `select public.submit_rsvp($1, $2) as r`,
        [TOKEN, JSON.stringify({ status: "confirmed", attendingCount: 4, messageToCouple: "Yehey!" })],
      );
      expect(ok.rows[0].r.ok).toBe(true);
      expect(ok.rows[0].r.attendingCount).toBe(4);

      // RSVP visible in planner and status propagated
      const planner = await asUser(c, A, `select status, attending_count from public.rsvp_responses where invitation_id = $1`, [INV]);
      expect(planner.rows[0].status).toBe("confirmed");
      expect(planner.rows[0].attending_count).toBe(4);
      const invStatus = await asUser(c, A, `select status from public.guest_invitations where id = $1`, [INV]);
      expect(invStatus.rows[0].status).toBe("confirmed");
    } finally {
      c.release();
    }
  });

  it("declining forces attending count to zero", async () => {
    const c = await pool.connect();
    try {
      const r = await asAnon(c, `select public.submit_rsvp($1, $2) as r`, [
        TOKEN,
        JSON.stringify({ status: "declined", attendingCount: 2 }),
      ]);
      expect(r.rows[0].r.ok).toBe(true);
      expect(r.rows[0].r.attendingCount).toBe(0);
    } finally {
      c.release();
    }
  });

  it("updates create audit history and stay within cap", async () => {
    const c = await pool.connect();
    try {
      await asAnon(c, `select public.submit_rsvp($1, $2) as r`, [
        TOKEN,
        JSON.stringify({ status: "confirmed", attendingCount: 2 }),
      ]);
      const upd = await asAnon(c, `select public.submit_rsvp($1, $2) as r`, [
        TOKEN,
        JSON.stringify({ status: "confirmed", attendingCount: 3 }),
      ]);
      expect(upd.rows[0].r.ok).toBe(true);

      const hist = (
        await asUser(
          c,
          A,
          `select change_type, snapshot from public.rsvp_response_history where invitation_id = $1 order by changed_at`,
          [INV],
        )
      ).rows;
      expect(hist.map((h: any) => h.change_type)).toEqual(["created", "updated"]);
      expect(hist[1].snapshot.attendingCount).toBe(2); // previous value preserved
    } finally {
      c.release();
    }
  });

  it("RSVP after deadline is rejected for guests but planner can still edit", async () => {
    const c = await pool.connect();
    try {
      await q(c, `update public.weddings set rsvp_deadline = current_date - 1 where id = $1`, [W]);

      const first = await asAnon(c, `select public.submit_rsvp($1, $2) as r`, [
        TOKEN,
        JSON.stringify({ status: "confirmed", attendingCount: 2 }),
      ]);
      expect(first.rows[0].r.code).toBe("closed");

      // planner-side administrative correction works through RLS
      const admin = await asUser(
        c,
        A,
        `insert into public.rsvp_responses (wedding_id, invitation_id, group_id, status, attending_count, edited_after_deadline)
         values ($1, $2, $3, 'confirmed', 4, true) returning id`,
        [W, INV, GROUP],
      );
      expect(admin.rows).toHaveLength(1);
    } finally {
      c.release();
    }
  });

  it("closed RSVP settings block new submissions", async () => {
    const c = await pool.connect();
    try {
      await q(c, `update public.weddings set rsvp_settings = '{"closed": true}'::jsonb where id = $1`, [W]);
      const r = await asAnon(c, `select public.submit_rsvp($1, $2) as r`, [
        TOKEN,
        JSON.stringify({ status: "confirmed", attendingCount: 1 }),
      ]);
      expect(r.rows[0].r.code).toBe("closed");
    } finally {
      c.release();
    }
  });

  it("rate limiter allows up to the cap then blocks", async () => {
    const c = await pool.connect();
    try {
      let allowed = 0;
      for (let i = 0; i < 6; i++) {
        const r = await asAnon(c, `select public.check_rate_limit($1, 3, 3600) as ok`, ["ip:1.2.3.4:invite"]);
        if (r.rows[0].ok) allowed++;
      }
      expect(allowed).toBe(3);
      // independent key is unaffected
      const other = await asAnon(c, `select public.check_rate_limit($1, 3, 3600) as ok`, ["ip:5.6.7.8:invite"]);
      expect(other.rows[0].ok).toBe(true);
    } finally {
      c.release();
    }
  });

  it("public wedding details only include explicitly public venues/schedule", async () => {
    const c = await pool.connect();
    try {
      await q(
        c,
        `insert into public.venues (wedding_id, name, role, address, is_public) values
         ($1, 'San Iglesia Church', 'ceremony', '12 Church St', true),
         ($1, 'Secret Garden', 'reception', 'Hidden Rd', false)`,
        [W],
      );
      await q(
        c,
        `insert into public.wedding_events (wedding_id, title, event_type, start_time, is_public)
         values ($1, 'Ceremony', 'wedding_day', '15:00', true),
                ($1, 'Private family meeting', 'wedding_day', '09:00', false)`,
        [W],
      );
      const r = await asAnon(c, `select public.get_public_wedding_details($1) as v`, [TOKEN]);
      const s = JSON.stringify(r.rows[0].v);
      expect(s).toContain("San Iglesia Church");
      expect(s).not.toContain("Secret Garden");
      expect(s).toContain("Ceremony");
      expect(s).not.toContain("Private family meeting");
    } finally {
      c.release();
    }
  });
});
