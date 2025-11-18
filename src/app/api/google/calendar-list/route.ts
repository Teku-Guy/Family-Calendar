/**
 * Google Calendar List API
 *
 * Fetches the list of Google Calendars accessible to the user.
 * Stores/updates calendar metadata in google_calendars table.
 *
 * GET /api/google/calendar-list
 * Returns: Array of Google Calendars with selection state
 *
 * PATCH /api/google/calendar-list
 * Body: { calendarId: string, selected: boolean }
 * Updates selection state for a calendar
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { googleFetch } from '@/lib/google';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * GET - Fetch list of Google Calendars
 */
export async function GET() {
  try {
    const sb = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch calendars from Google
    const url = `${GOOGLE_CALENDAR_API}/users/me/calendarList`;
    const response = await googleFetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch calendar list:', errorText);

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Google Calendar not connected or token expired', action: 'reconnect' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch calendars from Google' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const calendars = data.items || [];

    // Upsert calendars to database
    for (const gcal of calendars) {
      const { error: upsertError } = await sb
        .from('google_calendars')
        .upsert(
          {
            user_id: user.id,
            google_calendar_id: gcal.id,
            summary: gcal.summary,
            description: gcal.description || null,
            time_zone: gcal.timeZone,
            background_color: gcal.backgroundColor,
            foreground_color: gcal.foregroundColor,
            access_role: gcal.accessRole,
            is_primary: gcal.primary || false,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,google_calendar_id',
            ignoreDuplicates: false,
          }
        );

      if (upsertError) {
        console.error('Failed to upsert calendar:', gcal.id, upsertError);
      }
    }

    // Fetch from database (includes selection state)
    const { data: storedCalendars, error: fetchError } = await sb
      .from('google_calendars')
      .select('*')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('summary', { ascending: true });

    if (fetchError) {
      console.error('Failed to fetch stored calendars:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch calendar selection state' },
        { status: 500 }
      );
    }

    return NextResponse.json(storedCalendars || []);
  } catch (error) {
    console.error('GET /api/google/calendar-list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update calendar selection state
 */
export async function PATCH(req: Request) {
  try {
    const sb = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { calendarId, selected } = body;

    if (!calendarId || typeof selected !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing or invalid calendarId or selected field' },
        { status: 400 }
      );
    }

    // Update selection state
    const { error: updateError } = await sb
      .from('google_calendars')
      .update({ selected, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('google_calendar_id', calendarId);

    if (updateError) {
      console.error('Failed to update calendar selection:', updateError);
      return NextResponse.json(
        { error: 'Failed to update calendar selection' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, calendarId, selected });
  } catch (error) {
    console.error('PATCH /api/google/calendar-list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
