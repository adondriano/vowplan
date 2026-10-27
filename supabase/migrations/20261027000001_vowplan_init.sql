-- ===========================================================================
-- VowPlan initial schema
-- Wedding planner: workspaces, members, tasks, timeline, guests, invitations,
-- RSVPs, budget, vendors, venues, seating, wedding party, media, documents,
-- decisions, invitation versions, audit events, rate limiting.
--
-- Security model:
--   * Anonymous (guest) access is ONLY through narrowly-scoped SECURITY DEFINER
--     RPCs: get_invitation_view(), submit_rsvp(), check_rate_limit().
--   * No anon SELECT/INSERT policies exist on any private table.
--   * All private tables use RLS with workspace-membership checks.
--   * Invitation tokens: only SHA-256 hashes + AES-GCM ciphertext are stored.
--
-- This migration is idempotent and runs on both Supabase (where the `auth`
-- schema and roles already exist) and a plain local Postgres used for tests
-- (where minimal mocks of `auth` are created).
-- ===========================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Local/test bootstrap: emulate the Supabase environment when it is absent.
-- On Supabase this block does nothing beyond creating missing pieces it
-- already ships (guarded by existence checks).
-- ---------------------------------------------------------------------------

do $do$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      encrypted_password text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$create function auth.uid() returns uuid language sql stable as $body$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $body$;$fn$;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $do$;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_currency text not null default 'PHP',
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- weddings
-- ---------------------------------------------------------------------------

create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  bride_name text not null default '',
  groom_name text not null default '',
  partner1_label text not null default 'Bride',
  partner2_label text not null default 'Groom',
  wedding_date date,
  date_status text not null default 'undecided'
    check (date_status in ('tentative', 'confirmed', 'undecided')),
  location text,
  currency text not null default 'PHP',
  guest_count_estimate int,
  total_budget numeric(14,2),
  contingency_pct numeric(5,2) not null default 10,
  rsvp_deadline date,
  planning_status text not null default 'planning'
    check (planning_status in ('planning', 'completed', 'archived')),
  wedding_style text,
  rsvp_settings jsonb not null default '{}'::jsonb,
  invitation_config jsonb not null default '{}'::jsonb,
  invitation_published boolean not null default false,
  public_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_weddings_owner on public.weddings(owner_id);

drop trigger if exists trg_weddings_updated on public.weddings;
create trigger trg_weddings_updated before update on public.weddings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wedding_members
-- ---------------------------------------------------------------------------

