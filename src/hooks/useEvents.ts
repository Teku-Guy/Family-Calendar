/**
 * useEvents Hook - Fetch events from the API with Realtime updates
 *
 * This hook fetches events for a given time window from /api/events and
 * subscribes to Realtime changes for automatic updates.
 *
 * Features:
 * - Initial fetch on mount
 * - Realtime subscription to Supabase events table
 * - Debounced refetch on changes (coalesces rapid updates)
 * - Toast notifications on errors
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * const from = new Date('2025-10-15T00:00:00');
 * const to = new Date('2025-10-22T23:59:59');
 * const { events, loading, error, refetch } = useEvents(from, to);
 * ```
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toaster';

export interface Event {
  id: string;
  calendar_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location?: string;
  all_day?: boolean;
  color?: string;
  source?: string;
  source_id?: string;
}

export function useEvents(from: Date, to: Date, calendarId?: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  // Create stable key for window to prevent unnecessary re-subscriptions
  const windowKey = useMemo(
    () => `${from.toISOString()}..${to.toISOString()}`,
    [from, to]
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });

      if (calendarId) {
        params.set('calendarId', calendarId);
      }

      const res = await fetch(`/api/events?${params.toString()}`, {
        cache: 'no-store',
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
      }

      const json = JSON.parse(text);
      setEvents(json.events ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'fetch failed';
      setError(message);
      console.error('[useEvents] error:', message);
      push({
        title: `Failed to load events: ${message}`,
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [from, to, calendarId, push]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, [refetch, windowKey]);

  // Realtime subscription - refetch on any change
  useEffect(() => {
    const sb = supabaseBrowser();
    let debounceTimer: ReturnType<typeof setTimeout>;

    // Debounced refetch to coalesce rapid changes
    const debouncedRefetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        refetch();
      }, 120); // 120ms debounce
    };

    // Subscribe to all changes on events table
    const channel = sb
      .channel('events-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          // Only refetch if the change might intersect our time window
          // This is a quick heuristic to avoid unnecessary fetches
          const row: Record<string, unknown> = (payload.new as Record<string, unknown>) || (payload.old as Record<string, unknown>) || {};

          // For recurring events, always refetch since occurrences might be in our window
          // even if the master event's starts_at/ends_at are outside it
          const isRecurring = !!row?.rrule || !!row?.series_id;

          if (isRecurring) {
            console.log('[useEvents] Realtime update for recurring event, refetching...');
            debouncedRefetch();
            return;
          }

          const startTime = row?.starts_at ? new Date(row.starts_at as string).getTime() : 0;
          const endTime = row?.ends_at ? new Date(row.ends_at as string).getTime() : 0;

          const windowStart = from.getTime();
          const windowEnd = to.getTime();

          // Check if event overlaps with our window: starts before window end AND ends after window start
          if (startTime <= windowEnd && endTime >= windowStart) {
            console.log('[useEvents] Realtime update detected, refetching...');
            debouncedRefetch();
          }
        }
      )
      .subscribe();

    // Cleanup on unmount or window change
    return () => {
      clearTimeout(debounceTimer);
      sb.removeChannel(channel);
    };
  }, [from, to, refetch]);

  // Optimistic update helpers
  const upsertLocal = useCallback((event: Event) => {
    setEvents((prev) => {
      const index = prev.findIndex((e) => e.id === event.id);
      if (index === -1) {
        // New event - add to start of list
        return [event, ...prev];
      }
      // Update existing event
      const copy = [...prev];
      copy[index] = event;
      return copy;
    });
  }, []);

  const removeLocal = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { events, loading, error, refetch, upsertLocal, removeLocal };
}
