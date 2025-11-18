-- Migration: Add Google Calendar Two-Way Sync Support (Sprint 4A/4B)
-- This migration adds tables and columns for Google Calendar integration

-- ============================================================================
-- STEP 1: Add external sync columns to events table
-- ============================================================================

alter table public.events
  add column if not exists external_id text,
  add column if not exists external_etag text,
  add column if not exists external_updated_at timestamptz,
  add column if not exists external_source text check (external_source in ('google', 'outlook', 'apple'));

-- Add indexes for efficient sync operations
create index if not exists idx_events_external_id
  on public.events(external_id)
  where external_id is not null;

create index if not exists idx_events_external_source
  on public.events(external_source)
  where external_source is not null;

create index if not exists idx_events_external_updated_at
  on public.events(external_updated_at desc)
  where external_updated_at is not null;

-- Add comments for documentation
comment on column public.events.external_id is 'External provider event ID (e.g., Google Calendar event ID)';
comment on column public.events.external_etag is 'ETag from external provider for conflict detection (optimistic concurrency control)';
comment on column public.events.external_updated_at is 'Last modified timestamp from external provider';
comment on column public.events.external_source is 'External calendar provider: google, outlook, or apple. NULL for local-only events.';

-- ============================================================================
-- STEP 2: Create google_accounts table for OAuth tokens
-- ============================================================================

create table if not exists public.google_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_user_id text not null,
  email text not null,
  access_token text not null, -- Encrypted access token
  refresh_token text, -- Encrypted refresh token
  expires_at timestamptz not null,
  scope text not null, -- OAuth scopes granted
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ensure one Google account per user
  unique(user_id)
);

-- Add indexes
create index if not exists idx_google_accounts_user_id
  on public.google_accounts(user_id);

create index if not exists idx_google_accounts_expires_at
  on public.google_accounts(expires_at);

-- Add RLS policies for google_accounts
alter table public.google_accounts enable row level security;

create policy "Users can view their own Google account"
  on public.google_accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own Google account"
  on public.google_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Google account"
  on public.google_accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own Google account"
  on public.google_accounts for delete
  using (auth.uid() = user_id);

-- Add comments
comment on table public.google_accounts is 'Stores encrypted Google OAuth tokens for calendar sync';
comment on column public.google_accounts.access_token is 'Encrypted OAuth access token';
comment on column public.google_accounts.refresh_token is 'Encrypted OAuth refresh token';

-- ============================================================================
-- STEP 3: Create google_calendars table for calendar metadata
-- ============================================================================

create table if not exists public.google_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_calendar_id text not null, -- Google's calendar ID (usually email for primary)
  summary text not null, -- Calendar name/title
  description text,
  time_zone text,
  background_color text,
  foreground_color text,
  selected boolean not null default false, -- Whether to sync this calendar
  access_role text, -- owner, writer, reader, freeBusyReader
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ensure unique calendar per user
  unique(user_id, google_calendar_id)
);

-- Add indexes
create index if not exists idx_google_calendars_user_id
  on public.google_calendars(user_id);

create index if not exists idx_google_calendars_selected
  on public.google_calendars(user_id, selected)
  where selected = true;

-- Add RLS policies for google_calendars
alter table public.google_calendars enable row level security;

create policy "Users can view their own Google calendars"
  on public.google_calendars for select
  using (auth.uid() = user_id);

create policy "Users can insert their own Google calendars"
  on public.google_calendars for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Google calendars"
  on public.google_calendars for update
  using (auth.uid() = user_id);

create policy "Users can delete their own Google calendars"
  on public.google_calendars for delete
  using (auth.uid() = user_id);

-- Add comments
comment on table public.google_calendars is 'Stores Google Calendar metadata and selection state for sync';
comment on column public.google_calendars.selected is 'Whether this Google calendar should be synced';

-- ============================================================================
-- STEP 4: Create sync_runs table for observability
-- ============================================================================

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('pull', 'push')),
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text,
  stats jsonb, -- { events_fetched, events_created, events_updated, events_deleted, simulated }
  created_at timestamptz not null default now()
);

-- Add indexes
create index if not exists idx_sync_runs_user_id
  on public.sync_runs(user_id, started_at desc);

create index if not exists idx_sync_runs_status
  on public.sync_runs(status, started_at desc);

-- Add RLS policies for sync_runs
alter table public.sync_runs enable row level security;

create policy "Users can view their own sync runs"
  on public.sync_runs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sync runs"
  on public.sync_runs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sync runs"
  on public.sync_runs for update
  using (auth.uid() = user_id);

-- Add comments
comment on table public.sync_runs is 'Audit log of sync operations for observability and debugging';
comment on column public.sync_runs.direction is 'pull: Google→Local, push: Local→Google';
comment on column public.sync_runs.stats is 'JSON stats: events_fetched, events_created, events_updated, events_deleted, simulated, etc.';

-- ============================================================================
-- STEP 5: Create sync_state table for delta sync tokens
-- ============================================================================

create table if not exists public.sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_calendar_id text not null,
  sync_token text, -- Google's syncToken for delta sync
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add index
create index if not exists idx_sync_state_last_sync_at
  on public.sync_state(last_sync_at desc);

-- Add RLS policies for sync_state
alter table public.sync_state enable row level security;

create policy "Users can view their own sync state"
  on public.sync_state for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sync state"
  on public.sync_state for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sync state"
  on public.sync_state for update
  using (auth.uid() = user_id);

create policy "Users can delete their own sync state"
  on public.sync_state for delete
  using (auth.uid() = user_id);

-- Add comments
comment on table public.sync_state is 'Stores Google Calendar sync tokens for efficient delta sync';
comment on column public.sync_state.sync_token is 'Google Calendar API syncToken for incremental sync';

-- ============================================================================
-- STEP 6: Add updated_at trigger function
-- ============================================================================

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add triggers for updated_at columns
create trigger update_google_accounts_updated_at
  before update on public.google_accounts
  for each row
  execute function public.update_updated_at_column();

create trigger update_google_calendars_updated_at
  before update on public.google_calendars
  for each row
  execute function public.update_updated_at_column();

create trigger update_sync_state_updated_at
  before update on public.sync_state
  for each row
  execute function public.update_updated_at_column();

-- ============================================================================
-- Migration Complete
-- ============================================================================

comment on schema public is 'Google Calendar Two-Way Sync Migration Applied - Sprint 4A/4B';
