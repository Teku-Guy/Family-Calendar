# Family Calendar - Project Context

**Last Updated:** 2024-11-19
**Version:** Sprint 5 (Click-to-Edit & Expandable Day View)

---

## Project Overview

Family Calendar is a Next.js 15 + Supabase family calendar application with:
- Google Calendar two-way sync
- Recurring events (RFC 5545 RRULE)
- Real-time collaboration
- Click-to-edit interaction
- Expandable day view for event overflow

---

## Current State

### Completed Features

#### Core Calendar (Sprint 1-2)
- ✅ Four view modes: Day, Week, Month, Year
- ✅ Event CRUD operations (Create, Read, Update, Delete)
- ✅ Real-time updates via Supabase Realtime
- ✅ Optimistic UI updates
- ✅ All-day event support
- ✅ Color-coded events

#### Recurring Events (Sprint 3)
- ✅ RRULE-based recurring events
- ✅ Series master + occurrence overrides
- ✅ Exclusion dates (exdates)
- ✅ RecurringPatternBuilder UI
- ✅ Materialization engine for expanding series

#### Google Calendar Sync (Sprint 4A-4B)
- ✅ OAuth 2.0 authentication
- ✅ Pull sync with delta sync (syncToken)
- ✅ Push sync (create, update, delete)
- ✅ Conflict detection and resolution
- ✅ Token encryption (AES-256-GCM)
- ✅ Safety controls (dry-run mode, whitelists)

#### Event Interaction (Sprint 5)
- ✅ Click-to-edit in MonthGrid and YearGrid
- ✅ "+N more" overflow button
- ✅ DayExpansionModal for viewing all events
- ✅ Keyboard navigation and accessibility
- ✅ CalendarContext for shared state

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.0.3 |
| Runtime | React | 19.2.0 |
| Database | Supabase (PostgreSQL) | Latest |
| Auth | Supabase Auth | Latest |
| Styling | Tailwind CSS | v4 |
| Language | TypeScript | 5.x |
| Package Manager | Bun | Latest |
| Build Tool | Turbopack | Built-in |

### Database Schema

**Tables:**
- `users` - Supabase Auth managed
- `families` - Family groups
- `family_members` - Many-to-many (users ↔ families)
- `calendars` - Calendar instances (one per family)
- `events` - All events (regular, recurring, overrides)
- `google_accounts` - Encrypted OAuth tokens

**Events Table Structure:**
```sql
-- Base columns
id uuid PRIMARY KEY
calendar_id uuid REFERENCES calendars(id)
title text
starts_at timestamptz
ends_at timestamptz
location text
all_day boolean
color text

-- Recurring columns
rrule text                    -- RRULE string (series masters only)
exdates timestamptz[]         -- Exclusion dates (series masters only)
series_id uuid                -- FK to master (overrides only)
original_start timestamptz    -- Original time (overrides only)

-- External sync columns
external_id text              -- Google event ID
external_etag text            -- Conflict detection
external_updated_at timestamptz
external_source text          -- 'google' | null
```

### Component Architecture

```
CalendarPage (page.tsx)
├── State: mode, cursor, events, modal, googleConnected
├── Effects: fetchEvents, realtime subscription
├── Callbacks: openCreate, openEdit, closeModal
│
├── WeekGrid (day/week mode)
│   ├── DayColumn (memoized)
│   ├── AllDayEventBanner
│   ├── EventCard (clickable)
│   └── Drag-to-create support
│
├── MonthGrid (month mode)
│   ├── 42-day grid (6 weeks)
│   ├── Click-to-edit events
│   ├── "+N more" overflow button
│   └── DayExpansionModal integration
│
├── YearGrid (year mode)
│   └── 12 × MonthGrid instances
│
├── DayExpansionModal
│   ├── Focus trap
│   ├── Event list (sorted)
│   └── Click-to-edit events
│
└── EventModal
    ├── Create mode
    ├── Edit mode
    ├── Series scope chooser
    └── RecurringPatternBuilder
```

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/events` | GET | List events in time window |
| `/api/events` | POST | Create event |
| `/api/events/[id]` | PATCH | Update event |
| `/api/events/[id]` | DELETE | Delete event |
| `/api/calendars/primary` | GET | Get user's calendar ID |
| `/api/google/oauth/start` | GET | Start OAuth flow |
| `/api/google/oauth/callback` | GET | OAuth callback |
| `/api/google/sync` | POST | Pull from Google |
| `/api/google/push/[id]` | POST | Push to Google |
| `/api/google/status` | GET | Check connection |

### Environment Variables

**Required:**
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
DEVICE_JWT_SECRET=
```

