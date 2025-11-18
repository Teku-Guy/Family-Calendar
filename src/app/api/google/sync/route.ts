import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { googleFetch } from '@/lib/google';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * Convert a datetime string to UTC, respecting the specified timezone
 *
 * Google Calendar events can have timezone-specific times. This function
 * ensures proper UTC conversion for database storage.
 *
 * ## How Google Calendar Sends Times:
 * - If the datetime string includes an offset (e.g., "2025-10-15T14:00:00-04:00"),
 *   JavaScript Date will parse it correctly to UTC automatically.
 * - The `timeZone` field in the Google API is mainly informational and for recurring
 *   events. For one-time events with ISO 8601 strings that include offsets, we can
 *   rely on Date's built-in parsing.
 *
 * @param isoOrDate - ISO datetime string from Google Calendar
 * @param tz - IANA timezone (optional, used for validation/logging)
 * @returns UTC ISO string
 */
function toUTC(isoOrDate: string, tz?: string): string {
  // JavaScript Date automatically handles ISO 8601 strings with timezone offsets
  // Example: "2025-10-15T14:00:00-04:00" correctly becomes UTC
  const date = new Date(isoOrDate);

  // Validate the parse was successful
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${isoOrDate}, timezone: ${tz}`);
    return new Date().toISOString(); // Fallback to now
  }

  return date.toISOString();
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  recurrence?: string[];
  updated?: string;
}

export async function POST() {
  try {
    const sb = await supabaseServer();
    const { data: { user }, error: authError } = await sb.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's primary calendar ID
    const { data: calendarData, error: calError } = await sb
      .from('calendars')
      .select('id')
      .eq('is_primary', true)
      .limit(1)
      .single();

    if (calError || !calendarData) {
      return NextResponse.json(
        { error: 'No primary calendar found' },
        { status: 404 }
      );
    }

    const primaryCalendarId = calendarData.id;

    // Fetch events from Google Calendar (next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: thirtyDaysFromNow.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const response = await googleFetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Calendar API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch Google Calendar events' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const googleEvents: GoogleCalendarEvent[] = data.items || [];

    let imported = 0;
    let skipped = 0;

    for (const gEvent of googleEvents) {
      // Skip events without times
      if (!gEvent.start || (!gEvent.start.dateTime && !gEvent.start.date)) {
        skipped++;
        continue;
      }

      if (!gEvent.end || (!gEvent.end.dateTime && !gEvent.end.date)) {
        skipped++;
        continue;
      }

      // Determine if all-day event
      const allDay = !!gEvent.start.date;

      // Convert times to UTC, respecting event timezones
      const startTZ = gEvent.start?.timeZone;
      const endTZ = gEvent.end?.timeZone;

      const startsAt = gEvent.start.dateTime
        ? toUTC(gEvent.start.dateTime, startTZ)
        : gEvent.start.date
        ? `${gEvent.start.date}T00:00:00.000Z`
        : '';

      const endsAt = gEvent.end.dateTime
        ? toUTC(gEvent.end.dateTime, endTZ)
        : gEvent.end.date
        ? `${gEvent.end.date}T00:00:00.000Z`
        : '';

      // Check if this event already exists (by source_id)
      const { data: existing } = await sb
        .from('events')
        .select('id, source_updated_at')
        .eq('source', 'google')
        .eq('source_id', gEvent.id)
        .single();

      const googleUpdatedAt = gEvent.updated || new Date().toISOString();

      if (existing) {
        // Check if we need to update
        const existingUpdated = new Date(existing.source_updated_at || 0);
        const googleUpdated = new Date(googleUpdatedAt);

        if (googleUpdated <= existingUpdated) {
          skipped++;
          continue; // Already up-to-date
        }

        // Update existing event
        const { error: updateError } = await sb
          .from('events')
          .update({
            title: gEvent.summary || '(No title)',
            description: gEvent.description || null,
            location: gEvent.location || null,
            starts_at: startsAt,
            ends_at: endsAt,
            all_day: allDay,
            rrule: gEvent.recurrence ? gEvent.recurrence[0] : null,
            source_updated_at: googleUpdatedAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Failed to update event:', updateError);
          skipped++;
        } else {
          imported++;
        }
      } else {
        // Insert new event
        const { error: insertError } = await sb
          .from('events')
          .insert({
            calendar_id: primaryCalendarId,
            title: gEvent.summary || '(No title)',
            description: gEvent.description || null,
            location: gEvent.location || null,
            starts_at: startsAt,
            ends_at: endsAt,
            all_day: allDay,
            rrule: gEvent.recurrence ? gEvent.recurrence[0] : null,
            source: 'google',
            source_id: gEvent.id,
            source_updated_at: googleUpdatedAt,
          });

        if (insertError) {
          console.error('Failed to insert event:', insertError);
          skipped++;
        } else {
          imported++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: googleEvents.length,
    });
  } catch (e) {
    console.error('POST /api/google/sync error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
