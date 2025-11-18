# Google Calendar Two-Way Sync (Sprint 4B)

## Overview

Sprint 4B implements full two-way synchronization between the Family Calendar app and Google Calendar. Local event changes (create, update, delete) are automatically pushed to Google Calendar, with conflict detection and resolution.

## 🛡️ Safety Features

**Sprint 4B includes comprehensive safety controls to prevent accidental writes during development:**

### Environment Variables (.env.local)

```bash
# Dry-run mode: When true, simulates writes without touching Google Calendar
# Recommended: true in dev, false in production after testing
GOOGLE_SYNC_DRY_RUN=true

# Master kill-switch: When false, ALL push writes are disabled
# Recommended: false until you've tested thoroughly with dry-run
ALLOW_GOOGLE_WRITES=false

# Optional: Comma-separated list of user IDs allowed to push
# When set, only these users can perform real writes
# Leave empty to allow all users (when ALLOW_GOOGLE_WRITES=true)
GOOGLE_WRITE_ALLOWLIST=
```

### Safety Logic

1. **Dry-Run Mode** (`GOOGLE_SYNC_DRY_RUN=true`)
   - Push API simulates all operations
   - Returns `{ simulated: true }` without calling Google Calendar API
   - Logs operations but makes no external changes
   - **Default: enabled in dev**

2. **Master Kill-Switch** (`ALLOW_GOOGLE_WRITES=false`)
   - Global disable for all push operations
   - Overrides dry-run setting
   - Use as emergency shutoff
   - **Default: disabled**

3. **User Allowlist** (`GOOGLE_WRITE_ALLOWLIST`)
   - Optional whitelist of user IDs
   - Only listed users can perform real writes
   - Others see dry-run simulation
   - Useful for staged rollout

### Testing Progression

```bash
# Phase 1: Safe testing (recommended)
GOOGLE_SYNC_DRY_RUN=true
ALLOW_GOOGLE_WRITES=false
# Result: All writes simulated, no Google Calendar changes

# Phase 2: Enable master switch, keep dry-run
GOOGLE_SYNC_DRY_RUN=true
ALLOW_GOOGLE_WRITES=true
# Result: Still simulated (dry-run takes precedence)

# Phase 3: Test with specific user
GOOGLE_SYNC_DRY_RUN=false
ALLOW_GOOGLE_WRITES=true
GOOGLE_WRITE_ALLOWLIST=<your-user-id>
# Result: Only your user can push, others simulated

# Phase 4: Production (after thorough testing)
GOOGLE_SYNC_DRY_RUN=false
ALLOW_GOOGLE_WRITES=true
GOOGLE_WRITE_ALLOWLIST=
# Result: All users can push to Google Calendar
```

## Architecture

### Components

1. **Push Helper Functions** (`src/lib/google/push.ts`)
   - `googleInsert()` - Create events on Google Calendar
   - `googlePatch()` - Update events on Google Calendar with etag support
   - `googleDelete()` - Delete events from Google Calendar
   - `googleGetEvent()` - Fetch event from Google (for conflict resolution)
   - `retryWithBackoff()` - Automatic retry with exponential backoff

2. **Push API Endpoint** (`src/app/api/google/push/[id]/route.ts`)
   - POST `/api/google/push/[id]` - Push local changes to Google
   - Body: `{ op: 'create' | 'update' | 'delete', googleCalendarId?: string }`
   - Handles idempotency, conflict detection, and automatic pull sync

3. **OAuth Scopes** (Updated in `src/app/api/google/oauth/start/route.ts`)
   - `calendar.events` - Read and write access to events (replaces readonly scopes)

### Data Flow

#### Outbound (Local → Google)

```
Local Event Change
    ↓
POST /api/google/push/[id] { op: 'create'|'update'|'delete' }
    ↓
googleInsert/Patch/Delete
    ↓
Update local event with external_id, external_etag, external_updated_at
    ↓
Trigger POST /api/google/sync (pull delta)
    ↓
Reconcile state
```

#### Inbound (Google → Local)

```
User changes event on Google Calendar
    ↓
POST /api/google/sync (manual or scheduled)
    ↓
Query Google Calendar events with syncToken (delta)
    ↓
Compare external_etag + external_updated_at
    ↓
Update local events if newer
```

## Database Schema

### Required Columns on `events` table

```sql
-- These columns should already exist from Sprint 4A
external_id text                 -- Google event ID (e.g., "abc123xyz")
external_etag text              -- Google etag for conflict detection
external_updated_at timestamptz -- Last modified time on Google
external_source text            -- 'google' | 'outlook' | null
```

### Event Ownership Rules

