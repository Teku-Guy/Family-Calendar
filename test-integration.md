# Integration Test Plan - QuickAdd Fix

## Prerequisites
- Dev server running (`bun run dev`)
- Valid calendar_id (get from database or UI)
- Browser with dev tools open

---

## Test 1: QuickAddModal - Natural Language Mode

**Steps:**
1. Navigate to calendar (Month or Year view)
2. Click any date cell
3. QuickAddModal opens
4. Enter: "Team meeting at 2pm"
5. Verify detected time shows: "Mon, Nov 25, 2:00 PM"
6. Click "Create Event"

**Expected:**
- ✅ Modal closes immediately
- ✅ Event appears in calendar
- ✅ No console errors
- ✅ Browser network tab shows:
  - POST /api/events
  - Status: 201 Created
  - Request payload contains `starts_at: "2025-11-25T14:00:00.000Z"` (ISO format)

**Verify in Database:**
```bash
bunx tsx scripts/list-events.ts
```
Should show new event with ISO timestamps.

---

## Test 2: QuickAddModal - Manual Mode

**Steps:**
1. Open QuickAddModal
2. Click "Manual" tab
3. Enter title: "Doctor Appointment"
4. Select date: Today
5. Select start: 3:00 PM
6. Select end: 4:00 PM
7. Click "Create Event"

**Expected:**
- ✅ Modal closes
- ✅ Event appears at 3pm-4pm slot
- ✅ No console errors
- ✅ POST request uses ISO format

---

## Test 3: EventModalSimple - Create Event

**Steps:**
1. In Week view, drag to create event (9am-10am)
2. EventModalSimple opens with pre-filled times
3. Enter title: "Morning standup"
4. Click "Save"

**Expected:**
- ✅ Event saved successfully
- ✅ Toast notification: "Event created"
- ✅ Event displays in grid
- ✅ POST request payload uses ISO format

---

## Test 4: EventModalSimple - Edit Event

**Steps:**
1. Click existing event
2. EventModalSimple opens
3. Change time from 9am → 10am
4. Click "Save"

**Expected:**
- ✅ Event updated successfully
- ✅ Toast notification: "Event updated"
- ✅ Time change reflects in UI
- ✅ PATCH request uses ISO format

---

## Test 5: Timezone Handling

**Steps:**
1. Create event at 2pm local time
2. Check browser console for ISO string
3. Verify in database

**Expected:**
- If local timezone is EST (UTC-5):
  - Local: 2:00 PM EST
  - ISO: 2025-11-25T19:00:00.000Z (UTC)
  - Database stores: 19:00:00 UTC
- When displayed: Shows 2:00 PM local time again

---

## Test 6: Error Handling

**Steps:**
1. Open browser dev tools → Network tab
2. Break the network (go offline)
3. Try to create event
4. Go back online
5. Try again

**Expected:**
- ✅ Offline: Error alert appears
- ✅ Modal stays open (doesn't close on error)
- ✅ Button shows "Creating..." while submitting
- ✅ Online: Event creates successfully

---

## Test 7: Concurrent User Test

**Steps:**
1. Open calendar in two browser tabs (same user)
2. Tab 1: Create event "Meeting A"
3. Tab 2: Should show "Meeting A" (realtime update)
4. Tab 2: Create event "Meeting B"
5. Tab 1: Should show "Meeting B" (realtime update)

**Expected:**
- ✅ Both events appear in both tabs
- ✅ No duplicate events
- ✅ Realtime updates work correctly

---

## Test 8: API Direct Test (curl)

**Test valid ISO format:**
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "calendar_id": "YOUR_CALENDAR_ID",
    "title": "Test Event",
    "starts_at": "2025-11-25T13:00:00.000Z",
    "ends_at": "2025-11-25T14:00:00.000Z",
    "all_day": false
  }'
```

**Expected:** HTTP 201 Created, returns `{ ok: true, id: "..." }`

**Test invalid datetime-local format:**
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "calendar_id": "YOUR_CALENDAR_ID",
    "title": "Test Event",
    "starts_at": "2025-11-25T13:00",
    "ends_at": "2025-11-25T14:00",
    "all_day": false
  }'
```

**Expected:** HTTP 400 Bad Request, error: "Invalid ISO datetime"

---

## Test 9: Edge Cases

### All-day events
1. Create event with `all_day: true`
2. Verify times are midnight boundaries in UTC

### Cross-day events
1. Create event: Start 11pm today, End 1am tomorrow
2. Verify spans two days in UI

### Past events
1. Create event dated last week
2. Verify accepts past dates

### Far future events
1. Create event dated next year
2. Verify accepts future dates

---

## Validation Checklist

After all tests:
- [ ] No console errors
- [ ] All POST/PATCH requests use ISO format
- [ ] Events persist after page refresh
- [ ] Timezone conversions correct
- [ ] UI updates reflect database state
- [ ] Realtime subscriptions working
- [ ] Error handling graceful

---

## Rollback Plan

If issues found:
1. Git revert changes to QuickAddModal and EventModalSimple
2. Remove src/lib/datetime.ts
3. Investigate why fix didn't work
4. Re-apply fix with additional logging

---

## Performance Check

Monitor for performance impact:
- [ ] Modal open time: < 100ms
- [ ] Event creation: < 500ms
- [ ] No memory leaks (check dev tools memory profiler)
- [ ] No excessive re-renders (React DevTools Profiler)

---

## Sign-off

**Tested by:** _________________
**Date:** _________________
**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________
