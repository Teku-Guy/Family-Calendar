# Testing Google Calendar Integration (Sprint 4C)

This document provides a comprehensive testing guide for the Google Calendar two-way sync implementation.

## Test Results Summary

### Initial Test Run

**Date:** October 17, 2025
**Test Script:** `scripts/test-google-sync.ts`
**Result:** 6 passed, 6 failed, 1 skipped

### Critical Issues Found

1. **Missing Database Schema**
   - `events` table missing external sync columns:
     - `external_id` - Google event ID
     - `external_etag` - For conflict detection
     - `external_updated_at` - Last modified time
     - `external_source` - Provider identifier ('google', 'outlook', null)
   - `google_accounts` table missing (stores OAuth tokens)
   - `google_calendars` table missing (stores calendar metadata)
   - `sync_runs` table missing (audit log)
   - `sync_state` table missing (delta sync tokens)

2. **Missing API Endpoint**
   - `/api/google/calendar-list` endpoint not implemented
   - Required for fetching and managing Google Calendar selection

3. **Test Script Issues**
   - `/api/events` endpoint requires `from` and `to` query parameters
   - Test script needs to provide these when testing

### Fixes Applied

✅ **Created Database Migration** (`supabase/migrations/003_add_google_calendar_sync.sql`)
- Adds all required columns to `events` table
- Creates `google_accounts` table with RLS policies
- Creates `google_calendars` table with RLS policies
- Creates `sync_runs` table for observability
- Creates `sync_state` table for delta sync
- Adds indexes for performance
- Adds triggers for `updated_at` columns

✅ **Created Calendar List API** (`src/app/api/google/calendar-list/route.ts`)
- GET endpoint: Fetches Google Calendars and stores metadata
- PATCH endpoint: Updates calendar selection state

✅ **Created Integration Test Suite** (`scripts/test-google-sync.ts`)
- Tests database schema
- Tests environment configuration
- Tests OAuth tokens
- Tests API endpoints
- Tests dry-run safety controls
- Tests event CRUD operations

---

## Prerequisites

Before running tests, ensure the following are complete:

### 1. Apply Database Migration

**REQUIRED:** Run the migration in Supabase SQL Editor:

```bash
# Copy the contents of this file:
supabase/migrations/003_add_google_calendar_sync.sql

# Paste into Supabase SQL Editor and execute
```

**How to access Supabase SQL Editor:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Paste the migration SQL
5. Click "Run"

### 2. Configure Environment Variables

Ensure `.env.local` contains:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/oauth/callback

# JWT Secret
DEVICE_JWT_SECRET=random-long-string

# Base URL
PUBLIC_BASE_URL=http://localhost:3000

# Safety Controls (Sprint 4B)
GOOGLE_SYNC_DRY_RUN=true
ALLOW_GOOGLE_WRITES=false
GOOGLE_WRITE_ALLOWLIST=
```

### 3. Start Development Server

```bash
npm run dev
# or
bun run dev
```

### 4. Sign In to Application

1. Visit http://localhost:3000
2. Sign in with your account
3. This will create your primary calendar

---

## Running Tests

### Automated Integration Tests

```bash
bunx tsx scripts/test-google-sync.ts
```

**Expected output after migration:**
```
✅ Passed:   12+
❌ Failed:   0
⏭️  Skipped:  1-2 (OAuth not connected yet)
⚠️  Warnings: 1 (safety controls enabled)
```

### Manual Test Checklist

#### Phase 1: OAuth Setup

- [ ] Visit http://localhost:3000/api/google/oauth/start
- [ ] Sign in with Google account
- [ ] Grant calendar permissions (calendar.events scope)
- [ ] Verify redirect to callback
- [ ] Check `google_accounts` table has a row for your user

**Verification SQL:**
```sql
SELECT user_id, email, scope, expires_at
FROM google_accounts
WHERE user_id = '<your-user-id>';
```

#### Phase 2: Calendar List Fetch

- [ ] Call `GET /api/google/calendar-list`
- [ ] Verify response contains your Google Calendars
- [ ] Check `google_calendars` table populated
- [ ] Test calendar selection with `PATCH /api/google/calendar-list`

**Test with curl:**
```bash
curl -X GET http://localhost:3000/api/google/calendar-list \
  -H "Cookie: <session-cookie>"
```

#### Phase 3: Pull Sync (Google → Local)

- [ ] Create a test event on Google Calendar
- [ ] Call `POST /api/google/sync`
- [ ] Verify event appears in `events` table
- [ ] Check `external_id`, `external_etag`, `external_source` are set
- [ ] Check `sync_runs` table has entry with stats

**Test with curl:**
```bash
curl -X POST http://localhost:3000/api/google/sync \
  -H "Cookie: <session-cookie>"
