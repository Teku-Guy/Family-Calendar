# Sprint 3: Recurring Events (RRULE) Implementation Summary

## ✅ Completed Implementation

### 1. Dependencies Installed

**Package:**
- ✅ `rrule@2.8.1` - RFC 5545 compliant recurring event library

### 2. RRULE Materialization Engine

**File:** `src/lib/events/materialize.ts` (224 lines)

**Purpose:** Expands RRULE recurring event series into concrete occurrences within a time window

**Key Functions:**
```typescript
// Expand a series into individual occurrences
expandSeries(
  seriesMasters: SeriesMaster[],
  overrides: EventOverride[],
  from: Date,
  to: Date
): MaterializedEvent[]

// Merge regular events, materialized occurrences, and overrides
mergeEvents(
  regularEvents: MaterializedEvent[],
  materializedOccurrences: MaterializedEvent[],
  overrides: EventOverride[]
): MaterializedEvent[]

// Main entry point: Materialize all events for a time window
materializeEvents(
  regularEvents: MaterializedEvent[],
  seriesMasters: SeriesMaster[],
  overrides: EventOverride[],
  from: Date,
  to: Date
): MaterializedEvent[]
```

**Features:**
- Parses RRULE strings and generates occurrences
- Respects exclusion dates (exdates)
- Filters out occurrences that have been overridden
- Calculates event duration and applies it to each occurrence
- Error handling for malformed RRULE strings

### 3. API Route with Recurring Events Support

**File:** `src/lib/events-recurring.ts` (113 lines)

**Purpose:** Query database for all event types and materialize recurring series

**Implementation:**
```typescript
listEventsRecurring({
  from: string,
  to: string,
  calendarId?: string
}): Promise<MaterializedEvent[]>
```

**Query Strategy:**
1. **Regular events:** `rrule IS NULL AND series_id IS NULL` (time-filtered)
2. **Series masters:** `rrule IS NOT NULL` (no time filter - series can generate future occurrences)
3. **Overrides:** `series_id IS NOT NULL` (time-filtered)
4. Materializes all events using `materializeEvents()`
5. Sorts by start time

**Updated:** `src/app/api/events/route.ts` - GET endpoint now uses `listEventsRecurring`

### 4. Validation Schemas for Recurring Events

**File:** `src/lib/validation/events.ts` (125 lines - expanded from 28 lines)

**New Schemas:**

**`recurringEventCreateSchema`** - Create recurring series:
```typescript
{
  calendar_id: uuid
  title: string
  starts_at: datetime
  ends_at: datetime
  location?: string
  color?: string
  all_day?: boolean
  rrule: string (validated with RRule.fromString)
  exdates?: datetime[] (exclusion dates)
}
```

**`eventOverrideCreateSchema`** - Create instance override:
```typescript
{
  ...base fields
  series_id: uuid
  original_start: datetime
}
```

**`recurringEventUpdateSchema`** - Update series master:
```typescript
{
  id: uuid
  title?: string
  rrule?: string (validated)
  exdates?: datetime[]
  // ... other optional fields
}
```

**`addExdateSchema`** - Add exclusion date:
```typescript
{
  series_id: uuid
  exdate: datetime
}
```

**Custom Validator:**
- RRULE string validation using `RRule.fromString()` with try/catch
- Ensures RRULE is parseable before saving to database

### 5. User-Friendly Recurring Pattern Builder

**File:** `src/components/calendar/RecurringPatternBuilder.tsx` (237 lines)

**Purpose:** Convert user-friendly UI selections into RRULE strings

**Features:**
- **Frequency selector:** Daily, Weekly, Monthly, Yearly
- **Interval control:** Every N days/weeks/months/years
- **Weekly day picker:** Select which days of the week (MO, TU, WE, etc.)
- **End conditions:**
  - Never (no end)
  - After N occurrences
  - On specific date
- **Live RRULE generation:** Updates RRULE string as user changes selections
- **Bidirectional:** Can parse existing RRULE and populate UI

