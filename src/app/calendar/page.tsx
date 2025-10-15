'use client';

import { useMemo, useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import WeekGrid from '@/components/calendar/WeekGrid';
import MonthGrid from '@/components/calendar/MonthGrid';
import YearGrid from '@/components/calendar/YearGrid';
import { startOfWeek, addDays, addMonths, startOfMonth } from '@/lib/time';

type Mode = 'day' | 'week' | 'month' | 'year';
type Ev = { id: number|string; title: string; start: string; end: string; where?: string; color?: string };
type DBEvent = { id: string; title: string; starts_at: string; ends_at: string; location?: string; color?: string };

export default function CalendarPage() {
  const [mode, setMode] = useState<Mode>('week');
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const weekStart = useMemo(() => startOfWeek(cursor, 0), [cursor]);

  // Check Google connection status on mount
  useEffect(() => {
    const checkGoogleConnection = async () => {
      try {
        const res = await fetch('/api/google/status');
        if (res.ok) {
          const { connected } = await res.json();
          setGoogleConnected(connected);
        }
      } catch (error) {
        console.error('Error checking Google connection:', error);
      }
    };
    checkGoogleConnection();
  }, []);

  // Check for Google OAuth success/error in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      setGoogleConnected(true);
      // Clean URL
      window.history.replaceState({}, '', '/calendar');
    }
    if (params.get('google_error')) {
      alert(`Google Calendar connection failed: ${params.get('google_error')}`);
      window.history.replaceState({}, '', '/calendar');
    }
  }, []);

  // Fetch events from API
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        // Calculate time window based on mode
        const from = new Date(mode === 'day' ? cursor : weekStart);
        from.setHours(0, 0, 0, 0);

        const to = new Date(from);
        if (mode === 'day') {
          to.setDate(to.getDate() + 1);
        } else if (mode === 'week') {
          to.setDate(to.getDate() + 7);
        } else if (mode === 'month') {
          to.setMonth(to.getMonth() + 1);
        } else {
          to.setFullYear(to.getFullYear() + 1);
        }
        to.setHours(23, 59, 59, 999);

        const res = await fetch(
          `/api/events?from=${from.toISOString()}&to=${to.toISOString()}`,
          { cache: 'no-store' }
        );

        if (!res.ok) {
          throw new Error('Failed to fetch events');
        }

        const json = await res.json();
        setEvents(
          (json.events || []).map((e: DBEvent) => ({
            id: e.id,
            title: e.title,
            start: e.starts_at,
            end: e.ends_at,
            where: e.location,
            color: e.color,
          }))
        );
      } catch (error) {
        console.error('Error fetching events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [mode, cursor, weekStart]);

  // Optional: Realtime subscriptions
  useEffect(() => {
    const sb = supabaseBrowser();

    const channel = sb
      .channel('events-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
          // Refetch events when changes occur
          setLoading(true);
          const from = new Date(mode === 'day' ? cursor : weekStart);
          from.setHours(0, 0, 0, 0);
          const to = new Date(from);
          if (mode === 'day') to.setDate(to.getDate() + 1);
          else if (mode === 'week') to.setDate(to.getDate() + 7);
          else if (mode === 'month') to.setMonth(to.getMonth() + 1);
          else to.setFullYear(to.getFullYear() + 1);
          to.setHours(23, 59, 59, 999);

          fetch(`/api/events?from=${from.toISOString()}&to=${to.toISOString()}`, {
            cache: 'no-store',
          })
            .then((res) => res.json())
            .then((json) => {
              setEvents(
                (json.events || []).map((e: DBEvent) => ({
                  id: e.id,
                  title: e.title,
                  start: e.starts_at,
                  end: e.ends_at,
                  where: e.location,
                  color: e.color,
                }))
              );
            })
            .finally(() => setLoading(false));
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [mode, cursor, weekStart]);

  function goPrev() {
    if (mode === 'day')  setCursor(addDays(cursor, -1));
    if (mode === 'week') setCursor(addDays(cursor, -7));
    if (mode === 'month') setCursor(addMonths(cursor, -1));
    if (mode === 'year') setCursor(addMonths(cursor, -12));
  }
  function goNext() {
    if (mode === 'day')  setCursor(addDays(cursor, +1));
    if (mode === 'week') setCursor(addDays(cursor, +7));
    if (mode === 'month') setCursor(addMonths(cursor, +1));
    if (mode === 'year') setCursor(addMonths(cursor, +12));
  }
  function goToday() { setCursor(new Date()); }

  async function handleGoogleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' });
      if (!res.ok) {
        const error = await res.json();
        alert(`Sync failed: ${error.error}`);
      } else {
        const result = await res.json();
        alert(`Synced successfully! Imported: ${result.imported}, Skipped: ${result.skipped}`);
        // Refetch events to show new ones
        const from = new Date(mode === 'day' ? cursor : weekStart);
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        if (mode === 'day') to.setDate(to.getDate() + 1);
        else if (mode === 'week') to.setDate(to.getDate() + 7);
        else if (mode === 'month') to.setMonth(to.getMonth() + 1);
        else to.setFullYear(to.getFullYear() + 1);
        to.setHours(23, 59, 59, 999);

        const eventsRes = await fetch(`/api/events?from=${from.toISOString()}&to=${to.toISOString()}`);
        if (eventsRes.ok) {
          const json = await eventsRes.json();
          setEvents(
            (json.events || []).map((e: DBEvent) => ({
              id: e.id,
              title: e.title,
              start: e.starts_at,
              end: e.ends_at,
              where: e.location,
              color: e.color,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Failed to sync. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  const title =
    mode === 'year'
      ? `${cursor.getFullYear()}`
      : mode === 'month'
      ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : weekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <main className="space-y-4 p-3 md:p-4">
      {/* toolbar - responsive */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            onClick={goPrev}
            className="rounded-lg border border-white/10 px-2 py-1.5 md:px-3 hover:bg-white/5 active:bg-white/10 text-base md:text-sm touch-manipulation"
            aria-label="Previous"
          >
            <span className="hidden sm:inline">← Prev</span>
            <span className="sm:hidden">←</span>
          </button>
          <button
            onClick={goToday}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 md:px-3 hover:bg-white/5 active:bg-white/10 text-sm touch-manipulation"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="rounded-lg border border-white/10 px-2 py-1.5 md:px-3 hover:bg-white/5 active:bg-white/10 text-base md:text-sm touch-manipulation"
            aria-label="Next"
          >
            <span className="hidden sm:inline">Next →</span>
            <span className="sm:hidden">→</span>
          </button>
          {googleConnected ? (
            <button
              onClick={handleGoogleSync}
              disabled={syncing}
              className="rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 md:px-3 hover:bg-green-500/20 active:bg-green-500/30 text-xs md:text-sm touch-manipulation disabled:opacity-50"
              title="Sync Google Calendar"
            >
              {syncing ? '⟳' : '🔄'}
            </button>
          ) : (
            <a
              href="/api/google/oauth/start"
              className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 md:px-3 hover:bg-blue-500/20 active:bg-blue-500/30 text-xs md:text-sm touch-manipulation"
              title="Connect Google Calendar"
            >
              📅
            </a>
          )}
        </div>

        <h1 className="text-[clamp(1rem,2.2vw,1.25rem)] font-semibold order-first w-full sm:order-none sm:w-auto">{title}</h1>

        <div className="flex items-center gap-0.5 md:gap-1 rounded-lg border border-white/10 p-0.5 md:p-1">
          {(['day','week','month','year'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2 md:px-3 py-1.5 text-xs md:text-sm hover:bg-white/5 active:bg-white/10 touch-manipulation transition-colors ${mode===m ? 'bg-white/10 font-medium' : ''}`}
            >
              <span className="hidden sm:inline">{m[0].toUpperCase() + m.slice(1)}</span>
              <span className="sm:hidden">{m[0].toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* view */}
      {loading && (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60" />
        </div>
      )}
      {!loading && mode === 'day' && <WeekGrid mode="day" selectedDate={cursor} events={events} />}
      {!loading && mode === 'week' && <WeekGrid mode="week" weekStart={weekStart} events={events} />}
      {!loading && mode === 'month' && <MonthGrid cursor={startOfMonth(cursor)} events={events} />}
      {!loading && mode === 'year' && <YearGrid cursor={cursor} events={events} />}

      {/* FAB - responsive touch-friendly */}
      <button
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 rounded-full border border-white/10 bg-white/10 px-4 py-2.5 md:px-5 md:py-3 text-sm font-medium backdrop-blur hover:bg-white/20 active:bg-white/30 touch-manipulation shadow-lg transition-all disabled:opacity-50"
        onClick={async () => {
          // Get primary calendar ID and create a test event
          const now = new Date();
          const end = new Date(now.getTime() + 60 * 60 * 1000);

          try {
            // First get the primary calendar ID
            const calRes = await fetch('/api/calendars/primary');
            if (!calRes.ok) {
              alert('Please set up your calendar first. Sign in to create a profile and calendar.');
              return;
            }
            const { calendarId } = await calRes.json();

            const res = await fetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                calendar_id: calendarId,
                title: 'Quick Event',
                location: 'Home',
                starts_at: now.toISOString(),
                ends_at: end.toISOString(),
              }),
            });

            if (!res.ok) {
              const error = await res.json();
              alert(`Failed to create event: ${error.error}`);
            } else {
              // Event created successfully, realtime will update the view
            }
          } catch (error) {
            console.error('Error creating event:', error);
            alert('Failed to create event. Please try again.');
          }
        }}
        aria-label="Add event"
        disabled={loading}
      >
        <span className="hidden sm:inline">+ Add event</span>
        <span className="sm:hidden text-xl">+</span>
      </button>
    </main>
  );
}