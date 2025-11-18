'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import WeekGrid from '@/components/calendar/WeekGrid';
import MonthGrid from '@/components/calendar/MonthGrid';
import YearGrid from '@/components/calendar/YearGrid';
import EventModal, { type EventDraft } from '@/components/calendar/EventModal';
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

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [primaryCalendarId, setPrimaryCalendarId] = useState<string>('');

  const weekStart = useMemo(() => startOfWeek(cursor, 0), [cursor]);

  // Fetch primary calendar ID on mount
  useEffect(() => {
    const fetchPrimaryCalendar = async () => {
      try {
        const res = await fetch('/api/calendars/primary');
        if (res.ok) {
          const { calendarId } = await res.json();
          setPrimaryCalendarId(calendarId);
        }
      } catch (error) {
        console.error('Error fetching primary calendar:', error);
      }
    };
    fetchPrimaryCalendar();
  }, []);

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
          const text = await res.text().catch(() => '');
          if (process.env.NODE_ENV !== 'production') {
            console.error('[events fetch] status', res.status, text);
          }
          throw new Error(text || `Failed to fetch events (${res.status})`);
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
      } catch (error: any) {
        console.error('[CalendarPage] fetchEvents failed:', error?.message || error);
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
            .then(async (res) => {
              if (!res.ok) {
                const text = await res.text().catch(() => '');
                if (process.env.NODE_ENV !== 'production') {
                  console.error('[realtime events fetch] status', res.status, text);
                }
                throw new Error(text || `Failed to fetch events (${res.status})`);
              }
              return res.json();
            })
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
            .catch((error: any) => {
              console.error('[CalendarPage] realtime fetchEvents failed:', error?.message || error);
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

  // Modal callbacks
  const openCreate = useCallback((initDraft: { calendar_id: string; starts_at: string; ends_at: string }) => {
    setDraft(initDraft);
    setModalMode('create');
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((_id: string, initDraft: EventDraft) => {
    setDraft(initDraft);
    setModalMode('edit');
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setDraft(null);
  }, []);

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
      {!loading && mode === 'day' && (
        <WeekGrid
          mode="day"
          selectedDate={cursor}
          events={events}
          primaryCalendarId={primaryCalendarId}
          onCreateDraft={openCreate}
          onEditEvent={openEdit}
        />
      )}
      {!loading && mode === 'week' && (
        <WeekGrid
          mode="week"
          weekStart={weekStart}
          events={events}
          primaryCalendarId={primaryCalendarId}
          onCreateDraft={openCreate}
          onEditEvent={openEdit}
        />
      )}
      {!loading && mode === 'month' && <MonthGrid cursor={startOfMonth(cursor)} events={events} />}
      {!loading && mode === 'year' && <YearGrid cursor={cursor} events={events} />}

      {/* FAB - responsive touch-friendly */}
      <button
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 rounded-full border border-white/10 bg-white/10 px-4 py-2.5 md:px-5 md:py-3 text-sm font-medium backdrop-blur hover:bg-white/20 active:bg-white/30 touch-manipulation shadow-lg transition-all disabled:opacity-50"
        onClick={() => {
          if (!primaryCalendarId) {
            alert('Please set up your calendar first. Sign in to create a profile and calendar.');
            return;
          }
          // Open modal with current time as default
          const now = new Date();
          const roundedMinutes = Math.ceil(now.getMinutes() / 30) * 30;
          now.setMinutes(roundedMinutes, 0, 0);

          const end = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later

          const offset = now.getTimezoneOffset() * 60000;
          const starts_at = new Date(now.getTime() - offset).toISOString().slice(0, 16);
          const ends_at = new Date(end.getTime() - offset).toISOString().slice(0, 16);

          openCreate({
            calendar_id: primaryCalendarId,
            starts_at,
            ends_at,
          });
        }}
        aria-label="Add event"
        disabled={loading || !primaryCalendarId}
      >
        <span className="hidden sm:inline">+ Add event</span>
        <span className="sm:hidden text-xl">+</span>
      </button>

      {/* Event Modal */}
      {draft && (
        <EventModal
          open={modalOpen}
          onClose={closeModal}
          defaults={draft}
          mode={modalMode}
        />
      )}
    </main>
  );
}