**Example RRULE Output:**
```
RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=10
```

### 6. Enhanced EventModal with Recurring UI

**File:** `src/components/calendar/EventModal.tsx` (updated)

**Additions:**
- Checkbox to enable recurring event creation
- Integrated `RecurringPatternBuilder` component
- Dynamic start date tracking for RRULE generation
- Hidden input field to pass RRULE value to form

**User Flow:**
1. User checks "Recurring event" checkbox
2. RecurringPatternBuilder appears
3. User selects pattern (e.g., "Weekly on MO, WE")
4. RRULE generated automatically: `RRULE:FREQ=WEEKLY;BYDAY=MO,WE`
5. On submit, RRULE saved to database

**Existing Features (Already Present):**
- ✅ "This event only" vs "Entire series" editing
- ✅ Series-aware deletion
- ✅ Override creation for single occurrences
- ✅ Exclusion date (exdate) support

### 7. Realtime Updates for Recurring Events

**File:** `src/hooks/useEvents.ts` (updated)

**Enhancement:**
- Detects if changed event is recurring (`rrule` or `series_id` present)
- Always triggers refetch for recurring events (bypasses time window check)
- Ensures series master updates trigger UI refresh even if original occurrence is outside window

**Logic:**
```typescript
const isRecurring = !!row?.rrule || !!row?.series_id;

if (isRecurring) {
  console.log('[useEvents] Realtime update for recurring event, refetching...');
  debouncedRefetch();
  return; // Skip time window check
}

// Standard time window check for non-recurring events
// ...
```

---

## 📊 Database Schema

The project uses a **single-table approach** for recurring events:

**`events` table columns:**
```sql
-- Base event fields
id uuid PRIMARY KEY
calendar_id uuid REFERENCES calendars(id)
title text
starts_at timestamptz
ends_at timestamptz
location text
all_day boolean
color text

-- Recurring event fields (from migration 002)
rrule text                    -- RRULE string (only on series masters)
exdates timestamptz[]         -- Exclusion dates (only on series masters)
series_id uuid               -- Foreign key to master event (only on overrides)
original_start timestamptz   -- Original occurrence time (only on overrides)
```

**Event Types:**
1. **Regular event:** `rrule IS NULL, series_id IS NULL`
2. **Series master:** `rrule IS NOT NULL, series_id IS NULL`
3. **Override:** `rrule IS NULL, series_id IS NOT NULL`

---

## 🧪 Testing Guide

**⚠️ CRITICAL: Apply RLS Fix First!**

The API endpoints will fail with "stack depth limit exceeded" until you apply the RLS policy fix.

**Apply the fix:**
```bash
# 1. Open Supabase SQL Editor:
https://supabase.com/dashboard/project/ibjulgjncqjvggldmkmq/sql/new

# 2. Copy the SQL:
cat fixes/stack-depth-rls-recursion/COMPLETE_RLS_POLICIES_FIXED.sql

# 3. Paste and click "Run"

# 4. Verify API works:
curl -s 'http://localhost:3000/api/events?from=2025-10-16T00:00:00.000Z&to=2025-10-17T23:59:59.999Z' | jq
```

**After RLS Fix - Test Recurring Events:**

### Test 1: Create Weekly Recurring Event
```bash
# Via API (POST /api/events)
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "calendar_id": "YOUR_CALENDAR_ID",
    "title": "Weekly Team Meeting",
    "starts_at": "2025-10-16T10:00:00",
    "ends_at": "2025-10-16T11:00:00",
    "rrule": "RRULE:FREQ=WEEKLY;BYDAY=TH;COUNT=10",
    "color": "#3b82f6"
  }'
```

### Test 2: Query Events (Should Expand Occurrences)
```bash
# Query 4-week window
curl -s 'http://localhost:3000/api/events?from=2025-10-16T00:00:00.000Z&to=2025-11-13T23:59:59.999Z' | jq

# Expected: 10 Thursday occurrences of "Weekly Team Meeting"
```

