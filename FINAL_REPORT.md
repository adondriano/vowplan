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

## Post-launch: mobile responsiveness + performance (commit b64e7d9)

**Mobile**
- Audit of every page shell, dialog, table, and grid at 375px viewport: layout system was already fluid (sidebar collapses to a sticky top bar + slide-in drawer at <lg, tables scroll horizontally, dialogs fit `100vw - 2rem`).
- Root cause of the "off" feel on phones: iOS Safari force-zooms the viewport when focusing any input with font-size < 16px (page appears to jump). Fixed globally — 16px floor for `input/select/textarea` on ≤640px screens — plus larger `text-base` inputs on the RSVP form.

**Performance**
- Serverless functions moved from `iad1` (Virginia) to `sin1` (Singapore), colocated with the Supabase `ap-southeast-1` database. Every dynamic page previously paid ~200 ms per DB query across the Pacific; for Philippine visitors the function itself was also ~250 ms RTT away. Functions and DB now sit in the same metro.
- Budget charts split into `budget-charts.tsx` and lazy-loaded via `next/dynamic` (`ssr: false`): `/budget` route JS **132 kB → 15.4 kB**; page First Load **287 kB → 172 kB**.
- `next.config.ts`: `experimental.optimizePackageImports` for `lucide-react` and `recharts`.
- Static/shared JS unchanged and lean (103 kB shared First Load); fonts self-hosted via `next/font`.

**Verification**: tsc 0 errors · vitest 53/53 · build exit 0 · deploy `dpl_3Z1zz6rms2W4f4GUL6aZYkiCnTX5` READY with `regions: ["sin1"]`, aliased to https://vowplan-vert.vercel.app · iPhone-UA smoke: `/`, `/login`, `/signup`, `/invite/*` all 200 · pushed to GitHub `main`.

### Follow-up: real mobile screenshot caught the actual layout bug (commit to follow)

The initial mobile audit (code review) missed a structural bug that only showed on a real
phone: the wedding layout used `<div className="flex min-h-dvh">` (a **row**), and the
sidebar component renders its mobile top bar (`lg:hidden`) as a **flex child** of that row.
On phones the bar therefore became a tall empty column on the left, squeezing the whole
dashboard into the remaining ~40% of the screen. Desktop was unaffected because `lg:hidden`
removes the bar from the row. Fix: `flex min-h-dvh flex-col lg:flex-row` — bar stacks on top
on mobile, reverts to sidebar row at `lg`. Verified with headless Chromium at 390×844
against production: 0 px horizontal overflow, top bar 390×61 px pinned at the top,
stat cards full-width (screenshot: dashboard-mobile-after.png).

## Collaborator invite emails + brand favicon

**Email invitations (Supabase Auth built-in mailer — no third-party account needed)**
- `inviteMember` now calls `inviteUserByEmail` server-side via a new service-role admin client
  (`src/lib/server/supabase-admin.ts`; key stored as `SUPABASE_SERVICE_ROLE_KEY`, server-only, never bundled).
- Toast reflects the real outcome: "Invitation email sent" / already-registered note / fallback note.
- Supabase auth `site_url` fixed (was `http://localhost:3000`!) → `https://vowplan-vert.vercel.app`, redirect allow-list added.
- `/auth/callback` now completes both PKCE (`?code=`) and implicit (`#access_token=`) email links
  (new client page `/auth/client-callback`), then lands on `/app` where the invite banner waits.
- Invited accounts are created passwordless: `/app` shows a "Finish setting up your account" card
  (detected via `invited_at` + `password_set` metadata) and a full forgot-password flow exists
  (`/reset-password` → email → `/account/password`); login page links to it.
- RLS fix: invited member rows (`user_id` null) were invisible/unacceptable under the old policies —
  `members_select`/`members_update` now also match `status='invited' and email = auth.email()`
  (applied to migration + local + cloud).
- **E2E proven live**: real email received from Supabase → link clicked in a fresh browser → signed in →
  invite banner shown → password set → re-login with email+password works. Test data wiped after.

**Favicon / brand icon**
- Replaced the default Vercel icon: `src/app/icon.svg`, `favicon.ico` (16/32/48), `apple-icon.png`
  — white heart on the VowPlan plum (#9D2C4E). Live and byte-verified.

Env additions on Vercel: `SUPABASE_SERVICE_ROLE_KEY` (sensitive), `NEXT_PUBLIC_SITE_URL`.
Note: members invited BEFORE this change (status `invited`) have no email queued — remove and re-invite
them from Settings → Collaborators to send the email.

### Fix: accepting a collaborator invite failed silently

Reported live: invite email received, password set — but "Accept invite" did nothing
(no wedding in the list, no navigation). Reproduced with a headless browser and traced:

1. **Root cause (DB)**: `wedding_members.user_id` has a FK to `profiles.id`, but invited
   accounts never go through onboarding, so they have no profile row → the accept UPDATE
   died with FK violation 23503.
2. **Masking (action)**: `acceptWorkspaceInvite` collapsed every error into "No pending
   invitation found for this email."
3. **Swallowed result (client)**: `AcceptInviteButtons` ignored the action result and
   navigated anyway, leaving the user on a stale `/app`.

Fixes: the action upserts the caller's profile before accepting (and surfaces the real
error); the client shows success/error toasts and only navigates on success.
E2E re-verified live: accept → member row `active` + `user_id` linked + profile created →
redirect to the wedding dashboard (screenshot accepted-dashboard.png). Test data wiped.
