# Foundation + Sprint 2 Implementation Summary

## ✅ Completed Implementation

### 1. Environment & Scripts

**Created:**
- `scripts/env-check.ts` - Environment health check
  - Verifies all required env vars are set
  - Shows URL and key prefixes
  - Test: `bunx tsx scripts/env-check.ts` ✅ PASS

**Already Existing (Verified):**
- `scripts/sb.ts` - Service role Supabase client
- `scripts/seed-events.ts` - Seeds 4 colorful test events
- `scripts/probe-events.ts` - Tests DB queries (bypasses RLS)
  - Test: `bunx tsx scripts/probe-events.ts` ✅ PASS (9 rows returned, 892ms)

### 2. Supabase Clients

**Verified:**
- `src/lib/supabase/server.ts` - Server client with async cookies ✅
- `src/lib/supabase/client.ts` - Browser client ✅

Both use proper environment variables and are production-ready.

### 3. API Routes with Validation

**Created:**
- `src/lib/validation/events.ts` - Zod schemas
  - `eventCreateSchema` - Validates event creation
  - `eventUpdateSchema` - Validates updates
  - Date range validation, color format validation

**Updated:**
- `src/app/api/events/route.ts`
  - GET: Returns `{ events: [...] }`
  - POST: Creates event with Zod validation

**Created:**
- `src/app/api/events/[id]/route.ts`
  - PATCH: Updates event (Next.js 15 async params)
  - DELETE: Deletes event

### 4. Client-Side CRUD

**Updated:**
- `src/hooks/useEvents.ts`
  - `upsertLocal(event)` - Optimistic add/update
  - `removeLocal(id)` - Optimistic delete
  - Realtime subscription with 120ms debouncing
  - Auto-refetch on Supabase changes

**Created:**
- `src/components/calendar/EventModalSimple.tsx`
  - Create/Edit modes
  - Toast notifications
  - Optimistic update callbacks
  - Color picker, datetime inputs
  - Delete confirmation

### 5. Dependencies

- ✅ `zod@4.1.12` - Runtime validation
- ✅ `dotenv` - Environment loading

---

## ⚠️ CRITICAL: RLS Policy Fix Required

### Current Status

```bash
# Service role (bypasses RLS): ✅ WORKS
$ bunx tsx scripts/probe-events.ts
✅ SERVICE QUERY OK (892ms)
   Rows returned: 9

# API with RLS: ❌ FAILS
$ curl 'http://localhost:3000/api/events?from=2025-10-16...'
{"error":"events_route_failed","details":"stack depth limit exceeded"}
```

**Diagnosis:** RLS policy recursion confirmed. The `family_members` table policies reference themselves, causing infinite recursion.

### Apply the Fix

**SQL File Ready:** `fixes/stack-depth-rls-recursion/COMPLETE_RLS_POLICIES_FIXED.sql`

**Steps:**

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/ibjulgjncqjvggldmkmq/sql/new
   ```

2. **Copy the SQL:**
   ```bash
   cat fixes/stack-depth-rls-recursion/COMPLETE_RLS_POLICIES_FIXED.sql
   ```

3. **Paste and click "Run"**

4. **Verify:**
   ```bash
   curl -s 'http://localhost:3000/api/events?from=2025-10-16T00:00:00.000Z&to=2025-10-17T23:59:59.999Z' | jq
   ```

   Expected: `{"events": [...]}`
   Current: `{"error": "events_route_failed"}`

### What the Fix Does

**Creates helper functions:**
```sql
current_user_family_ids()  -- Returns families for current user (SECURITY DEFINER)
is_family_owner()          -- Checks if user is owner (SECURITY DEFINER)
```

**Replaces recursive policies:**
```sql
-- ❌ OLD (Recursive):
USING (
  EXISTS (
    SELECT 1 FROM family_members fm  -- ← queries family_members in family_members policy!
    WHERE fm.family_id = family_members.family_id
      AND fm.user_id = auth.uid()
  )
)