create table if not exists public.wedding_members (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  email text not null,
  role text not null default 'co_planner' check (role in ('owner', 'co_planner', 'viewer')),
  status text not null default 'invited' check (status in ('active', 'invited', 'declined')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_members_wedding on public.wedding_members(wedding_id);
create index if not exists idx_members_user on public.wedding_members(user_id);
create unique index if not exists uq_members_wedding_email
  on public.wedding_members(wedding_id, lower(email));

drop trigger if exists trg_members_updated on public.wedding_members;
create trigger trg_members_updated before update on public.wedding_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wedding_tasks
-- ---------------------------------------------------------------------------

create table if not exists public.wedding_tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'other',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  due_date date,
  completed_at timestamptz,
  assignee text,
  depends_on_task_id uuid references public.wedding_tasks(id) on delete set null,
  relative_days int, -- days before the wedding date; used by date rules
  notes text,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_wedding on public.wedding_tasks(wedding_id, status);
create index if not exists idx_tasks_due on public.wedding_tasks(wedding_id, due_date);

drop trigger if exists trg_tasks_updated on public.wedding_tasks;
create trigger trg_tasks_updated before update on public.wedding_tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- vendors (before wedding_events which may reference them)
-- ---------------------------------------------------------------------------

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  contact_person text,
  phone text,
  email text,
  website text,
  address text,
  social_link text,
  quoted_price numeric(14,2),
  contracted_price numeric(14,2),
  booking_status text not null default 'considering'
    check (booking_status in ('considering', 'contacted', 'quoted', 'booked', 'declined', 'completed')),
  rating int check (rating between 1 and 5),
  meeting_date date,
  payment_terms text,
  includes_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vendors_wedding on public.vendors(wedding_id);
create index if not exists idx_vendors_status on public.vendors(wedding_id, booking_status);

drop trigger if exists trg_vendors_updated on public.vendors;
create trigger trg_vendors_updated before update on public.vendors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wedding_events (planning milestones + wedding-day schedule)
-- ---------------------------------------------------------------------------

create table if not exists public.wedding_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  event_type text not null default 'wedding_day'
    check (event_type in ('planning_milestone', 'wedding_day')),
  event_date date,
  start_time time,
  end_time time,
  location text,
  description text,
  coordinator text,
  vendor_id uuid references public.vendors(id) on delete set null,
  sort_order int not null default 0,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_events_wedding on public.wedding_events(wedding_id, event_type, event_date);

drop trigger if exists trg_events_updated on public.wedding_events;
create trigger trg_events_updated before update on public.wedding_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- guest_groups (households / invitation groups)
-- ---------------------------------------------------------------------------

create table if not exists public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  side text not null default 'both' check (side in ('bride', 'groom', 'both', 'custom')),
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  invited_pax int not null default 2 check (invited_pax >= 1),
  plus_one_allowed boolean not null default false,
  invitation_type text not null default 'household' check (invitation_type in ('household', 'individual')),
  internal_notes text,
  rsvp_deadline_override date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_groups_wedding on public.guest_groups(wedding_id);

drop trigger if exists trg_groups_updated on public.guest_groups;
create trigger trg_groups_updated before update on public.guest_groups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- guests (individual people)
-- ---------------------------------------------------------------------------

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete set null,
  first_name text not null,
  last_name text,
  display_name text,
  email text,
  phone text,
  relationship text,
  category text,
  side text not null default 'both' check (side in ('bride', 'groom', 'both', 'custom')),
  is_primary_contact boolean not null default false,
  meal_preference text,
  dietary_notes text,
  accessibility_notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_guests_wedding on public.guests(wedding_id);
create index if not exists idx_guests_group on public.guests(group_id);

drop trigger if exists trg_guests_updated on public.guests;
create trigger trg_guests_updated before update on public.guests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- guest_invitations
--   One invitation per guest group by default. The bearer token is stored as
--   SHA-256 hash (lookup) + AES-GCM ciphertext (planner re-display) — the
--   plaintext token never lives in the database.
-- ---------------------------------------------------------------------------

create table if not exists public.guest_invitations (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  group_id uuid not null references public.guest_groups(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'sent', 'pending', 'confirmed', 'declined', 'follow_up', 'cancelled')),
  token_hash text not null unique,
  token_ciphertext text not null,
  token_version int not null default 1,
  token_created_at timestamptz not null default now(),
  token_revoked_at timestamptz,
  issued_at timestamptz,
  sent_at timestamptz,
  max_pax int not null default 2 check (max_pax >= 1),
  expires_at timestamptz,
  last_contacted_at timestamptz,
  follow_up_notes text,
  greeting_name text, -- approved personalized greeting, e.g. "Alex & Family"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_invitations_wedding on public.guest_invitations(wedding_id);
create unique index if not exists uq_invitations_group on public.guest_invitations(group_id);

drop trigger if exists trg_invitations_updated on public.guest_invitations;
create trigger trg_invitations_updated before update on public.guest_invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- rsvp_responses (+ per-attendee responses + audit history)
-- ---------------------------------------------------------------------------

create table if not exists public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  invitation_id uuid not null references public.guest_invitations(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete set null,
  status text not null check (status in ('confirmed', 'declined')),
  attending_count int not null default 0 check (attending_count >= 0),
  meal_preferences text,
  dietary_notes text,
  accessibility_notes text,
  message_to_couple text,
  song_request text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_after_deadline boolean not null default false
);
create index if not exists idx_rsvp_wedding on public.rsvp_responses(wedding_id);
create unique index if not exists uq_rsvp_invitation on public.rsvp_responses(invitation_id);

drop trigger if exists trg_rsvp_updated on public.rsvp_responses;
create trigger trg_rsvp_updated before update on public.rsvp_responses
  for each row execute function public.set_updated_at();

create table if not exists public.rsvp_attendees (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.rsvp_responses(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  display_name text not null,
  attending boolean not null default true,
  meal_preference text
);
create index if not exists idx_rsvp_attendees_response on public.rsvp_attendees(response_id);

create table if not exists public.rsvp_response_history (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  response_id uuid references public.rsvp_responses(id) on delete cascade,
  invitation_id uuid,
  change_type text not null check (change_type in ('created', 'updated', 'admin_changed')),
  snapshot jsonb not null default '{}'::jsonb,
  changed_at timestamptz not null default now()
);
create index if not exists idx_rsvp_history_response on public.rsvp_response_history(response_id);

-- ---------------------------------------------------------------------------
-- budget: categories, expenses, payments
-- ---------------------------------------------------------------------------

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  budgeted_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, name)
);
create index if not exists idx_budget_categories_wedding on public.budget_categories(wedding_id);

drop trigger if exists trg_budget_categories_updated on public.budget_categories;
create trigger trg_budget_categories_updated before update on public.budget_categories
  for each row execute function public.set_updated_at();

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  category_id uuid references public.budget_categories(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  estimated_amount numeric(14,2) not null default 0,
  quoted_amount numeric(14,2),
  contracted_amount numeric(14,2),
  actual_amount numeric(14,2),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  currency text not null default 'PHP',
  conversion_rate numeric(12,6) not null default 1 check (conversion_rate > 0),
  due_date date,
  task_id uuid references public.wedding_tasks(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expenses_wedding on public.expenses(wedding_id);
create index if not exists idx_expenses_category on public.expenses(category_id);
create index if not exists idx_expenses_vendor on public.expenses(vendor_id);

drop trigger if exists trg_expenses_updated on public.expenses;
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();

create table if not exists public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  label text not null default 'Payment',
  amount numeric(14,2) not null check (amount >= 0),
  due_date date,
  status text not null default 'scheduled' check (status in ('scheduled', 'paid')),
  paid_at date,
  method text,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payments_expense on public.expense_payments(expense_id);
create index if not exists idx_payments_due on public.expense_payments(due_date);

drop trigger if exists trg_payments_updated on public.expense_payments;
create trigger trg_payments_updated before update on public.expense_payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  venue_type text,
  role text not null default 'reception' check (role in ('ceremony', 'reception', 'both', 'other')),
  address text,
  map_url text,
  contact_name text,
  contact_phone text,
  contact_email text,
  capacity int,
  booking_status text not null default 'considering'
    check (booking_status in ('considering', 'optioned', 'booked', 'declined')),
  rental_price numeric(14,2),
  facilities text not null default '',
  setup_start time,
  teardown_end time,
  restrictions text,
  parking_notes text,
  accessibility_notes text,
  transit_notes text,
  accommodation_notes text,
  vendor_id uuid references public.vendors(id) on delete set null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_venues_wedding on public.venues(wedding_id);

drop trigger if exists trg_venues_updated on public.venues;
create trigger trg_venues_updated before update on public.venues
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- seating
-- ---------------------------------------------------------------------------

create table if not exists public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  capacity int not null default 8 check (capacity >= 1),
  location text,
  shape text not null default 'round' check (shape in ('round', 'rectangular', 'oval', 'long')),
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seating_wedding on public.seating_tables(wedding_id);

drop trigger if exists trg_seating_updated on public.seating_tables;
create trigger trg_seating_updated before update on public.seating_tables
  for each row execute function public.set_updated_at();

create table if not exists public.guest_table_assignments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  table_id uuid references public.seating_tables(id) on delete cascade,
  seat_number int,
  is_tentative boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id)
);
create index if not exists idx_assignments_table on public.guest_table_assignments(table_id);

drop trigger if exists trg_assignments_updated on public.guest_table_assignments;
create trigger trg_assignments_updated before update on public.guest_table_assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wedding party
-- ---------------------------------------------------------------------------

create table if not exists public.wedding_party_members (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  role text not null default 'Bridesmaid',
  side text not null default 'both' check (side in ('bride', 'groom', 'both')),
  email text,
  phone text,
  attire_notes text,
  responsibilities text,
  rehearsal boolean not null default false,
  ceremony_position text,
  fitting_date date,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_party_wedding on public.wedding_party_members(wedding_id);

drop trigger if exists trg_party_updated on public.wedding_party_members;
create trigger trg_party_updated before update on public.wedding_party_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- media, documents, decisions, invitation versions, audit
-- ---------------------------------------------------------------------------

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  kind text not null default 'inspiration'
    check (kind in ('inspiration', 'invitation', 'gallery', 'cover', 'monogram', 'other')),
  title text,
  storage_path text not null,
  source_url text,
  source_note text,
  tags text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_media_wedding on public.media_assets(wedding_id, kind);

drop trigger if exists trg_media_updated on public.media_assets;
create trigger trg_media_updated before update on public.media_assets
  for each row execute function public.set_updated_at();

create table if not exists public.wedding_documents (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  doc_type text not null default 'other',
  storage_path text not null,
  file_size bigint,
  mime_type text,
  vendor_id uuid references public.vendors(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  task_id uuid references public.wedding_tasks(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_documents_wedding on public.wedding_documents(wedding_id);

drop trigger if exists trg_documents_updated on public.wedding_documents;
create trigger trg_documents_updated before update on public.wedding_documents
  for each row execute function public.set_updated_at();

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  description text,
  decision_date date default current_date,
  category text,
  responsible text,
  status text not null default 'proposed' check (status in ('proposed', 'decided', 'deferred', 'revisited')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_decisions_wedding on public.decisions(wedding_id);

drop trigger if exists trg_decisions_updated on public.decisions;
create trigger trg_decisions_updated before update on public.decisions
  for each row execute function public.set_updated_at();

create table if not exists public.invitation_versions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  version int not null,
  content jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (wedding_id, version)
);
create index if not exists idx_invitation_versions_wedding on public.invitation_versions(wedding_id, version desc);

create table if not exists public.wedding_audit_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_wedding on public.wedding_audit_events(wedding_id, created_at desc);

create table if not exists public.rate_limit_events (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);

-- Membership helpers (created after the tables they reference).
-- ---------------------------------------------------------------------------

-- True when the current user owns the wedding or is an active member.
create or replace function public.is_wedding_member(p_wedding_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.weddings w
    where w.id = p_wedding_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.wedding_members m
    where m.wedding_id = p_wedding_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- Returns 'owner' | 'co_planner' | 'viewer' | null.
create or replace function public.wedding_role(p_wedding_id uuid)
returns text language sql stable security definer
set search_path = public as $$
  select case
    when exists (select 1 from public.weddings w where w.id = p_wedding_id and w.owner_id = auth.uid())
      then 'owner'
    else (select m.role from public.wedding_members m
          where m.wedding_id = p_wedding_id and m.user_id = auth.uid() and m.status = 'active')
  end;
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles                enable row level security;
alter table public.weddings                enable row level security;
alter table public.wedding_members         enable row level security;
alter table public.wedding_tasks           enable row level security;
alter table public.wedding_events          enable row level security;
alter table public.guest_groups            enable row level security;
alter table public.guests                  enable row level security;
alter table public.guest_invitations       enable row level security;
alter table public.rsvp_responses          enable row level security;
alter table public.rsvp_attendees          enable row level security;
alter table public.rsvp_response_history   enable row level security;
alter table public.budget_categories       enable row level security;
alter table public.vendors                 enable row level security;
alter table public.expenses                enable row level security;
alter table public.expense_payments        enable row level security;
alter table public.venues                  enable row level security;
alter table public.seating_tables          enable row level security;
alter table public.guest_table_assignments enable row level security;
alter table public.wedding_party_members   enable row level security;
alter table public.media_assets            enable row level security;
alter table public.wedding_documents       enable row level security;
alter table public.decisions               enable row level security;
alter table public.invitation_versions     enable row level security;
alter table public.wedding_audit_events    enable row level security;
alter table public.rate_limit_events       enable row level security;

-- profiles: read own + profiles of people who share a wedding workspace.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.wedding_members me
      join public.wedding_members them on them.wedding_id = me.wedding_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
    or exists (
      select 1 from public.weddings w
      where w.owner_id = auth.uid() and w.owner_id = profiles.id
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- weddings
drop policy if exists weddings_select on public.weddings;
create policy weddings_select on public.weddings for select to authenticated
  -- owner_id clause is row-local: INSERT..RETURNING (PostgREST .select()) is
  -- evaluated within the insert command, where the is_wedding_member subquery
  -- cannot yet see the new row. The owner must match directly.
  using (public.is_wedding_member(id) or owner_id = auth.uid());

drop policy if exists weddings_insert on public.weddings;
create policy weddings_insert on public.weddings for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists weddings_update on public.weddings;
create policy weddings_update on public.weddings for update to authenticated
  using (public.wedding_role(id) in ('owner', 'co_planner'))
  with check (public.wedding_role(id) in ('owner', 'co_planner'));

drop policy if exists weddings_delete on public.weddings;
create policy weddings_delete on public.weddings for delete to authenticated
  using (owner_id = auth.uid());

-- wedding_members
drop policy if exists members_select on public.wedding_members;
create policy members_select on public.wedding_members for select to authenticated
  using (public.is_wedding_member(wedding_id) or user_id = auth.uid());

drop policy if exists members_insert on public.wedding_members;
create policy members_insert on public.wedding_members for insert to authenticated
  with check (public.wedding_role(wedding_id) = 'owner');

drop policy if exists members_update on public.wedding_members;
create policy members_update on public.wedding_members for update to authenticated
  using (public.wedding_role(wedding_id) = 'owner' or user_id = auth.uid())
  with check (public.wedding_role(wedding_id) = 'owner' or user_id = auth.uid());

drop policy if exists members_delete on public.wedding_members;
create policy members_delete on public.wedding_members for delete to authenticated
  using (public.wedding_role(wedding_id) = 'owner' or user_id = auth.uid());

-- Generic member policy generator for the workspace-owned tables.
do $$
declare
  t text;
  plain_tables text[] := array[
    'wedding_tasks', 'wedding_events', 'guest_groups', 'guests', 'guest_invitations',
    'rsvp_responses', 'rsvp_response_history', 'budget_categories',
    'vendors', 'expenses', 'venues', 'seating_tables',
    'guest_table_assignments', 'wedding_party_members', 'media_assets',
    'wedding_documents', 'decisions', 'invitation_versions', 'wedding_audit_events'
  ];
begin
  foreach t in array plain_tables loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated
      using (public.is_wedding_member(wedding_id))', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated
      with check (public.is_wedding_member(wedding_id))', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated
      using (public.is_wedding_member(wedding_id))
      with check (public.is_wedding_member(wedding_id))', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated
      using (public.is_wedding_member(wedding_id))', t, t);
  end loop;
end $$;

-- rsvp_attendees: access via the parent RSVP response's wedding.
drop policy if exists rsvp_attendees_select on public.rsvp_attendees;
create policy rsvp_attendees_select on public.rsvp_attendees for select to authenticated
  using (exists (
    select 1 from public.rsvp_responses r
    where r.id = rsvp_attendees.response_id and public.is_wedding_member(r.wedding_id)));

drop policy if exists rsvp_attendees_insert on public.rsvp_attendees;
create policy rsvp_attendees_insert on public.rsvp_attendees for insert to authenticated
  with check (exists (
    select 1 from public.rsvp_responses r
    where r.id = rsvp_attendees.response_id and public.is_wedding_member(r.wedding_id)));

drop policy if exists rsvp_attendees_update on public.rsvp_attendees;
create policy rsvp_attendees_update on public.rsvp_attendees for update to authenticated
  using (exists (
    select 1 from public.rsvp_responses r
    where r.id = rsvp_attendees.response_id and public.is_wedding_member(r.wedding_id)))
  with check (exists (
    select 1 from public.rsvp_responses r
    where r.id = rsvp_attendees.response_id and public.is_wedding_member(r.wedding_id)));

drop policy if exists rsvp_attendees_delete on public.rsvp_attendees;
create policy rsvp_attendees_delete on public.rsvp_attendees for delete to authenticated
  using (exists (
    select 1 from public.rsvp_responses r
    where r.id = rsvp_attendees.response_id and public.is_wedding_member(r.wedding_id)));

-- rate_limit_events: no policies on purpose; only touched by SECURITY DEFINER RPC.

-- expense_payments: access via the parent expense's wedding.
drop policy if exists expense_payments_select on public.expense_payments;
create policy expense_payments_select on public.expense_payments for select to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_payments.expense_id and public.is_wedding_member(e.wedding_id)));

drop policy if exists expense_payments_insert on public.expense_payments;
create policy expense_payments_insert on public.expense_payments for insert to authenticated
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_payments.expense_id and public.is_wedding_member(e.wedding_id)));

drop policy if exists expense_payments_update on public.expense_payments;
create policy expense_payments_update on public.expense_payments for update to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_payments.expense_id and public.is_wedding_member(e.wedding_id)))
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_payments.expense_id and public.is_wedding_member(e.wedding_id)));