```

**Verification SQL:**
```sql
SELECT id, title, external_id, external_source
FROM events
WHERE external_source = 'google'
ORDER BY created_at DESC
LIMIT 10;
```

#### Phase 4: Delta Sync

- [ ] Edit event on Google Calendar (change title)
- [ ] Run sync again
- [ ] Verify local event updated
- [ ] Check `external_etag` changed

#### Phase 5: Push Flow (Dry-Run)

**Safety Check:** Ensure `GOOGLE_SYNC_DRY_RUN=true` in `.env.local`

- [ ] Create demo events: `bunx tsx scripts/seed-demo-events.ts`
- [ ] Call push API for one event
- [ ] Verify response has `simulated: true`
- [ ] Check Google Calendar - NO events should appear (dry-run)

**Test with curl:**
```bash
# Get event ID from database first
EVENT_ID="<your-event-id>"

curl -X POST http://localhost:3000/api/google/push/$EVENT_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"op":"create"}'

# Expected response:
# {
#   "success": true,
#   "operation": "create",
#   "simulated": true,
#   "note": "Dry-run mode enabled..."
# }
```

#### Phase 6: Push Flow (Real Writes)

**⚠️ WARNING:** This will make real changes to Google Calendar

**Enable writes:**
```bash
# Edit .env.local:
GOOGLE_SYNC_DRY_RUN=false
ALLOW_GOOGLE_WRITES=true
GOOGLE_WRITE_ALLOWLIST=<your-user-id>

# Restart dev server
```

- [ ] Create local event
- [ ] Push to Google: `POST /api/google/push/:id` with `{"op":"create"}`
- [ ] Verify event appears on Google Calendar
- [ ] Check `external_id` set on local event
- [ ] Edit local event
- [ ] Push update: `POST /api/google/push/:id` with `{"op":"update"}`
- [ ] Verify changes on Google Calendar
- [ ] Delete local event
- [ ] Push delete: `POST /api/google/push/:id` with `{"op":"delete"}`
- [ ] Verify deletion on Google Calendar

#### Phase 7: Conflict Detection

- [ ] Create local event and push to Google
- [ ] Edit event on Google (change title to "Version A")
- [ ] Edit same event locally (change title to "Version B")
- [ ] Try to push local changes
- [ ] Verify conflict detected
- [ ] Check resolution applied (last-writer-wins)
- [ ] Verify final title is "Version B" on both sides

#### Phase 8: Error Handling

**Token Expiration:**
- [ ] Manually expire token in database
- [ ] Try to sync or push
- [ ] Verify token auto-refreshes
- [ ] Check `google_accounts.expires_at` updated

**Rate Limiting:**
- [ ] Rapidly create/update 100+ events
- [ ] Verify automatic retry with backoff
- [ ] Check logs for "[backoff] Waiting..." messages

**Invalid Grant:**
- [ ] Delete `google_accounts` row
- [ ] Try to sync
- [ ] Verify error response with `action: "reconnect"`

---

## Test Metrics

### Performance Benchmarks

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| OAuth Flow | < 5s | TBD | ⏳ |
| Calendar List Fetch | < 2s | TBD | ⏳ |
| Pull Sync (100 events) | < 5s | TBD | ⏳ |
| Push Create | < 1s | TBD | ⏳ |
| Push Update | < 1s | TBD | ⏳ |
| Push Delete | < 1s | TBD | ⏳ |
| Delta Sync | < 2s | TBD | ⏳ |

### Error Rate Targets

| Error Type | Target | Actual | Status |
|------------|--------|--------|--------|
| Token Refresh Failure | < 0.1% | TBD | ⏳ |
| Conflict Detection | 100% | TBD | ⏳ |
| Push Retry Success | > 95% | TBD | ⏳ |
| RLS Policy Errors | 0 | TBD | ⏳ |

---

## Known Issues

### Issue 1: Stack Depth Limit Exceeded (RLS Recursion)

**Status:** KNOWN
**Severity:** HIGH
**Affected:** `/api/events` endpoint in some cases

**Symptoms:**
- Error: "stack depth limit exceeded"
- Happens with complex RLS policies

**Workaround:**
- Apply simplified RLS policies from `fixes/stack-depth-rls-recursion/COMPLETE_RLS_POLICIES.sql`

**Permanent Fix:**
- Refactor RLS policies to avoid recursive checks
- Use membership-based access control instead of nested subqueries

### Issue 2: Calendar List Endpoint Not Found (Before Migration)

**Status:** FIXED
**Fix:** Created `/api/google/calendar-list/route.ts`

### Issue 3: Missing External Sync Columns (Before Migration)

**Status:** FIXED
**Fix:** Applied `003_add_google_calendar_sync.sql` migration

---

## Observability

### Monitoring Sync Operations

```sql
-- Recent sync runs
SELECT
  id,
  direction,
  status,
  started_at,
  completed_at,
  stats