### Test 3: Create Override (Edit Single Occurrence)
```bash
# Via UI: Click a recurring event instance > Edit > "This event only" > Change title
# Behind the scenes: Creates override with series_id and original_start
```

### Test 4: Add Exclusion Date
```bash
# Via UI: Click a recurring event instance > Delete > "This event only"
# Behind the scenes: Adds datetime to exdates array on series master
```

### Test 5: Realtime Sync
1. Open calendar in two browser tabs
2. In Tab 1: Create recurring weekly event
3. In Tab 2: Should see event appear after 120ms
4. In Tab 1: Edit entire series (change title)
5. In Tab 2: All instances should update

---

## 📋 File Changes Summary

### Created Files
```
src/lib/events/materialize.ts              (224 lines) - RRULE expansion engine
src/lib/events-recurring.ts                (113 lines) - API helper with recurring support
src/components/calendar/RecurringPatternBuilder.tsx (237 lines) - UI for RRULE building
SPRINT_3_SUMMARY.md                        (this file) - Documentation
```

### Modified Files
```
src/lib/validation/events.ts               (expanded from 28 to 125 lines)
src/app/api/events/route.ts                (updated GET to use listEventsRecurring)
src/components/calendar/EventModal.tsx     (added RecurringPatternBuilder integration)
src/hooks/useEvents.ts                     (enhanced realtime for recurring events)
package.json                               (added rrule@2.8.1)
```

---

## 🎯 Usage Example

### Creating Recurring Events in UI

```tsx
import { useState } from 'react';
import EventModal from '@/components/calendar/EventModal';

function CalendarView() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setModalOpen(true)}>
        New Recurring Event
      </button>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaults={{
          calendar_id: 'your-calendar-id',
          starts_at: '2025-10-16T10:00',
          ends_at: '2025-10-16T11:00',
          title: '',
        }}
        mode="create"
      />
      {/*
        User workflow:
        1. Check "Recurring event" checkbox
        2. Select "Weekly" frequency
        3. Pick days: MO, WE, FR
        4. Choose end: "After 20 occurrences"
        5. Click Save

        Result: RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20
      */}
    </>
  );
}
```

### Editing Recurring Events

```tsx
// When user clicks a recurring event instance:
<EventModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  defaults={{
    id: 'occurrence-synthetic-id',
    calendar_id: 'cal-id',
    title: 'Weekly Meeting',
    starts_at: '2025-10-23T10:00',
    ends_at: '2025-10-23T11:00',
    _series: {
      master_id: 'series-master-uuid',
      original_start: '2025-10-23T10:00:00.000Z',
      is_override: false
    }
  }}
  mode="edit"
/>
/*
  Modal shows radio buttons:
  ⚪ This event only    (creates override)
  ⚪ Entire series      (updates master)

  User selects "This event only" > changes title > saves
  Result: New row in events table with series_id set
*/
```

---

## 🔍 Architecture Decisions

### Why Single-Table Approach?

**Chosen:** Add `rrule`, `exdates`, `series_id`, `original_start` columns to `events` table

**Alternative:** Create separate `event_series` and `event_overrides` tables

**Rationale:**
1. **Simpler queries:** No joins needed
2. **Easier RLS policies:** Single table to secure
3. **Better performance:** Fewer tables to query
4. **Consistent API:** All events returned from one table
5. **Existing migration:** Project already uses this approach (002_add_recurring_events.sql)

### Why Client-Side Materialization?

**Chosen:** Expand RRULE in API route using JavaScript (rrule library)

**Alternative:** Expand in database using PostgreSQL RRULE extension

**Rationale:**
1. **No database extensions:** Works with standard Supabase
2. **TypeScript types:** Better type safety
3. **Easier testing:** Test expansion in isolation
4. **Client-side flexibility:** Could move to browser if needed
5. **Library ecosystem:** rrule.js is well-maintained

---

## ⚠️ Critical Notes

### RLS Policy Blocker

**The API will fail until you apply `COMPLETE_RLS_POLICIES_FIXED.sql`**