-- ✅ NEW (Safe):
USING (
  family_id IN (SELECT current_user_family_ids())  -- ← uses SECURITY DEFINER function
)
```

---

## 📋 File Changes Summary

### Created Files
```
scripts/env-check.ts
src/lib/validation/events.ts
src/app/api/events/[id]/route.ts
src/components/calendar/EventModalSimple.tsx
IMPLEMENTATION_SUMMARY.md
SPRINT_2_SUMMARY.md
```

### Modified Files
```
src/app/api/events/route.ts        (added POST with Zod validation)
src/hooks/useEvents.ts              (added optimistic update helpers)
package.json                        (added zod dependency)
```

### SQL Changes Required (User Action)
```
fixes/stack-depth-rls-recursion/COMPLETE_RLS_POLICIES_FIXED.sql
  ↓
Supabase SQL Editor (manual apply)
```

---

## 🧪 Testing Checklist

**Before RLS Fix:**
- [x] ✅ env-check prints URL + key prefixes
- [x] ✅ probe-events returns 9 rows (892ms)
- [ ] ❌ API returns `{"error": "events_route_failed"}`

**After RLS Fix (User applies SQL):**
- [ ] GET /api/events returns `{"events": [...]}`
- [ ] POST /api/events creates event
- [ ] PATCH /api/events/[id] updates event
- [ ] DELETE /api/events/[id] deletes event
- [ ] Toast notifications appear on success/error
- [ ] Optimistic updates work (instant UI feedback)
- [ ] Realtime updates trigger within 120ms
- [ ] Two browser tabs sync changes automatically

---

## 🚀 Usage Example

```tsx
// In your calendar page
import { useEvents } from '@/hooks/useEvents';
import EventModalSimple from '@/components/calendar/EventModalSimple';

function CalendarPage() {
  const from = new Date('2025-10-16T00:00:00');
  const to = new Date('2025-10-23T23:59:59');
  const { events, loading, upsertLocal, removeLocal } = useEvents(from, to);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaults, setModalDefaults] = useState({});
  const [modalMode, setModalMode] = useState<'create'|'edit'>('create');

  return (
    <>
      {/* Your calendar UI */}
      <button onClick={() => {
        setModalDefaults({ calendar_id: 'xxx', starts_at: '...', ends_at: '...' });
        setModalMode('create');
        setModalOpen(true);
      }}>
        New Event
      </button>

      {events.map(e => (
        <div key={e.id} onClick={() => {
          setModalDefaults(e);
          setModalMode('edit');
          setModalOpen(true);
        }}>
          {e.title}
        </div>
      ))}

      {/* Modal with CRUD + optimistic updates */}
      <EventModalSimple
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaults={modalDefaults}
        mode={modalMode}
        onSaved={(event) => upsertLocal(event)}
        onDeleted={(id) => removeLocal(id)}
      />
    </>
  );
}
```

---

## 📊 Code Quality

- ✅ TypeScript: No errors in app code
- ✅ Imports: Using `@/*` path aliases
- ✅ Server/Client: Proper separation
- ✅ Error handling: Try/catch with toasts
- ✅ Loading states: Disabled buttons during operations
- ✅ Validation: Zod on both client and server
- ✅ Optimistic UI: Instant feedback

---

## 🎯 Acceptance Criteria

**Environment:**
- ✅ env-check passes
- ✅ All scripts have `import { config } from 'dotenv'` at top
- ✅ .env.local has all required keys

**Database:**
- ✅ Seed script works
- ✅ Probe script works (bypasses RLS)
- ⏳ RLS fix pending (user applies SQL)

**API:**
- ✅ Routes implemented with Zod validation
- ⏳ API returns 500 until RLS fixed
- ✅ POST/PATCH/DELETE ready to test after fix

**Client:**
- ✅ useEvents hook with optimistic updates
- ✅ EventModalSimple with CRUD + toasts
- ✅ Realtime subscription with debouncing
- ⏳ Full flow testable after RLS fix

**Integration:**
- ⏳ Needs calendar page wiring (optional - existing modal already wired)
- ⏳ Two-tab sync test (after RLS fix)

---

## 🔄 Next Steps

1. **User Action Required:** Apply `COMPLETE_RLS_POLICIES_FIXED.sql` in Supabase
2. Test API endpoints
3. Test CRUD flow in browser
4. Test realtime sync between tabs
5. (Optional) Wire EventModalSimple into calendar page or continue using existing EventModal

---

**Status:** ✅ Implementation complete
**Blocker:** RLS policy fix (requires Supabase dashboard access)
**Ready to test:** After user applies SQL fix
