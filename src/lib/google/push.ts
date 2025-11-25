/**
 * Google Calendar Push Helpers
 *
 * Functions for pushing local events to Google Calendar (two-way sync)
 *
 * Safety Controls:
 * - GOOGLE_SYNC_DRY_RUN=true: Simulates writes without touching Google Calendar
 * - ALLOW_GOOGLE_WRITES=false: Master kill-switch, disables all writes
 * - GOOGLE_WRITE_ALLOWLIST: Optional comma-separated user IDs allowed to write
 */

import { googleFetch } from '@/lib/google';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Safety flags from environment
const DRY_RUN = process.env.GOOGLE_SYNC_DRY_RUN === 'true';
const MASTER_ENABLED = process.env.ALLOW_GOOGLE_WRITES === 'true';
const ALLOWLIST = (process.env.GOOGLE_WRITE_ALLOWLIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Check if writes are allowed for a given user
 */
export function canWrite(userId: string): boolean {
  // Dry-run mode always disables writes
  if (DRY_RUN) {
    console.log('[canWrite] Dry-run mode enabled, writes disabled');
    return false;
  }

  // Master kill-switch
  if (!MASTER_ENABLED) {
    console.log('[canWrite] Master writes disabled (ALLOW_GOOGLE_WRITES=false)');
    return false;
  }

  // Check allowlist if configured
  if (ALLOWLIST.length > 0 && !ALLOWLIST.includes(userId)) {
    console.log(`[canWrite] User ${userId} not in allowlist, writes disabled`);
    return false;
  }

  console.log(`[canWrite] User ${userId} allowed to write`);
  return true;
}

/**
 * Simulate push operation if writes are disabled
 * Returns null if writes are enabled (proceed with real API call)
 * Returns simulated result if writes are disabled
 */
export async function maybeSimulatePush(
  userId: string,
  op: 'create' | 'update' | 'delete',
  event: any
): Promise<{
  simulated: true;
  op: string;
  eventId: string;
  external_id?: string;
  external_etag?: string;
  external_updated_at?: string;
  note: string;
} | null> {
  if (canWrite(userId)) {
    return null; // Proceed with real Google API calls
  }

  // Simulate successful push
  const simulated = {
    simulated: true as const,
    op,
    eventId: event?.id || 'unknown',
    note: DRY_RUN
      ? 'Dry-run mode enabled (GOOGLE_SYNC_DRY_RUN=true)'
      : !MASTER_ENABLED
      ? 'Writes disabled (ALLOW_GOOGLE_WRITES=false)'
      : `User not in allowlist`,
  };

  // Add simulated Google metadata for create/update operations
  if (op === 'create' || op === 'update') {
    return {
      ...simulated,
      external_id: event?.external_id || `simulated_${Date.now()}`,
      external_etag: `"simulated_${Date.now()}"`,
      external_updated_at: new Date().toISOString(),
    };
  }

  return simulated;
}

/**
 * Convert local event to Google Calendar event format
 */
export function toGoogleBody(event: any): any {
  const body: any = {
    summary: event.title || '(No title)',
    location: event.location || undefined,
    description: event.description || undefined,
  };

  // Handle all-day events
  if (event.all_day) {
    // All-day events use date (not dateTime)
    body.start = { date: event.starts_at.slice(0, 10) };
    body.end = { date: event.ends_at.slice(0, 10) };
  } else {
    // Timed events use dateTime with timezone
    body.start = { dateTime: event.starts_at };
    body.end = { dateTime: event.ends_at };
  }

  // Add RRULE if present (recurring events)
  if (event.rrule) {
    body.recurrence = [event.rrule];
  }

  // Add color if present
  if (event.color) {
    // Google uses colorId (1-11), but we'll store hex colors
    // For now, we'll skip color mapping - can be added later
  }

  return body;
}

/**
 * Convert Google event response back to local format
 */
export function fromGoogleResponse(gEvent: any): {
  external_id: string;
  external_etag: string;
  external_updated_at: string;
  external_source: string;
} {
  return {
    external_id: gEvent.id,
    external_etag: gEvent.etag,
    external_updated_at: gEvent.updated,
    external_source: 'google',
  };
}

/**
 * Insert a new event to Google Calendar
 */
export async function googleInsert(
  calendarId: string,
  event: any
): Promise<{ id: string; etag: string; updated: string }> {
  const body = toGoogleBody(event);

  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
    calendarId
  )}/events?conferenceDataVersion=0`;

  const response = await googleFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('googleInsert failed:', errorText);
    throw new Error(`Failed to insert event to Google: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  return {
    id: result.id,
    etag: result.etag,
    updated: result.updated,
  };
}

