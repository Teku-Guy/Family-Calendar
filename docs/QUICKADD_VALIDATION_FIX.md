# QuickAdd Feature - Required Validation Fix

## Issue

API currently allows events with end time before start time. While the database schema doesn't enforce this constraint, the API validation layer should catch it before insertion.

## Current Behavior

```typescript
// User creates event
{
  starts_at: "2025-11-26T15:00:00Z",  // 3pm
  ends_at: "2025-11-26T14:00:00Z",    // 2pm ❌ Before start!
}

// API accepts it ❌
// Database stores it ❌
// User sees broken event in UI
```

## Required Fix

### File: `src/lib/validation/events.ts`

**Current Code (Line 7-16):**
```typescript
export const eventCreateSchema = z.object({
  calendar_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  location: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  all_day: z.boolean().optional(),
});
```

**Fixed Code:**
```typescript
export const eventCreateSchema = z.object({
  calendar_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  location: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  all_day: z.boolean().optional(),
}).refine(
  (data) => new Date(data.ends_at) > new Date(data.starts_at),
  {
    message: 'Event end time must be after start time',
    path: ['ends_at']
  }
);
```

**Also Update (Line 19-30):**
```typescript
export const eventUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  location: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  all_day: z.boolean().optional(),
}).refine(
  (data) => {
    // Only validate if both starts_at and ends_at are provided
    if (data.starts_at && data.ends_at) {
      return new Date(data.ends_at) > new Date(data.starts_at);
    }
    return true;
  },
  {
    message: 'Event end time must be after start time',
    path: ['ends_at']
  }
);
```

## New Behavior

```typescript
// User creates invalid event
{
  starts_at: "2025-11-26T15:00:00Z",
  ends_at: "2025-11-26T14:00:00Z",
}

// API rejects it ✅
Response: {
  error: "Event end time must be after start time",
  status: 400
}

// User sees error message in QuickAddModal ✅
// Event not created ✅
```

## Testing

### Before Fix
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "calendar_id": "6c3c699d-06cb-46a3-8685-ac1b76ecf523",
    "title": "Invalid Event",
    "starts_at": "2025-11-26T15:00:00.000Z",
    "ends_at": "2025-11-26T14:00:00.000Z"
  }'

# Expected: ❌ Creates event (bug)
```

### After Fix
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "calendar_id": "6c3c699d-06cb-46a3-8685-ac1b76ecf523",
    "title": "Invalid Event",
    "starts_at": "2025-11-26T15:00:00.000Z",
    "ends_at": "2025-11-26T14:00:00.000Z"
  }'

# Expected: ✅ 400 Bad Request
# Response: {"error": "Event end time must be after start time"}
```

## Integration Test

Add to `scripts/test_integration_comprehensive.ts`:

```typescript
async function testEndBeforeStartValidation() {
  const calendarId = await getPrimaryCalendar();

  const invalidEvent = {
    calendar_id: calendarId,
    title: 'End Before Start Test',
    starts_at: '2025-11-26T15:00:00.000Z',
    ends_at: '2025-11-26T14:00:00.000Z', // Before start!
  };

  // Via API (should be blocked by Zod validation)
  const response = await fetch('http://localhost:3000/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidEvent),
  });

  if (response.ok) {
    throw new Error('API should have rejected end-before-start event');
  }

  const error = await response.json();
  if (!error.error.includes('end time must be after start time')) {
    throw new Error(`Wrong error message: ${error.error}`);
  }

  console.log('✅ End-before-start validation working');
}
```

## UI Impact

### QuickAddModal

The modal already handles API errors correctly:

```typescript
// src/components/calendar/QuickAddModal.tsx:221-224
if (!response.ok) {
  throw new Error('Failed to create event');
}
```

When the API returns a 400 error, the user will see:
- Alert: "Failed to create event. Please try again."
- Event not added to calendar
- Modal remains open for correction

### Improvement (Optional)

Show more specific error message:

```typescript
try {
  const response = await fetch('/api/events', { ... });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create event');
  }
} catch (error) {
  console.error('[QuickAddModal] Create error:', error);
  alert(error.message); // Now shows specific validation error
}
```

## Deployment Steps

1. **Apply Fix:**
   ```bash
   # Edit src/lib/validation/events.ts
   # Add .refine() to eventCreateSchema and eventUpdateSchema
   ```

2. **Test Locally:**
   ```bash
   # Run test suite
   bunx tsx scripts/test_integration_comprehensive.ts

   # Manual test via curl (shown above)
   ```

3. **Verify in UI:**
   ```bash
   # Start dev server
   bun run dev

   # Open QuickAddModal
   # Manually set end time before start time
   # Verify error message appears
   ```

4. **Deploy:**
   ```bash
   git add src/lib/validation/events.ts
   git commit -m "fix: add end-before-start validation for events"
   git push
   ```

## Estimated Effort

- Code change: 5 minutes
- Testing: 5 minutes
- Total: 10 minutes

## Priority

**MEDIUM** - Should be fixed before production deployment, but not blocking.

## Related Files

- `src/lib/validation/events.ts` - Validation schemas (FIX HERE)
- `src/app/api/events/route.ts` - POST handler (uses schema)
- `src/components/calendar/QuickAddModal.tsx` - UI (handles errors)
- `scripts/test_integration_comprehensive.ts` - Tests

## Rollback Plan

If this change causes issues:

1. Remove `.refine()` from schemas
2. Redeploy previous version
3. Investigate and fix in separate PR

---

**Status:** Ready to implement
**Approved By:** Integration test suite
**Next Action:** Apply fix and retest
