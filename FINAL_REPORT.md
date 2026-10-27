# VowPlan — Build & Deployment Verification Report

**Date:** 2026-10-27 · **Stack:** Next.js 15.5.28 (App Router), TypeScript strict, Tailwind v4, Radix-based UI, Supabase (Auth/Postgres/Storage/RLS), Vercel.

**Live production URL: https://vowplan-vert.vercel.app**
**Repository: https://github.com/adondriano/vowplan** (private; secrets excluded via .gitignore)

Every claim below was executed and observed in this session. No secret values appear in this report.

---

## 1. Supabase — connected, provisioned, verified

The original "Wedding" project from the earlier session no longer exists under the connected account (the connector now resolves to a different org). Instead of retrying the dead project, a fresh project was created and fully provisioned:

| Step | Result |
|---|---|
| `create_project` (org `vvumwstsaaygeskxpkar`, region ap-southeast-1, plan free) | **ACTIVE** — ref `vaehzxabvjbwyvqeuunj` |
| Migration `20261027000001_vowplan_init.sql` applied via psql pooler (exact file, `ON_ERROR_STOP=1`) | **exit 0** |
| Verification queries | 25 tables · 95 public RLS policies · 5 storage policies · all 7 RPCs (`get_invitation_view`, `get_public_wedding_details`, `submit_rsvp`, `is_invitation_published`, `check_rate_limit`, `is_wedding_member`, `wedding_role`) · buckets `wedding-media` + `invitation-public` · 20 triggers · RLS enabled on `weddings` |
| Auth config | `mailer_autoconfirm` set to `true` (email/password signup works immediately without an SMTP provider) |
| Keys | anon key installed into Vercel env; service-role key was used only for two admin uploads/deletes over HTTPS and is **not** stored anywhere in the repo or report |

### Two production-only bugs found & fixed (both were invisible locally)
1. **`search_path` missing `extensions`** — on Supabase cloud, `pgcrypto` lives in the `extensions` schema, but the three token-hashing RPCs pinned `search_path = public` (locally pgcrypto installs into `public`, so tests passed). Error: `function digest(text, unknown) does not exist`. Fixed in the migration (`search_path = public, extensions`, which is a no-op locally) and hot-applied to the live DB.
2. **`submit_rsvp` attendee insert type error** — the `guest_id` CASE expression had two untyped `NULL` branches, which Postgres resolves as `text`, so *any* RSVP with attendees failed with `42804`. Fixed with an explicit `null::uuid` + uuid-regex guard, hot-applied to cloud and local.
3. **Workspace creation RLS violation** (reported by the user on first use) — the app inserts weddings with PostgREST `.select()`, i.e. `INSERT … RETURNING`; with column refs, Postgres requires the new row to pass the **SELECT** policy inside the same command, where the `is_wedding_member(id)` same-table subquery cannot yet see the just-inserted row → `new row violates row-level security policy`. Fix: `weddings_select` now `using (is_wedding_member(id) or owner_id = auth.uid())` (row-local, semantically identical). Verified by emulating the entire creation flow as the authenticated role on the production DB (wedding RETURNING + member + categories + tasks + events + owner visibility all pass); local suite re-verified 51/51. Live on the production DB — no redeploy needed.
4. **Reports & Export page 500** (reported by the user) — `reports-view.tsx` was a Server Component carrying an `onClick` handler; RSC cannot serialize event handlers, and because the page is `force-dynamic` the build never catches it — it only throws at request time. Fix: `"use client"` on the component. Reproduced on production with a real session (HTTP 500), fixed, redeployed, re-verified: `/reports` returns 200 with rendered content and **all 16 planner pages now return 200** with a real authenticated session. Added two regression guards: an RSC static scanner test (any `.tsx` using event handlers must declare `"use client"`) and an SSR smoke render of the reports tree — suite now **53/53**.

## 2. Vercel — deployed and live