1. **Local-owned events:** `external_source IS NULL`
   - Can be pushed to Google at any time
   - Becomes Google-owned after first push

2. **Google-owned events:** `external_source = 'google'`
   - Can be updated if we have the latest etag
   - Conflicts trigger resolution flow

3. **Other external sources:** `external_source = 'outlook'`
   - Cannot be pushed to Google (prevents cross-contamination)

## API Reference

### POST /api/google/push/[id]

Push a local event change to Google Calendar.

**Request:**
```json
{
  "op": "create" | "update" | "delete",
  "googleCalendarId": "primary" // Optional, defaults to "primary"
}
```

**Response (Success - Real Write):**
```json
{
  "success": true,
  "operation": "create",
  "external_id": "abc123xyz",
  "etag": "\"3456789012345\""
}
```

**Response (Success - Dry-Run/Simulated):**
```json
{
  "success": true,
  "operation": "create",
  "simulated": true,
  "note": "Dry-run mode enabled (GOOGLE_SYNC_DRY_RUN=true)",
  "external_id": "simulated_1234567890",
  "etag": "\"simulated_1234567890\""
}
```

**Response (Conflict Detected):**
```json
{
  "success": true,
  "operation": "update",
  "conflict": true,
  "resolution": "last_writer_wins",
  "external_id": "abc123xyz",
  "etag": "\"3456789012346\""
}
```

**Response (Error):**
```json
{
  "error": "Google Calendar not connected or token expired",
  "action": "reconnect"
}
```

### Operations

#### Create

Creates a new event on Google Calendar and stores the returned `id` and `etag` locally.

- **Idempotency:** Uses local event `id` as `requestId` (not yet implemented in current version)
- **Fields mapped:**
  - `title` → `summary`
  - `location` → `location`
  - `starts_at` / `ends_at` → `start.dateTime` / `end.dateTime` (or `date` for all-day)
  - `rrule` → `recurrence` array

#### Update

Updates an existing Google Calendar event using the stored `external_id`.

- **Conflict Detection:** Sends `If-Match: <external_etag>` header
- **On 412 Precondition Failed:** Triggers conflict resolution
- **On Success:** Updates local `external_etag` and `external_updated_at`

#### Delete

Deletes the event from both Google Calendar and local database.

- **Idempotency:** 404 Not Found is treated as success (already deleted)
- **410 Gone:** Calendar no longer exists - treated as success

## Conflict Resolution

### Detection

A conflict is detected when:
1. Google returns HTTP 412 Precondition Failed (etag mismatch)
2. Returned etag differs from expected etag

### Resolution Strategy: Last-Writer-Wins

1. **Pull Latest from Google**
   ```typescript
   const latestGoogleEvent = await googleGetEvent(googleCalendarId, externalId);
   ```

2. **Update Local with Google's Version**
   ```typescript
   await sb.from('events').update({
     external_etag: googleData.external_etag,
     external_updated_at: googleData.external_updated_at,
   }).eq('id', eventId);
   ```

3. **Re-apply User's Changes**
   ```typescript
   await googlePatch(googleCalendarId, externalId, localEvent, googleData.external_etag);
   ```

4. **If Still Conflicting:**
   - Surface error to user
   - Log conflict in console
   - Ask user to refresh and try again

### Alternative Strategies (Not Implemented)

- **First-Writer-Wins:** Reject local changes, keep Google version
- **Manual Resolution:** Show diff UI, let user choose
- **Field-Level Merge:** Merge non-conflicting fields

## Error Handling

### Rate Limiting (429 Too Many Requests)

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('429') && attempt < maxRetries) {
        await backoffDelay(attempt); // Exponential backoff: 1s, 2s, 4s, 8s
        continue;
      }
      throw error;
    }
  }
}
```

### Invalid Grant (Token Expired)

When refresh token fails with `invalid_grant`:

```typescript
if (errorMessage.includes('No valid Google access token')) {
  return NextResponse.json({
    error: 'Google Calendar not connected or token expired',
    action: 'reconnect',
  }, { status: 401 });
}
```

**User Action Required:**
- Show toast: "Google Calendar connection expired. Please reconnect."
- Redirect to `/api/google/oauth/start`

### 410 Gone (Sync Token Expired)

During pull sync, if syncToken is invalid:

```json
{
  "error": {
    "code": 410,
    "message": "Sync token is no longer valid"
  }
}
```

**Resolution:**
- Clear stored syncToken
- Perform full sync (no delta)
- Save new syncToken

## UI Integration

### Example: EventModal with Push

```typescript
'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toaster';

