# Family Calendar - Architecture Documentation

## Overview

Family Calendar is a responsive, multi-family calendar application built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and Supabase. It features Google Calendar integration, real-time updates, and intelligent event overlap handling.

## Table of Contents

- [Data Model](#data-model)
- [Authentication Flows](#authentication-flows)
- [Google Calendar Sync](#google-calendar-sync)
- [Rendering Pipeline](#rendering-pipeline)
- [Key Technical Decisions](#key-technical-decisions)

---

## Data Model

### Database Schema

The application uses Supabase (PostgreSQL) with Row-Level Security (RLS) policies.

#### Core Tables

**profiles**
```sql
- id: uuid (PK, references auth.uid())
- email: text
- full_name: text
- created_at: timestamptz
```
User profiles are automatically created via trigger when a user signs up.

**families**
```sql
- id: uuid (PK)
- name: text
- created_at: timestamptz
```
Family units that group users and calendars together.

**family_members**
```sql
- family_id: uuid (FK → families)
- user_id: uuid (FK → profiles)
- role: family_role ('owner' | 'parent' | 'kid' | 'viewer')
- created_at: timestamptz
- PRIMARY KEY (family_id, user_id)
```
Junction table for many-to-many relationship between users and families.

**calendars**
```sql
- id: uuid (PK)
- family_id: uuid (FK → families)
- name: text
- color: text (hex color)
- is_primary: boolean
- created_at: timestamptz
```
Each family can have multiple calendars. One is marked as primary for quick event creation.

**events**
```sql
- id: uuid (PK)
- calendar_id: uuid (FK → calendars)
- title: text
- description: text
- location: text
- starts_at: timestamptz
- ends_at: timestamptz
- all_day: boolean
- rrule: text (RFC 5545 recurrence rule)
- exdates: timestamptz[] (exception dates for recurring events)
- source: text ('google' | null)
- source_id: text (external ID for synced events)
- source_updated_at: timestamptz
- updated_at: timestamptz
- created_at: timestamptz
```
Events with support for recurring patterns and external sync metadata.

**event_attendees** (optional)
```sql
- event_id: uuid (FK → events)
- user_id: uuid (FK → profiles)
- status: text ('needsAction' | 'accepted' | 'declined')
- PRIMARY KEY (event_id, user_id)
```

**google_accounts**
```sql
- user_id: uuid (PK, FK → profiles)
- access_token: text (encrypted)
- refresh_token: text (encrypted)
- expires_at: timestamptz
- updated_at: timestamptz
```
Stores encrypted Google OAuth tokens for Calendar API access.

### Row-Level Security (RLS)

All tables have RLS enabled. Key policies:

- **profiles**: Users can only read/update their own profile
- **families, calendars, events**: Users can only access data for families they're members of
- **family_members**: Members can see other members of their families
- **google_accounts**: Users can only access their own tokens

Helper functions:
- `is_family_member(fam uuid)`: Checks if current user belongs to a family
- `calendar_family(cid uuid)`: Gets family_id for a calendar
- `event_family(eid uuid)`: Gets family_id for an event

---

## Authentication Flows

The application uses **two separate OAuth flows**:

### 1. Supabase Auth (Google Sign-In)

**Purpose**: User authentication and session management

**Flow**:
```
User clicks "Sign in with Google"
  ↓
Supabase Auth initiates OAuth with Google
  ↓
User authorizes in Google
  ↓
Google redirects to /auth/callback
  ↓
Supabase exchanges code for session
  ↓
User is redirected to /calendar
```

**Implementation**:
- `src/app/(auth)/signin/page.tsx`: Sign-in page
- `src/app/auth/callback/route.ts`: OAuth callback handler
- `src/middleware.ts`: Route protection

**Configuration**:
- Supabase Dashboard → Authentication → Providers → Google
- Redirect URI: `https://your-project.supabase.co/auth/v1/callback`

### 2. Google Calendar OAuth (Separate Flow)

**Purpose**: Access Google Calendar API with offline access

**Flow**:
```
User clicks "Connect Google Calendar" (📅 button)
  ↓
GET /api/google/oauth/start (initiates OAuth)
  ↓
User authorizes Google Calendar access
  ↓
Google redirects to /api/google/oauth/callback
  ↓
Server exchanges code for access + refresh tokens
  ↓
Tokens are encrypted (AES-256-GCM) and stored in google_accounts
  ↓
User is redirected back to /calendar?google_connected=true
```

**Implementation**:
- `src/app/api/google/oauth/start/route.ts`: OAuth initiation
- `src/app/api/google/oauth/callback/route.ts`: Token exchange and storage
- `src/lib/crypto.ts`: AES-256-GCM encryption for tokens
- `src/lib/google.ts`: Token refresh and API helpers

**Why separate?**
- Supabase Auth doesn't provide offline refresh tokens
- We need `offline` access for background sync
- Separate flow gives us full control over token lifecycle

---

## Google Calendar Sync

### Sync Model

**One-way sync**: Google Calendar → Family Calendar (read-only)

### Initial Import

```
User clicks "Sync" (🔄 button)
  ↓
POST /api/google/sync
  ↓
Fetch next 30 days of events from Google Calendar API
  ↓
For each event:
  - Check if exists (by source='google' and source_id)
  - If exists and source_updated_at is newer: UPDATE
  - If not exists: INSERT
  - Mark with source='google' and source_id={google_event_id}
  ↓
Return {imported, skipped, total}
```

### Token Management

**Automatic refresh**:
- `googleFetch()` wrapper checks token expiry (5-minute buffer)
- If expired, refreshes using refresh_token
- Updates encrypted access_token and expires_at in database
- Retries original API call

**Security**:
- Tokens encrypted at rest with AES-256-GCM
- Encryption key derived from `ENCRYPTION_SECRET` env var
- IV (initialization vector) unique per encryption

### Future: Incremental Sync

The schema supports `nextSyncToken` for efficient incremental updates:
```typescript
// Store sync token after successful sync
await db.update('google_accounts')
  .set({ next_sync_token: syncResponse.nextSyncToken })
  .where({ user_id });

// Next sync: use syncToken parameter
const params = new URLSearchParams({
  syncToken: storedToken,
});
```

---

## Rendering Pipeline

### Coordinate System

**Time → Pixel Mapping**:
```typescript
const MINUTE_PX = 1;  // 60px per hour
const topPx = (start - dayStartMinute) * MINUTE_PX;
const heightPx = durationMinutes * MINUTE_PX;
```

**Day Window**:
- Default: 6:00 AM - 10:00 PM (16 hours = 960px)
- Configurable via `dayStartHour` and `dayEndHour` props

### Overlap Algorithm (Segment-Based)

**Problem**: When multiple events overlap, how do we position them side-by-side?

**Solution**: Divide each day into vertical segments and assign column positions.

#### Step 1: Clamp Events to Day Window
```typescript
const start = Math.max(eventStart, dayStartMinute);
const end = Math.min(eventEnd, dayEndMinute);
```

#### Step 2: Convert to Segments
```typescript
// Each minute is a segment
const startSeg = Math.floor(start - dayStartMinute);
const endSeg = Math.floor(end - dayStartMinute);
```

#### Step 3: Build Collision Groups
Events overlap if their segments intersect:
```typescript
for (const event of sortedEvents) {
  const overlappingGroups = groups.filter(group =>
    group.some(other =>
      event.startSeg < other.endSeg && event.endSeg > other.startSeg
    )
  );

  if (overlappingGroups.length === 0) {
    groups.push([event]);  // New group
  } else {
    // Merge all overlapping groups + this event
    const merged = [...overlappingGroups, [event]].flat();
    groups = groups.filter(g => !overlappingGroups.includes(g));
    groups.push(merged);
  }
}
```

#### Step 4: Assign Columns Within Each Group
```typescript
// For each event, find the first available column
const assignColumn = (event) => {
  const occupied = new Set();
  for (const other of group) {
    if (other.col !== undefined &&
        other.startSeg < event.endSeg &&
        other.endSeg > event.startSeg) {
      occupied.add(other.col);
    }
  }

  let col = 0;
  while (occupied.has(col)) col++;
  return col;
};
```

#### Step 5: Render with Column Positions
```typescript
const width = `calc((100% - ${colCount * COL_GUTTER_PX}px) / ${colCount})`;
const left = `calc(${col} * (100% / ${colCount}) + ${col * COL_GUTTER_PX}px)`;
```

**Constants**:
- `MINUTE_PX = 1`: Vertical scaling (60px/hour)
- `COL_GUTTER_PX = 4`: Horizontal spacing between columns

### Responsiveness

**Breakpoint-Based Day Counts**:
```typescript
// Mobile: 1 day
// Tablet (sm): 2 days
// Desktop (md): 7 days
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7">
```

**Text Scaling**:
```typescript
// Use clamp() for fluid typography
className="text-[clamp(0.75rem,1.8vw,0.875rem)]"
```

**Touch Targets**:
- Minimum 44x44px for buttons
- `touch-manipulation` CSS to prevent double-tap zoom

---

## Key Technical Decisions

### Why Supabase?

- **Built-in Auth**: OAuth, magic links, JWT sessions
- **RLS**: Database-level security, no need for API middleware
- **Real-time**: WebSocket subscriptions for live updates
- **PostgREST**: Auto-generated REST API
- **pgVector**: Future: semantic search for events

### Why Next.js App Router?

- **Server Components**: Fetch data on server, reduce client JS
- **Server Actions**: Future: Mutations without API routes
- **Streaming**: Future: Partial UI updates while loading
- **Type Safety**: End-to-end TypeScript with tRPC-like patterns

### Why Separate Google OAuth?

- **Offline Access**: Supabase Auth doesn't provide refresh tokens
- **Token Control**: We manage encryption, refresh logic
- **Scope Isolation**: Calendar API separate from auth

### Why Segment-Based Overlap?

- **Simplicity**: No complex graph algorithms
- **Predictability**: Deterministic column assignment
- **Performance**: O(n²) worst case, fast for typical use (< 50 events/day)

### Future Improvements

1. **Recurrence Engine**: Expand rrule to UI (rrule.js)
2. **Two-Way Sync**: Write local events to Google Calendar
3. **Conflict Resolution**: Handle concurrent edits
4. **Multiple Calendars**: Per-family calendar selection
5. **Mobile Apps**: React Native with shared UI components
6. **Kiosk Mode**: Read-only TV/tablet display
7. **AI Features**: Smart event suggestions, conflict detection

---

## File Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── signin/page.tsx           # Sign-in page
│   ├── auth/
│   │   └── callback/route.ts         # Supabase Auth callback
│   ├── api/
│   │   ├── events/route.ts           # CRUD for events
│   │   ├── calendars/primary/route.ts
│   │   ├── google/
│   │   │   ├── oauth/
│   │   │   │   ├── start/route.ts    # Initiate Google OAuth
│   │   │   │   └── callback/route.ts # Token exchange
│   │   │   ├── sync/route.ts         # Import from Google Calendar
│   │   │   └── status/route.ts       # Check connection
│   │   └── diagnostics/auth/route.ts # Config diagnostics
│   ├── calendar/page.tsx             # Main calendar UI
│   └── middleware.ts                 # Route protection
├── components/
│   ├── calendar/
│   │   ├── WeekGrid.tsx              # Week/day view with overlap
│   │   ├── MonthGrid.tsx             # Month view
│   │   └── YearGrid.tsx              # Year overview
│   └── ui/
│       ├── EventCard.tsx             # Event display
│       └── EventPopover.tsx          # Hover/tap details
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   └── server.ts                 # Server client
│   ├── events.ts                     # Data layer for events
│   ├── google.ts                     # Google API helpers
│   ├── crypto.ts                     # Token encryption
│   └── time.ts                       # Date utilities
└── middleware.ts                     # Auth checks
```

---

## Performance Considerations

### Database Indexes

```sql
CREATE INDEX idx_events_calendar_time ON events (calendar_id, starts_at, ends_at);
CREATE INDEX idx_family_members_user ON family_members (user_id);
CREATE INDEX idx_events_source ON events (source, source_id);
```

### Query Optimization

**Time window queries**:
```sql
-- Efficient: Uses index on starts_at and ends_at
WHERE starts_at <= @to AND ends_at >= @from
ORDER BY starts_at
```

**RLS helper functions**:
- Marked `STABLE` for query planner optimization
- Inlined in execution plans

### Client-Side Memoization

```typescript
// Expensive layout calculation memoized
const layoutDay = useMemo(
  () => computeLayout(events, dayStart, dayEnd),
  [events, dayStart, dayEnd]
);
```

### Real-time Subscriptions

Only refetch when relevant changes occur:
```typescript
supabase
  .channel('events-feed')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'events'
  }, refetch)
  .subscribe();
```

---

## Security

### Threat Model

**Protected against**:
- ✅ Unauthorized data access (RLS)
- ✅ Token theft (encrypted at rest)
- ✅ CSRF (Supabase handles PKCE)
- ✅ XSS (React auto-escaping, CSP headers)
- ✅ SQL injection (parameterized queries)

**Not protected against** (future work):
- ⚠️ Token exfiltration if server compromised (need HSM)
- ⚠️ Timing attacks on token comparison (need constant-time compare)
- ⚠️ Rate limiting (need API gateway)

### Best Practices

1. **Never log tokens**: Mask in diagnostics endpoint
2. **Rotate secrets**: ENCRYPTION_SECRET should be rotated periodically
3. **Validate redirects**: Check origin before OAuth redirect
4. **Sanitize inputs**: All user input validated before DB insertion

---

## Testing Strategy

### Unit Tests (TODO)

- `lib/time.ts`: Date calculations, edge cases (DST, leap years)
- `lib/crypto.ts`: Encryption/decryption roundtrip
- Overlap algorithm: Various collision scenarios

### Integration Tests (TODO)

- Auth flows: Sign-in, callback, token refresh
- CRUD operations: Create/read/update/delete events
- Real-time subscriptions: Ensure UI updates

### E2E Tests (TODO)

- Playwright: Full user journey (sign in → add event → sync)
- Mobile: Test touch interactions
- Accessibility: ARIA labels, keyboard navigation

---

## Monitoring & Observability (Future)

1. **Error Tracking**: Sentry for client/server errors
2. **Analytics**: PostHog for usage patterns
3. **Performance**: Vercel Analytics, Core Web Vitals
4. **Logs**: Structured logging with correlation IDs
5. **Alerts**: PagerDuty for sync failures, auth errors

---

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Google Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [RFC 5545 (iCalendar)](https://tools.ietf.org/html/rfc5545)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