**Optional:**
```bash
PUBLIC_BASE_URL=http://localhost:3000
GOOGLE_SYNC_DRY_RUN=true
ALLOW_GOOGLE_WRITES=false
GOOGLE_WRITE_ALLOWLIST=
```

---

## Known Issues & Limitations

1. **RLS Recursion:** Fixed with SECURITY DEFINER functions
2. **Series Master Performance:** Unfiltered queries needed for RRULE expansion
3. **Google Sync Instance Editing:** Overrides not fully synced to Google exceptions
4. **Conflict Resolution:** Only last-writer-wins implemented
5. **Batch Operations:** Google push is one-at-a-time

---

## Development Workflow

### Starting Dev Server
```bash
bun run dev
```

### Building for Production
```bash
bun run build
```

### Testing
```bash
bunx tsx scripts/probe-events.ts        # Test DB access
bunx tsx scripts/diagnose-rls.ts        # Debug RLS policies
curl http://localhost:3000/api/events?from=...&to=...
```

### Git Workflow
```bash
# Current branch: chore/repo-audit-phase1
git add <files>
git commit -m "feat: description

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin chore/repo-audit-phase1
```

---

## Common Patterns

### Creating Events
```typescript
const draft: EventDraft = {
  calendar_id: primaryCalendarId,
  title: 'Team Meeting',
  starts_at: '2024-11-19T14:00',  // datetime-local format
  ends_at: '2024-11-19T15:00',
  location: 'Conference Room A',
  color: '#3b82f6',
  all_day: false,
};
```

### Recurring Events
```typescript
const recurringDraft: EventDraft = {
  ...draft,
  rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=10',
};
```

### Editing Series Instances
```typescript
const instanceDraft: EventDraft = {
  ...draft,
  _series: {
    master_id: 'uuid-of-series-master',
    original_start: '2024-11-20T14:00:00Z',
    is_override: false,
  },
};
```

---

## File Locations

### Key Files
| File | Purpose |
|------|---------|
| `src/app/calendar/page.tsx` | Main calendar UI orchestration |
| `src/components/calendar/WeekGrid.tsx` | Week/day view with overlap algorithm |
| `src/components/calendar/MonthGrid.tsx` | Month view with click-to-edit |
| `src/components/calendar/EventModal.tsx` | Event create/edit modal |
| `src/components/calendar/DayExpansionModal.tsx` | Event overflow modal |
| `src/contexts/CalendarContext.tsx` | Shared modal state |
| `src/lib/events-recurring.ts` | Recurring event queries |
| `src/lib/events/materialize.ts` | RRULE expansion engine |
| `src/types/events.ts` | TypeScript event types |
| `CLAUDE.md` | Developer documentation |

---

## Next Steps

### Planned Features
- Google Calendar UI recreation
- Drag-to-reschedule events
- Multi-calendar support
- Event sharing/permissions
- Notifications and reminders
- Mobile app (React Native)

### Technical Debt
- Add comprehensive test coverage
- Implement batch Google sync
- Optimize series master queries with indexes
- Add manual conflict resolution UI
- Improve error handling and user feedback

---

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Google Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [RRULE Spec](https://datatracker.ietf.org/doc/html/rfc5545)
- [rrule.js Library](https://github.com/jakubroztocil/rrule)

---

**For detailed implementation guidance, see `CLAUDE.md`**