export default function EventModal({ eventId, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  async function handleSave(formData: FormData) {
    setBusy(true);

    try {
      // 1. Save to local database (your existing logic)
      const event = await saveEventToDatabase(formData);

      // 2. Push to Google Calendar
      const pushResponse = await fetch(`/api/google/push/${event.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: eventId ? 'update' : 'create',
        }),
      });

      const pushResult = await pushResponse.json();

      if (!pushResponse.ok) {
        if (pushResult.action === 'reconnect') {
          push({
            title: 'Google Calendar disconnected. Please reconnect.',
            kind: 'error',
          });
          // Optionally redirect to OAuth flow
          // window.location.href = '/api/google/oauth/start';
          return;
        }

        throw new Error(pushResult.error || 'Failed to sync with Google');
      }

      if (pushResult.conflict) {
        push({
          title: 'Conflict detected and resolved',
          kind: 'warning',
        });
      } else {
        push({
          title: 'Event synced to Google Calendar',
          kind: 'success',
        });
      }

      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      push({
        title: error instanceof Error ? error.message : 'Failed to save event',
        kind: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this event?')) return;

    setBusy(true);

    try {
      // Push delete to Google
      const pushResponse = await fetch(`/api/google/push/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'delete',
        }),
      });

      if (!pushResponse.ok) {
        const pushResult = await pushResponse.json();
        throw new Error(pushResult.error || 'Failed to delete from Google');
      }

      push({
        title: 'Event deleted from Google Calendar',
        kind: 'success',
      });

      onClose();
    } catch (error) {
      console.error('Delete failed:', error);
      push({
        title: error instanceof Error ? error.message : 'Failed to delete event',
        kind: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  // ... rest of modal UI
}
```

### Toast States

| State | Message | Kind |
|-------|---------|------|
| Pushing | "Syncing to Google Calendar..." | info |
| Success | "Event synced to Google Calendar" | success |
| Conflict Resolved | "Conflict detected and resolved" | warning |
| Error | "Failed to sync with Google" | error |
| Disconnected | "Google Calendar disconnected. Please reconnect." | error |
| Rate Limited | "Too many requests. Please try again later." | warning |

## Recurring Events

### Current Limitations

For Sprint 4B, recurring events have limited support:

1. **Series Masters:**
   - Can be pushed to Google with `rrule` field
   - Google will expand occurrences
   - Editing the master updates all future occurrences

2. **Individual Instances:**
   - Use Google Calendar API's `instances.patch` endpoint
   - Or create an exception with `recurrence` + `originalStartTime`
   - **Not fully implemented yet** - recommend waiting for Sprint 3 RRULE integration

### Future Enhancements

- Detect if event is a series instance
- Use `instances.patch` for single-occurrence edits
- Map local `series_id` / `original_start` to Google's exception model

## Testing

### Manual Testing Checklist

**Prerequisites:**
- RLS policies applied (`COMPLETE_RLS_POLICIES_FIXED.sql`)
- Google Calendar connected (complete OAuth flow)
- Primary calendar exists in database

**Test 1: Create Event**
```bash
# 1. Create event in UI
# 2. Verify it appears on Google Calendar (google.com/calendar)
# 3. Check database: external_id, external_etag should be set
```

**Test 2: Update Event**
```bash
# 1. Edit event title in UI
# 2. Save
# 3. Verify title updates on Google Calendar
# 4. Check database: external_etag should have changed
```

**Test 3: Delete Event**
```bash
# 1. Delete event in UI
# 2. Verify it's removed from Google Calendar
# 3. Verify it's deleted from database
```

**Test 4: Conflict Resolution**
```bash
# 1. Open event in two browser tabs
# 2. In Tab 1: Change title to "Version A"
# 3. In Tab 2 (before saving Tab 1): Change title to "Version B"
# 4. Save Tab 1 first
# 5. Save Tab 2 second
# Expected: Conflict detected, last-writer-wins (Version B)
# 6. Verify on Google Calendar: Title is "Version B"
```

**Test 5: Rate Limiting**
```bash
# 1. Create/update events rapidly (100+ times)
# Expected: Automatic retry with backoff
# 2. Check console for "[backoff] Waiting..." messages
# 3. Eventually succeeds or returns 429 error after max retries
```

**Test 6: Token Expiration**
```bash
# 1. Manually expire token in database:
#    UPDATE google_accounts SET expires_at = '2020-01-01' WHERE user_id = '<your-user-id>';
# 2. Try to create/update event
# Expected: Token auto-refreshes
# 3. If refresh fails: "Google Calendar not connected" error
```

### Automated Tests (Not Yet Implemented)

```typescript
describe('Google Push API', () => {
  it('should create event on Google when local event is created', async () => {
    // ...
  });

  it('should update event on Google when local event is updated', async () => {
    // ...
  });

  it('should delete event from Google when local event is deleted', async () => {
    // ...
  });

  it('should detect and resolve conflicts with last-writer-wins', async () => {
    // ...
  });

  it('should retry on 429 rate limit with exponential backoff', async () => {
    // ...
  });

  it('should refresh token when expired', async () => {
    // ...
  });
});
```

## Security Considerations

### Token Storage

- Access tokens are encrypted using AES-256-GCM (`src/lib/crypto.ts`)
- Refresh tokens are also encrypted
- Tokens are stored in `google_accounts` table with RLS policies

### OAuth Scopes

- `calendar.events` - Full read/write access to calendar events
- **Important:** Users must explicitly grant this scope during OAuth flow
- Users can revoke access at https://myaccount.google.com/permissions

### RLS Policies

```sql
-- Only users can access their own Google accounts
CREATE POLICY google_accounts_select_own ON google_accounts
FOR SELECT USING (user_id = auth.uid());

-- Only users can access their own events
CREATE POLICY events_select_own ON events
FOR SELECT USING (
  calendar_id IN (SELECT id FROM calendars WHERE user_id = auth.uid())
);
```

### Idempotency

- Push operations use event ID as request identifier
- Duplicate requests are safe (won't create duplicates)
- Delete operations are idempotent (404 treated as success)

## Performance Optimization

### Batch Operations (Future)

Instead of pushing one event at a time:

```typescript
// Future implementation
const batch = google.newBatchHttpRequest();
batch.add(insertRequest1);
batch.add(insertRequest2);
batch.add(updateRequest1);
await batch.execute();
```

### Selective Push

Only push events that have changed:

```typescript
// Check if event needs push
const needsPush =
  !event.external_id || // Never pushed
  event.updated_at > event.external_updated_at; // Modified locally

if (needsPush) {
  await pushToGoogle(event);
}
```

### Debouncing

Wait for user to finish editing before pushing:

```typescript
let pushTimeout: NodeJS.Timeout;

function handleEventChange(event: Event) {
  clearTimeout(pushTimeout);
  pushTimeout = setTimeout(() => {
    pushToGoogle(event);
  }, 2000); // Wait 2 seconds after last edit
}
```

## Troubleshooting

### "Google Calendar not connected or token expired"

**Cause:** OAuth token is invalid or expired

**Solution:**
1. Check `google_accounts` table for user's record
2. If missing: Complete OAuth flow at `/api/google/oauth/start`
3. If present but expired: Token should auto-refresh on next request
4. If refresh fails: Delete record and re-connect

### "Failed to sync with Google Calendar"

**Cause:** Network error, API quota exceeded, or invalid request

**Solution:**
1. Check browser console for error details
2. Check server logs for Google API response
3. Verify event data is valid (e.g., `starts_at` < `ends_at`)
4. Check Google Calendar API quota in Google Cloud Console

### "Conflict detected" on every save

**Cause:** Local etag is outdated or out of sync

**Solution:**
1. Trigger a pull sync: `POST /api/google/sync`
2. Verify `external_etag` matches Google's etag
3. If persists: Delete `external_id` and re-push (will create new event)

### Events not appearing on Google Calendar

**Cause:** Push API not being called, or push failed silently

**Solution:**
1. Check browser network tab for `/api/google/push` requests
2. Verify `external_id` is set after create/update
3. Check Google Calendar API permissions in OAuth consent screen

## Acceptance Criteria

- [x] OAuth scopes updated to `calendar.events`
- [x] Push helper functions created with retry logic
- [x] Push API endpoint handles create/update/delete
- [x] Conflict detection using etag
- [x] Last-writer-wins conflict resolution
- [x] Automatic pull sync after push
- [x] Error handling for rate limits, token expiration, etc.
- [ ] UI integration in EventModal (to be implemented)
- [ ] Manual testing completed
- [ ] Documentation created

## Next Steps

1. **UI Integration:** Update EventModal to call push API on save/delete
2. **Batch Operations:** Implement batch requests for multiple events
3. **Recurring Events:** Full support for series editing and instance exceptions
4. **Delta Sync:** Use `syncToken` for efficient pull sync
5. **Conflict UI:** Show diff dialog for manual conflict resolution
6. **Webhooks:** Listen to Google Calendar push notifications for instant updates

## References

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/v3/reference)
- [OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes#calendar)
- [RFC 5545 (iCalendar/RRULE)](https://datatracker.ietf.org/doc/html/rfc5545)
- [HTTP ETags (RFC 7232)](https://datatracker.ietf.org/doc/html/rfc7232)