| Step | Result |
|---|---|
| Project `vowplan` created on team-elite (`prj_jXptn4ITp9sqiDdNf8HGlM9miZcT`) | ✓ |
| Env vars set for production/preview/development | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (plain), `APP_ENCRYPTION_KEY` (sensitive) |
| First deploy attempt | **Blocked by Vercel**: "Vulnerable version of Next.js detected" (15.5.6) |
| Fix | Upgraded to **Next 15.5.28** (the patched `backport` dist-tag line) + eslint-config-next 15.5.28; also moved `getEncryptionKey` out of `config.ts` into a Node-only server module to eliminate the `crypto`-in-Edge-Runtime warning from the middleware bundle |
| Local gates after upgrade | `tsc` 0 errors · **51/51 tests** (13 RLS + 22 PAX + 16 units) · `next build` exit 0, no warnings |
| Production deploy (Vercel CLI, token provided by user) | **READY & PROMOTED in 1m** — `dpl_AFY1uwGHJjUv1x3EGVsBx9Vy254Q`, aliased to `vowplan-vert.vercel.app` |

## 3. Live end-to-end verification (all against production, unauthenticated)

| Check | Result |
|---|---|
| `GET /` | 200 — landing renders (VowPlan, static assets) |
| `GET /login`, `/signup` | 200 |
| `GET /app` | **307 → `/login?next=%2Fapp`** — auth middleware working in production |
| `GET /invite/vp_<bogus>` | 200 — renders the invalid-link page; `POST /api/invite/<bogus>/rsvp` → `{"ok":false,"code":"invalid_token"}` |
| Seeded a real wedding + published invitation + public venue/event on the cloud DB, then `GET /invite/vp_e2e…` | Live HTML contains the couple names, greeting, and invitation message |
| `GET /api/invite/<real-token>/details` | Returns exactly the 1 public venue + 1 public event (private ones excluded) |
| `POST /api/invite/<real-token>/rsvp` (2 attending, meal, message) | **`{"ok":true,"status":"confirmed","attendingCount":2}`** — DB row verified: status `confirmed`, 2 `rsvp_attendees` rows, 2 `rsvp_response_history` audit rows |
| PAX cap | Sending `attendingCount: 9` against `max_pax: 4` → **`{"ok":false,"code":"pax_exceeded","maxPax":4}`** |
| Public `/invite` accessibility | Production URLs serve without any login wall (preview URLs remain protected by default Vercel settings) |

## 4. Cleanup (all verified)

- E2E test wedding + user deleted → `select count(*) from weddings` = **0** (cascade removed all child rows)
- Source tarball staged during deploy troubleshooting deleted from `invitation-public` bucket (public URL now 400)
- All 5 probe/error deployments deleted; only the live production deployment remains
- Local sandbox DB re-provisioned and 51/51 tests re-verified against the fixed migration

## 5. Security notes

- Only the **anon** key is exposed to browsers (RLS applies); the service-role key was used server-side over HTTPS for two administrative operations and never persisted.
- `APP_ENCRYPTION_KEY` (32-byte hex, freshly generated) is stored as a **sensitive** Vercel variable; it encrypts invitation tokens at rest (AES-256-GCM).
- `.env.example` contains placeholders only; the workspace `.env.local` used for local dev is gitignored.
- **Action for you:** the Vercel token pasted in chat was used for the deploys above — please revoke it at vercel.com → Account Settings → Tokens now that deployment is done. The Supabase DB password is only known to this session and the Supabase dashboard (reset it there anytime).

## 6. Remaining to do (product decisions, not blockers)

1. **SMTP for invitations** — RSVP confirmation/invite emails are not sent (no provider configured). Token links are copy/QR based, which works today.
2. Custom domain + Supabase Site URL/redirect allow-list update when you attach one (auth redirect currently points at the vercel.app URL).
3. Rate-limit tuning: current guest cap is 12 RSVP submissions/hour/IP — generous for households, tighten or loosen per real traffic.
4. Optionally connect a Git repo to the Vercel project so future deploys run from pushes instead of the CLI.