drop policy if exists expense_payments_delete on public.expense_payments;
create policy expense_payments_delete on public.expense_payments for delete to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_payments.expense_id and public.is_wedding_member(e.wedding_id)));

-- Function hardening: functions default to PUBLIC execute; revoke broadly,
-- re-grant only what each surface needs.
do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args, n.nspname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function public.%I(%s) from public', r.proname, r.args);
    execute format('revoke execute on function public.%I(%s) from anon', r.proname, r.args);
  end loop;
end $$;

grant execute on function public.is_wedding_member(uuid) to authenticated;
grant execute on function public.wedding_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public (guest) RPCs — SECURITY DEFINER, narrowly scoped. These are the ONLY
-- anonymous surface into wedding data.
-- ---------------------------------------------------------------------------

-- Rate limiting: atomic sliding-window counter. Returns true when allowed.
create or replace function public.check_rate_limit(
  p_key text, p_max int, p_window_seconds int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := date_trunc('second', now())
    - make_interval(secs => (extract(epoch from now())::int % p_window_seconds));
  v_count int;
begin
  delete from public.rate_limit_events where window_start < now() - make_interval(hours => 2);

  insert into public.rate_limit_events (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
  do update set count = public.rate_limit_events.count + 1
  returning count into v_count;

  return v_count <= p_max;
end $$;

grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;

-- True when the wedding currently has a published invitation. Lets public
-- image routes authorize gallery/cover asset requests without exposing rows.
create or replace function public.is_invitation_published(p_wedding_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.weddings w
    where w.id = p_wedding_id and w.invitation_published = true
  );
$$;

grant execute on function public.is_invitation_published(uuid) to anon, authenticated;

-- Resolve an invitation token into the sanitized public invitation view.
create or replace function public.get_invitation_view(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text := encode(digest(p_token, 'sha256'), 'hex');
  v_inv public.guest_invitations%rowtype;
  v_wed public.weddings%rowtype;
  v_grp public.guest_groups%rowtype;
  v_response public.rsvp_responses%rowtype;
  v_version public.invitation_versions%rowtype;
  v_guests jsonb;
  v_out jsonb;
begin
  select * into v_inv from public.guest_invitations
    where token_hash = v_hash for update;

  if not found then
    return null; -- invalid token
  end if;

  if v_inv.status = 'cancelled' or v_inv.token_revoked_at is not null then
    return jsonb_build_object('error', 'revoked');
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  select * into v_wed from public.weddings where id = v_inv.wedding_id;
  select * into v_grp from public.guest_groups where id = v_inv.group_id;
  select * into v_response from public.rsvp_responses where invitation_id = v_inv.id;
  select * into v_version from public.invitation_versions
    where wedding_id = v_inv.wedding_id and published = true
    order by version desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'displayName', coalesce(g.display_name, nullif(trim(concat(g.first_name, ' ', g.last_name)), ''))
  ) order by g.created_at), '[]'::jsonb)
  into v_guests
  from public.guests g where g.group_id = v_inv.group_id;

  v_out := jsonb_build_object(
    'wedding', jsonb_build_object(
      'brideName', v_wed.bride_name,
      'groomName', v_wed.groom_name,
      'partner1Label', v_wed.partner1_label,
      'partner2Label', v_wed.partner2_label,
      'weddingDate', v_wed.wedding_date,
      'dateStatus', v_wed.date_status,
      'location', v_wed.location,
      'rsvpDeadline', coalesce(v_grp.rsvp_deadline_override, v_wed.rsvp_deadline),
      'invitationContent', case when v_version.id is null then null
        else jsonb_build_object('content', v_version.content, 'theme', v_version.theme) end,
      'rsvpSettings', v_wed.rsvp_settings
    ),
    'invitation', jsonb_build_object(
      'id', v_inv.id,
      'greetingName', v_inv.greeting_name,
      'maxPax', v_inv.max_pax,
      'status', v_inv.status
    ),
    'group', jsonb_build_object(
      'name', v_grp.name,
      'invitedPax', v_grp.invited_pax,
      'inviteeNames', v_guests
    ),
    'response', case when v_response.id is null then null else jsonb_build_object(
      'status', v_response.status,
      'attendingCount', v_response.attending_count,
      'mealPreferences', v_response.meal_preferences,
      'dietaryNotes', v_response.dietary_notes,
      'accessibilityNotes', v_response.accessibility_notes,
      'messageToCouple', v_response.message_to_couple,
      'songRequest', v_response.song_request,
      'submittedAt', v_response.submitted_at,
      'updatedAt', v_response.updated_at
    ) end
  );
  return v_out;