Symptoms:
```json
{"error":"events_route_failed","details":"stack depth limit exceeded"}
```

Solution: Apply SQL fix in Supabase dashboard (instructions at top of this doc)

### Performance Considerations

**Series master queries are unfiltered by time:**
```typescript
// This query has NO time filter!
let seriesQuery = sb
  .from('events')
  .select('...')
  .not('rrule', 'is', null);
```

**Why?** A series that started in 2024 might have occurrences in 2026. We must fetch all series masters and let the materialization engine filter occurrences.

**Mitigation:**
- Add database index on `rrule` column
- Consider caching series masters
- For large datasets, add UNTIL date to all series

### RRULE Complexity

**Supported patterns:**
- ✅ Daily, Weekly, Monthly, Yearly frequencies
- ✅ Interval (every N units)
- ✅ By weekday (MO, TU, WE, etc.)
- ✅ Count (end after N occurrences)
- ✅ Until date (end on specific date)
- ✅ Exclusion dates (exdates)

**Not yet supported in UI:**
- ❌ By month day (e.g., "15th of each month")
- ❌ By month (e.g., "January and June only")
- ❌ Complex patterns (e.g., "last Friday of month")

Users can still manually enter these in RRULE text format if needed.

---

## 🚀 Next Steps

**After RLS fix is applied:**

1. **Test complete CRUD flow:**
   - Create recurring series
   - View expanded occurrences
   - Edit single occurrence (override)
   - Edit entire series
   - Delete single occurrence (exdate)
   - Delete entire series

2. **Test realtime sync:**
   - Open two browser tabs
   - Verify recurring events sync across tabs

3. **Optional enhancements:**
   - Add visual indicator for recurring events (icon)
   - Show RRULE summary text (e.g., "Every Thursday, 10 times")
   - Add "Show series" button to jump to other occurrences
   - Implement "By month day" in RecurringPatternBuilder
   - Add series editing in event detail view

4. **Production considerations:**
   - Monitor series master query performance
   - Add index: `CREATE INDEX idx_events_rrule ON events(rrule) WHERE rrule IS NOT NULL;`
   - Consider series expiration strategy (auto-add UNTIL date)
   - Add analytics for recurring event usage

---

## 📊 Code Quality

- ✅ TypeScript: All new code is fully typed
- ✅ Error handling: Try/catch with fallbacks for RRULE parsing
- ✅ Performance: 120ms debounced realtime updates
- ✅ Validation: Zod schemas validate RRULE strings
- ✅ Documentation: Inline comments and JSDoc
- ✅ Consistency: Follows existing codebase patterns

---

## 🎉 Acceptance Criteria

**✅ Foundation + Sprint 2 (Prerequisites):**
- ✅ Environment checks pass
- ✅ RLS policies fix created (pending user application)
- ✅ API routes with validation
- ✅ Client hook with optimistic updates
- ✅ Realtime subscriptions

**✅ Sprint 3 (Recurring Events):**
- ✅ RRULE dependency installed
- ✅ Materialization engine created
- ✅ API routes handle recurring events
- ✅ Validation schemas for series/overrides
- ✅ User-friendly recurring pattern UI
- ✅ "This event only" vs "Entire series" editing
- ✅ Realtime updates for recurring events
- ⏳ Full testing (blocked by RLS fix)

**Integration:**
- ✅ EventModal supports recurring event creation
- ✅ EventModal supports series instance editing
- ✅ useEvents hook fetches materialized occurrences
- ✅ Realtime triggers on series/override changes

---

**Status:** ✅ Implementation complete
**Blocker:** RLS policy fix (requires Supabase dashboard access)
**Ready to test:** After user applies SQL fix

---

## 📚 Additional Resources

**RRULE Specification:** RFC 5545 (iCalendar)
**Library Documentation:** https://github.com/jakubroztocil/rrule
**Testing Tool:** https://rrule.vercel.app/ (visualize RRULE patterns)
**Migration File:** `supabase/migrations/002_add_recurring_events.sql`
