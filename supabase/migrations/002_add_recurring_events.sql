-- Migration: Add recurring events support with RRULE and exceptions
-- This migration adds columns for RFC 5545 recurrence rules and per-occurrence overrides

-- Add recurrence and override columns to events table
alter table public.events
  add column if not exists rrule text,
  add column if not exists exdates timestamptz[],
  add column if not exists series_id uuid references public.events(id) on delete cascade,
  add column if not exists original_start timestamptz;

-- Add index for efficient series querying
create index if not exists idx_events_series
  on public.events(series_id, original_start);

-- Add index for efficient rrule querying (finding series masters)
create index if not exists idx_events_rrule
  on public.events(rrule)
  where rrule is not null;

-- Add comments for documentation
comment on column public.events.rrule is 'RFC 5545 recurrence rule (e.g., RRULE:FREQ=WEEKLY;BYDAY=MO,WE). Only set on series master events.';
comment on column public.events.exdates is 'Array of UTC timestamps for excluded occurrences (exception dates). Only set on series master events.';
comment on column public.events.series_id is 'Foreign key to the series master event. Only set on override instances.';
comment on column public.events.original_start is 'Original UTC start time of the occurrence being overridden. Only set on override instances.';