end $$;

grant execute on function public.get_invitation_view(text) to anon, authenticated;

-- Public venues/schedule for a resolved invitation (only explicitly public rows).
create or replace function public.get_public_wedding_details(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text := encode(digest(p_token, 'sha256'), 'hex');
  v_wedding_id uuid;
  v_venue_ids jsonb;
  v_venues jsonb;
  v_events jsonb;
begin
  select wedding_id into v_wedding_id from public.guest_invitations where token_hash = v_hash;
  if v_wedding_id is null then
    return null;
  end if;

  select content->'venueIds' into v_venue_ids
  from public.invitation_versions
  where wedding_id = v_wedding_id and published = true
  order by version desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'name', v.name, 'role', v.role, 'address', v.address,
    'mapUrl', v.map_url, 'parkingNotes', v.parking_notes,
    'transitNotes', v.transit_notes, 'accessibilityNotes', v.accessibility_notes,
    'accommodationNotes', v.accommodation_notes
  ) order by v.created_at), '[]'::jsonb)
  into v_venues
  from public.venues v
  where v.wedding_id = v_wedding_id and v.is_public = true
    and (v_venue_ids is null or v.id::text = any (select jsonb_array_elements_text(v_venue_ids)));

  select coalesce(jsonb_agg(jsonb_build_object(
    'title', e.title, 'startTime', e.start_time, 'endTime', e.end_time,
    'location', e.location, 'description', e.description
  ) order by e.event_date nulls last, e.start_time nulls last, e.sort_order), '[]'::jsonb)
  into v_events
  from public.wedding_events e
  where e.wedding_id = v_wedding_id and e.is_public = true and e.event_type = 'wedding_day';

  return jsonb_build_object('venues', v_venues, 'schedule', v_events);