/**
 * Update an existing event on Google Calendar
 */
export async function googlePatch(
  calendarId: string,
  externalId: string,
  event: any,
  expectedEtag?: string
): Promise<{ id: string; etag: string; updated: string; conflict?: boolean }> {
  const body = toGoogleBody(event);

  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
    calendarId
  )}/events/${encodeURIComponent(externalId)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add If-Match header for optimistic concurrency control
  if (expectedEtag) {
    headers['If-Match'] = expectedEtag;
  }

  const response = await googleFetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  // Handle 412 Precondition Failed (etag mismatch - conflict)
  if (response.status === 412) {
    return {
      id: externalId,
      etag: '',
      updated: '',
      conflict: true,
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('googlePatch failed:', errorText);
    throw new Error(`Failed to update event on Google: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  // Check if etag changed unexpectedly (concurrent edit detected)
  const conflict = !!expectedEtag && result.etag !== expectedEtag;

  return {
    id: result.id,
    etag: result.etag,
    updated: result.updated,
    conflict,
  };
}

/**
 * Delete an event from Google Calendar
 */
export async function googleDelete(
  calendarId: string,
  externalId: string
): Promise<{ success: boolean; notFound?: boolean }> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
    calendarId
  )}/events/${encodeURIComponent(externalId)}`;

  const response = await googleFetch(url, {
    method: 'DELETE',
  });

  // 204 No Content = success
  if (response.status === 204) {
    return { success: true };
  }

  // 404 Not Found = already deleted (idempotent)
  if (response.status === 404) {
    console.log(`Event ${externalId} already deleted from Google`);
    return { success: true, notFound: true };
  }

  // 410 Gone = calendar no longer exists
  if (response.status === 410) {
    console.log(`Calendar no longer exists for event ${externalId}`);
    return { success: true, notFound: true };
  }

  const errorText = await response.text();
  console.error('googleDelete failed:', errorText);
  throw new Error(`Failed to delete event from Google: ${response.status} ${errorText}`);
}

/**
 * Get a specific event from Google Calendar (for conflict resolution)
 */
export async function googleGetEvent(
  calendarId: string,
  externalId: string
): Promise<any | null> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
    calendarId
  )}/events/${encodeURIComponent(externalId)}`;

  const response = await googleFetch(url, {
    method: 'GET',
  });

  if (response.status === 404 || response.status === 410) {
    return null; // Event deleted or calendar gone
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('googleGetEvent failed:', errorText);
    throw new Error(`Failed to get event from Google: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Backoff helper for rate limiting
 */
export async function backoffDelay(attempt: number): Promise<void> {
  // Exponential backoff: 1s, 2s, 4s, 8s with jitter
  const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
  const jitter = Math.random() * 1000;
  const delay = baseDelay + jitter;

  console.log(`[backoff] Waiting ${Math.round(delay)}ms before retry (attempt ${attempt})`);

  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Retry wrapper for Google API calls with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable (429 Too Many Requests, 5xx server errors)
      const errorMsg = lastError.message.toLowerCase();
      const isRetryable =
        errorMsg.includes('429') ||
        errorMsg.includes('500') ||
        errorMsg.includes('502') ||
        errorMsg.includes('503') ||
        errorMsg.includes('504');

      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      console.warn(`[retry] Attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);
      await backoffDelay(attempt);
    }
  }

  throw lastError || new Error('Retry failed');
}
