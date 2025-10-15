# Supabase Backend Setup

## Prerequisites

1. Create a Supabase project at https://supabase.com
2. Get your project URL and anon key from Settings > API

## Environment Variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# For Google Calendar integration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# For encrypting Google tokens at rest (generate with: openssl rand -hex 32)
ENCRYPTION_SECRET=your-random-hex-string-here
```

## Database Setup

Run the following SQL in your Supabase SQL Editor (Dashboard > SQL Editor):

```sql
-- Extensions
create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key default auth.uid(),
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "me: select own profile" on public.profiles for select using (id = auth.uid());
create policy "me: update own profile" on public.profiles for update using (id = auth.uid());

-- Families & membership
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.families enable row level security;

create type if not exists public.family_role as enum ('owner','parent','kid','viewer');

create table if not exists public.family_members (
  family_id uuid references public.families(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role public.family_role not null default 'parent',
  primary key (family_id, user_id),
  created_at timestamptz not null default now()
);
alter table public.family_members enable row level security;

-- Helper: is member
create or replace function public.is_family_member(fam uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.family_members
    where family_id = fam and user_id = auth.uid()
  );
$$;

-- Calendars
create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  color text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.calendars enable row level security;

-- Events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  rrule text,
  exdates timestamptz[],
  source text,
  source_id text,
  source_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint events_time_check check (starts_at < ends_at)
);
alter table public.events enable row level security;

-- Attendees (optional)
create table if not exists public.event_attendees (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'needsAction',
  primary key (event_id, user_id)
);
alter table public.event_attendees enable row level security;

-- Policies: families
create policy "families: select if member" on public.families for select using (public.is_family_member(id));
create policy "families: insert" on public.families for insert with check (auth.uid() is not null);
create policy "families: update if member" on public.families for update using (public.is_family_member(id));

-- Policies: family_members
create policy "members: select if member" on public.family_members for select using (public.is_family_member(family_id));
create policy "members: insert self" on public.family_members for insert with check (user_id = auth.uid());
create policy "members: delete self" on public.family_members for delete using (user_id = auth.uid());

-- Helper: calendar -> family
create or replace function public.calendar_family(cid uuid)
returns uuid language sql stable as $$
  select family_id from public.calendars where id = cid
$$;

-- Policies: calendars
create policy "cal: select if member" on public.calendars for select using (public.is_family_member(family_id));
create policy "cal: insert if member" on public.calendars for insert with check (public.is_family_member(family_id));
create policy "cal: update if member" on public.calendars for update using (public.is_family_member(family_id));
create policy "cal: delete if member" on public.calendars for delete using (public.is_family_member(family_id));

-- Policies: events via parent calendar family
create policy "events: select if member" on public.events for select using (public.is_family_member(public.calendar_family(calendar_id)));
create policy "events: insert if member" on public.events for insert with check (public.is_family_member(public.calendar_family(calendar_id)));
create policy "events: update if member" on public.events for update using (public.is_family_member(public.calendar_family(calendar_id)));
create policy "events: delete if member" on public.events for delete using (public.is_family_member(public.calendar_family(calendar_id)));

-- Attendees policy via event
create or replace function public.event_family(eid uuid)
returns uuid language sql stable as $$
  select c.family_id from public.events e join public.calendars c on c.id = e.calendar_id where e.id = eid
$$;
create policy "att: select if member" on public.event_attendees for select using (public.is_family_member(public.event_family(event_id)));
create policy "att: upsert if member" on public.event_attendees for all using (public.is_family_member(public.event_family(event_id))) with check (public.is_family_member(public.event_family(event_id)));

-- Bootstrap new users: profile + family + primary calendar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  fam_id uuid := gen_random_uuid();
  cal_id uuid := gen_random_uuid();
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  insert into public.families(id, name) values (fam_id, 'My Family');
  insert into public.family_members(family_id, user_id, role) values (fam_id, new.id, 'owner');

  insert into public.calendars(id, family_id, name, color, is_primary)
  values (cal_id, fam_id, 'Family', '#3b82f6', true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Google Calendar integration
create table if not exists public.google_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.google_accounts enable row level security;
create policy "google: select own" on public.google_accounts for select using (user_id = auth.uid());
create policy "google: upsert own" on public.google_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Indexes
create index if not exists idx_events_calendar_time on public.events (calendar_id, starts_at, ends_at);
create index if not exists idx_family_members_user on public.family_members (user_id);
create index if not exists idx_events_source on public.events (source, source_id);
```

## Testing

1. Sign up for an account in your Supabase project (Authentication > Users > Add User)
2. The trigger will automatically create a profile, family, and primary calendar
3. Use the "+ Add event" button in the calendar UI to create test events
4. Events will appear in real-time thanks to Supabase Realtime subscriptions

## Google OAuth Setup

To enable Google Calendar sync:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure the OAuth consent screen
6. Create OAuth 2.0 credentials with:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/google/oauth/callback` (and your production URL)
7. Add the Client ID and Client Secret to your `.env.local`
8. In Supabase Dashboard, go to Authentication → Providers → Google
9. Enable Google provider and add your Client ID and Client Secret
10. Set the redirect URL to: `https://your-project.supabase.co/auth/v1/callback`

## API Endpoints

### Events
- `GET /api/events?from=<ISO>&to=<ISO>` - List events in time range
- `POST /api/events` - Create a new event

### Calendars
- `GET /api/calendars/primary` - Get the primary calendar ID

### Google Calendar Sync
- `GET /api/google/oauth/start` - Initiate Google Calendar OAuth flow
- `GET /api/google/oauth/callback` - OAuth callback handler
- `POST /api/google/sync` - Sync events from Google Calendar

## Features

✅ Row-Level Security (RLS) policies ensure users can only access their family's data
✅ Automatic profile + family + calendar creation on signup
✅ Real-time event updates across all clients
✅ Optimized queries with proper indexes
✅ Event validation (start < end)
✅ Google Sign-In authentication via Supabase Auth
✅ Google Calendar integration with OAuth 2.0 offline access
✅ Encrypted token storage using AES-256-GCM
✅ Automatic token refresh for Google API calls
✅ One-way sync from Google Calendar to local events
✅ Middleware protection for authenticated routes