end $$;

grant execute on function public.get_public_wedding_details(text) to anon, authenticated;

-- Submit or update an RSVP. Enforces: valid token, not revoked/expired,
-- deadline/closed rules, and the invitation's PAX cap — atomically.
create or replace function public.submit_rsvp(p_token text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text := encode(digest(p_token, 'sha256'), 'hex');
  v_inv public.guest_invitations%rowtype;
  v_wed public.weddings%rowtype;
  v_grp public.guest_groups%rowtype;
  v_existing public.rsvp_responses%rowtype;
  v_response_id uuid;
  v_count int;
  v_settings jsonb;
  v_deadline date;
  v_locked boolean;
  v_attendees jsonb;
  v_snapshot jsonb;
begin
  select * into v_inv from public.guest_invitations where token_hash = v_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;
  if v_inv.status = 'cancelled' or v_inv.token_revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'revoked_token');
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired_token');
  end if;

  select * into v_wed from public.weddings where id = v_inv.wedding_id;
  select * into v_grp from public.guest_groups where id = v_inv.group_id;
  v_settings := v_wed.rsvp_settings;
  v_deadline := coalesce(v_grp.rsvp_deadline_override, v_wed.rsvp_deadline);

  select * into v_existing from public.rsvp_responses where invitation_id = v_inv.id;
  if v_existing.id is not null then
    v_locked := coalesce((v_settings->>'closed')::boolean, false)
      or coalesce((v_settings->>'allowEdits')::boolean, true) = false
      or (v_deadline is not null and v_deadline < current_date);
    if v_locked then
      return jsonb_build_object('ok', false, 'code', 'closed');
    end if;
  else
    if coalesce((v_settings->>'closed')::boolean, false) then
      return jsonb_build_object('ok', false, 'code', 'closed');
    end if;
    if (p_payload->>'status') = 'confirmed' and v_deadline is not null and v_deadline < current_date then
      return jsonb_build_object('ok', false, 'code', 'closed');
    end if;
  end if;

  v_count := coalesce((p_payload->>'attendingCount')::int, 0);
  if v_count < 0 or v_count > v_inv.max_pax then
    return jsonb_build_object('ok', false, 'code', 'pax_exceeded', 'maxPax', v_inv.max_pax);
  end if;
  if (p_payload->>'status') not in ('confirmed', 'declined') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;
  if (p_payload->>'status') = 'declined' then
    v_count := 0;
  end if;

  if v_existing.id is null then
    insert into public.rsvp_responses (
      wedding_id, invitation_id, group_id, status, attending_count,
      meal_preferences, dietary_notes, accessibility_notes,
      message_to_couple, song_request
    ) values (
      v_inv.wedding_id, v_inv.id, v_inv.group_id,
      p_payload->>'status', v_count,
      nullif(p_payload->>'mealPreferences', ''),
      nullif(p_payload->>'dietaryNotes', ''),
      nullif(p_payload->>'accessibilityNotes', ''),
      nullif(p_payload->>'messageToCouple', ''),
      nullif(p_payload->>'songRequest', '')
    ) returning * into v_existing;
    v_response_id := v_existing.id;

    insert into public.rsvp_response_history (wedding_id, response_id, invitation_id, change_type, snapshot)
    values (v_inv.wedding_id, v_response_id, v_inv.id, 'created',
      jsonb_build_object('status', v_existing.status, 'attendingCount', v_existing.attending_count));

    update public.guest_invitations
    set status = case when p_payload->>'status' = 'confirmed' then 'confirmed' else 'declined' end,
        issued_at = coalesce(issued_at, now())
    where id = v_inv.id;
  else
    v_snapshot := jsonb_build_object(
      'status', v_existing.status, 'attendingCount', v_existing.attending_count,
      'mealPreferences', v_existing.meal_preferences, 'dietaryNotes', v_existing.dietary_notes,
      'accessibilityNotes', v_existing.accessibility_notes,
      'messageToCouple', v_existing.message_to_couple, 'songRequest', v_existing.song_request);

    update public.rsvp_responses set
      status = p_payload->>'status',
      attending_count = v_count,
      meal_preferences = nullif(p_payload->>'mealPreferences', ''),
      dietary_notes = nullif(p_payload->>'dietaryNotes', ''),
      accessibility_notes = nullif(p_payload->>'accessibilityNotes', ''),
      message_to_couple = nullif(p_payload->>'messageToCouple', ''),
      song_request = nullif(p_payload->>'songRequest', ''),
      updated_at = now()
    where id = v_existing.id
    returning * into v_existing;
    v_response_id := v_existing.id;

    insert into public.rsvp_response_history (wedding_id, response_id, invitation_id, change_type, snapshot)
    values (v_inv.wedding_id, v_response_id, v_inv.id, 'updated', v_snapshot);

    update public.guest_invitations
    set status = case when p_payload->>'status' = 'confirmed' then 'confirmed' else 'declined' end
    where id = v_inv.id;
  end if;

  v_attendees := p_payload->'attendees';
  if v_attendees is not null and jsonb_typeof(v_attendees) = 'array' then
    delete from public.rsvp_attendees where response_id = v_response_id;
    perform 1 from public.rsvp_attendees limit 0; -- no-op keeps planner sane
    insert into public.rsvp_attendees (response_id, guest_id, display_name, attending, meal_preference)
    select v_response_id,
      case
        when a->>'guestId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (a->>'guestId')::uuid
        else null::uuid
      end,
      coalesce(a->>'displayName', 'Guest'),
      coalesce((a->>'attending')::boolean, true),
      nullif(a->>'mealPreference', '')
    from jsonb_array_elements(v_attendees) a;
  end if;

  return jsonb_build_object('ok', true, 'attendingCount', v_existing.attending_count,
    'status', v_existing.status, 'updatedAt', v_existing.updated_at);