FROM sync_runs
WHERE user_id = '<your-user-id>'
ORDER BY started_at DESC
LIMIT 10;
```

### Monitoring Google Events

```sql
-- Events synced from Google
SELECT
  id,
  title,
  external_id,
  external_source,
  external_updated_at,
  created_at
FROM events
WHERE external_source = 'google'
ORDER BY created_at DESC;
```

### Monitoring Token Health

```sql
-- Check token expiration
SELECT
  email,
  expires_at,
  (expires_at > now()) as is_valid,
  (expires_at - now()) as time_remaining
FROM google_accounts
WHERE user_id = '<your-user-id>';
```

---

## Troubleshooting

### "google_accounts table not found"

**Cause:** Migration not applied
**Fix:** Run `003_add_google_calendar_sync.sql` in Supabase SQL Editor

### "Could not find external_id column"

**Cause:** Migration not applied
**Fix:** Run `003_add_google_calendar_sync.sql` in Supabase SQL Editor

### "Unauthorized" on /api/google/* endpoints

**Cause:** Not signed in or session expired
**Fix:** Sign in to the app first

### "Google Calendar not connected or token expired"

**Cause:** No OAuth token or token expired
**Fix:** Visit `/api/google/oauth/start` to connect Google account

### Push returns simulated: true even with writes enabled

**Cause:** One of the safety flags is blocking writes
**Check:**
- `GOOGLE_SYNC_DRY_RUN=false`
- `ALLOW_GOOGLE_WRITES=true`
- User ID in `GOOGLE_WRITE_ALLOWLIST` (if set)

### Events not syncing

**Debug steps:**
1. Check `sync_runs` table for errors
2. Check token expiration in `google_accounts`
3. Check calendar selection in `google_calendars`
4. Check server logs for API errors

---

## Next Steps

After all tests pass:

1. **UI Integration**
   - Add sync button to calendar UI
   - Show sync status indicators
   - Add calendar selection UI
   - Display dry-run badges

2. **Automated Tests**
   - Create Vitest integration tests
   - Mock Google API with MSW
   - Add CI/CD pipeline

3. **Production Readiness**
   - Load testing with 1000+ events
   - Monitor quota usage
   - Set up error tracking (Sentry)
   - Create runbooks for common issues

4. **Sprint 5 Preview**
   - Recurring events (RRULE) integration
   - Push notifications (channels.watch)
   - Multi-provider support (Outlook, Apple)

---

## Test Log Template

Use this template to document manual test results:

```markdown
## Test Session: [Date/Time]

**Tester:** [Your Name]
**Environment:** Development
**Commit:** [Git commit hash]

### Phase 1: OAuth Setup
- [ ] PASS/FAIL - OAuth flow completed
- Notes:

### Phase 2: Calendar List
- [ ] PASS/FAIL - Fetched calendars
- Notes:

### Phase 3: Pull Sync
- [ ] PASS/FAIL - Initial sync
- [ ] PASS/FAIL - Delta sync
- Notes:

### Phase 4: Push Flow (Dry-Run)
- [ ] PASS/FAIL - Create simulated
- [ ] PASS/FAIL - Update simulated
- [ ] PASS/FAIL - Delete simulated
- Notes:

### Phase 5: Push Flow (Real)
- [ ] PASS/FAIL - Create
- [ ] PASS/FAIL - Update
- [ ] PASS/FAIL - Delete
- Notes:

### Phase 6: Conflict Detection
- [ ] PASS/FAIL - Conflict detected
- [ ] PASS/FAIL - Resolution applied
- Notes:

### Phase 7: Error Handling
- [ ] PASS/FAIL - Token refresh
- [ ] PASS/FAIL - Rate limiting
- Notes:

### Issues Found
1. [Issue description]
   - Severity: HIGH/MEDIUM/LOW
   - Repro steps:
   - Workaround:

### Summary
Overall Status: PASS/FAIL
Blockers: [List any blockers]
Recommendations: [List recommendations]
```

---

## Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/v3/reference)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Sprint 4B Implementation Doc](./google-two-way.md)
- [Test Script Source](../scripts/test-google-sync.ts)
- [Database Migration](../supabase/migrations/003_add_google_calendar_sync.sql)
