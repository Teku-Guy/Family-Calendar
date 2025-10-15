import { supabaseServer } from '@/lib/supabase/server';

export type DBEvent = {
  id: string;
  calendar_id: string;
  title: string;
  location: string | null;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  all_day: boolean;
  color: string | null;
};

export async function listEvents({ from, to, calendarId }: {
  from: string;
  to: string;
  calendarId?: string;
}) {
  const sb = await supabaseServer();
  let q = sb
    .from('events')
    .select('id, calendar_id, title, location, starts_at, ends_at, all_day, calendars(color)')
    .lte('starts_at', to)
    .gte('ends_at', from)
    .order('starts_at', { ascending: true });

  if (calendarId) q = q.eq('calendar_id', calendarId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  // Transform to include color from calendar
  return (data || []).map((e) => {
    const row = e as Record<string, unknown>;
    return {
      id: row.id as string,
      calendar_id: row.calendar_id as string,
      title: row.title as string,
      location: (row.location as string | null) || null,
      starts_at: row.starts_at as string,
      ends_at: row.ends_at as string,
      all_day: row.all_day as boolean,
      color: (row.calendars as Record<string, unknown> | null)?.color as string | null || null,
    };
  }) as DBEvent[];
}

export async function createEvent(e: {
  calendar_id: string;
  title: string;
  location?: string;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
}) {
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

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    calendar_id: row.calendar_id as string,
    title: row.title as string,
    location: (row.location as string | null) || null,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    all_day: row.all_day as boolean,
    color: (row.calendars as Record<string, unknown> | null)?.color as string | null || null,
  } as DBEvent;
}

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