end $$;

grant execute on function public.submit_rsvp(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets + policies (Supabase only; guarded for local Postgres)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('wedding-media', 'wedding-media', false)
      on conflict (id) do nothing;
    insert into storage.buckets (id, name, public) values ('invitation-public', 'invitation-public', true)
      on conflict (id) do nothing;

    execute $p$
      create policy "members select wedding-media" on storage.objects for select to authenticated
        using (bucket_id = 'wedding-media'
          and public.is_wedding_member(((storage.foldername(name))[1])::uuid))
    $p$;

    execute $p$
      create policy "members insert wedding-media" on storage.objects for insert to authenticated
        with check (bucket_id = 'wedding-media'
          and public.is_wedding_member(((storage.foldername(name))[1])::uuid))
    $p$;

    execute $p$
      create policy "members update wedding-media" on storage.objects for update to authenticated
        using (bucket_id = 'wedding-media'
          and public.is_wedding_member(((storage.foldername(name))[1])::uuid))
        with check (bucket_id = 'wedding-media'
          and public.is_wedding_member(((storage.foldername(name))[1])::uuid))
    $p$;

    execute $p$
      create policy "members delete wedding-media" on storage.objects for delete to authenticated
        using (bucket_id = 'wedding-media'
          and public.is_wedding_member(((storage.foldername(name))[1])::uuid))
    $p$;

    execute $p$
      create policy "members manage invitation-public" on storage.objects for all to authenticated
        using (bucket_id = 'invitation-public'
          and public.is_wedding_member(((storage.foldername(name))[1])::uuid))
        with check (bucket_id = 'invitation-public'
          and public.is_wedding_member(((storage.foldername(name))[1])::uuid))
    $p$;
  end if;
end $$;

commit;
