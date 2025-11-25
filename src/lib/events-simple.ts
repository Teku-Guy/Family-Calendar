/**
 * Simplified events library (works without recurring events columns)
 *
 * This is a temporary implementation that works with the basic events schema.
 * Once the migration is applied, switch back to the full events.ts implementation.
 */

import { supabaseServer } from '@/lib/supabase/server';

export interface SimpleEvent {
  id: string;
  calendar_id: string;
  title: string;
  location?: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  color?: string;
  source?: string;
  source_id?: string;
}

/**
 * List events for a given time window (simple version - no recurring events)
 */
export async function listEvents({
  from,
  to,
  calendarId,
}: {
  from: string;
  to: string;
  calendarId?: string;
}): Promise<SimpleEvent[]> {
  const sb = await supabaseServer();

  // Simple window intersection: starts_at <= to AND ends_at >= from
  let query = sb
    .from('events')
    .select('id, calendar_id, title, location, starts_at, ends_at, all_day, calendars(color), source, source_id')
    .lte('starts_at', to)
    .gte('ends_at', from)
    .order('starts_at', { ascending: true });

  if (calendarId) {
    query = query.eq('calendar_id', calendarId);
  }

  const { data, error } = await query;

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[listEvents] query error:', error);
    }
    throw new Error(error.message);
  }

  // Transform to simple event format
  return (data || []).map((row: any) => ({
    id: row.id,
    calendar_id: row.calendar_id,
    title: row.title,
    location: row.location || undefined,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    all_day: row.all_day,
    color: row.calendars?.color || undefined,
    source: row.source || undefined,
    source_id: row.source_id || undefined,
  }));
}

/**
 * Create a new event (simple version - no recurring events)
 */
export async function createEvent(e: {
  calendar_id: string;
  title: string;
  location?: string;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
}): Promise<SimpleEvent> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('events')
    .insert({
      calendar_id: e.calendar_id,
      title: e.title,
      location: e.location || null,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      all_day: e.all_day || false,
    })
    .select('id, calendar_id, title, location, starts_at, ends_at, all_day, calendars(color)')
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    calendar_id: data.calendar_id,
    title: data.title,
    location: data.location || undefined,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    all_day: data.all_day,
    color: (data.calendars as unknown as { color: string } | null)?.color || undefined,
  };
}

/**
 * Get the primary calendar ID for the current user
 */
export async function getPrimaryCalendarId(): Promise<string | null> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from('calendars')
    .select('id')
    .eq('is_primary', true)
    .limit(1)
    .single();

  return data?.id || null;
}
