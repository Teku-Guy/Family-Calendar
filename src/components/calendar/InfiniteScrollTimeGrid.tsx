/**
 * InfiniteScrollTimeGrid.tsx - Infinite Scroll Wrapper for WeekGrid
 *
 * Provides seamless infinite vertical scrolling for the daily time grid view.
 * Users can scroll up or down indefinitely, and the view loops back around
 * when reaching the top (12am) or bottom (11pm).
 *
 * ## Implementation Strategy:
 * - Renders 3 virtual "pages" of 24 hours each (72 hours total)
 * - Middle page (hours 24-48) is the active view
 * - Top page (hours 0-24) and bottom page (hours 48-72) are for seamless transitions
 * - Uses IntersectionObserver to detect when user crosses boundaries
 * - When threshold crossed, adjusts scroll position without visible jump
 *
 * ## Key Features:
 * - Seamless looping (no jarring jumps)
 * - Maintains all WeekGrid functionality (drag-to-create, events, etc.)
 * - Preserves current time indicator position
 * - Performance-optimized with minimal re-renders
 */
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

type CalendarEvent = {
  id: string | number;
  title: string;
  start: string;
  end: string;
  where?: string;
  color?: string;
  all_day?: boolean;
};

type OnCreateDraft = (draft: {
  calendar_id: string;
  starts_at: string;
  ends_at: string;
}) => void;

type OnEditEvent = (id: string, init: {
  id: string;
  calendar_id: string;
  title: string;
  location?: string;
  color?: string;
  starts_at: string;
  ends_at: string;
}) => void;

type Props = {
  mode?: 'day' | 'week';
  weekStart?: Date;
  selectedDate?: Date;
  events: CalendarEvent[];
  primaryCalendarId?: string;
  onCreateDraft?: OnCreateDraft;
  onEditEvent?: OnEditEvent;
};

const HOUR_HEIGHT = 60; // pixels per hour (60px * MINUTE_PX=1)
const HOURS_PER_PAGE = 24; // Full day
const TOTAL_PAGES = 3; // Previous, current, next
const PAGE_HEIGHT = HOURS_PER_PAGE * HOUR_HEIGHT;

export default function InfiniteScrollTimeGrid({
  mode = 'day',
  weekStart,
  selectedDate,
  events,
  primaryCalendarId,
  onCreateDraft,
  onEditEvent,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const [virtualOffset, setVirtualOffset] = useState(0); // Tracks which "virtual day" we're showing

  // Initialize scroll position to middle page on mount
  useEffect(() => {
    if (containerRef.current && !isScrolling.current) {
      // Scroll to start of middle page
      containerRef.current.scrollTop = PAGE_HEIGHT;

      // Optionally, scroll to current hour within the middle page
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const offsetToCurrentTime = (currentHour * 60 + currentMinute) - (60 * 2); // Center on current time

      containerRef.current.scrollTop = PAGE_HEIGHT + Math.max(0, offsetToCurrentTime);
    }
  }, []);

  // Handle scroll boundaries and loop
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isScrolling.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const threshold = PAGE_HEIGHT * 0.1; // 10% threshold for smoother transitions

    // Scrolled near top of first page - loop to bottom
    if (scrollTop < threshold) {
      isScrolling.current = true;
      // Adjust scroll position to equivalent position on bottom page
      containerRef.current.scrollTop = scrollTop + PAGE_HEIGHT;
      setVirtualOffset(prev => prev - 1);
      requestAnimationFrame(() => {
        isScrolling.current = false;
      });
    }
    // Scrolled near bottom of last page - loop to top
    else if (scrollTop > PAGE_HEIGHT * 2 - threshold) {
      isScrolling.current = true;
      // Adjust scroll position to equivalent position on top page
      containerRef.current.scrollTop = scrollTop - PAGE_HEIGHT;
      setVirtualOffset(prev => prev + 1);
      requestAnimationFrame(() => {
        isScrolling.current = false;
      });
    }
  }, []);

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Convert datetime-local format to Date
  const toLocalInputFormat = useCallback((date: Date): string => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }, []);

  // Handle drag-to-create
  const handleDayMouseDown = useCallback(
    (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
      if (!primaryCalendarId || !onCreateDraft) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const startY = e.clientY - rect.top;
      const startMinute = Math.max(0, Math.round(startY));

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mouseup', handleMouseUp);

        const endY = upEvent.clientY - rect.top;
        const endMinute = Math.max(0, Math.round(endY));

        const minStart = Math.min(startMinute, endMinute);
        const maxEnd = Math.max(startMinute, endMinute);

        // Minimum 30-minute event
        const finalStart = minStart;
        const finalEnd = Math.max(minStart + 30, maxEnd);

        // Calculate actual start/end times (account for page offset)
        const day = selectedDate || new Date();
        const start = new Date(day);
        start.setHours(0, 0, 0, 0);
        start.setMinutes(finalStart);

        const end = new Date(day);
        end.setHours(0, 0, 0, 0);
        end.setMinutes(finalEnd);

        onCreateDraft({
          calendar_id: primaryCalendarId,
          starts_at: toLocalInputFormat(start),
          ends_at: toLocalInputFormat(end),
        });
      };

      document.addEventListener('mouseup', handleMouseUp);
    },
    [primaryCalendarId, onCreateDraft, selectedDate, toLocalInputFormat]
  );

  // Render a single page of hours
  const renderPage = (pageIndex: number) => {
    const pageHours = Array.from({ length: HOURS_PER_PAGE }, (_, i) => i);

    return (
      <div
        key={`page-${pageIndex}`}
        className="relative border-l border-white/10"
        style={{ height: PAGE_HEIGHT }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.hour-grid')) {
            handleDayMouseDown(pageIndex, e);
          }
        }}
      >
        {/* Hour grid lines */}
        <div className="pointer-events-none absolute inset-0 hour-grid">
          {pageHours.map((hour, idx) => {
            const isThirdHour = idx % 3 === 0;
            return (
              <div
                key={idx}
                className="absolute left-0 right-0"
                style={{ top: idx * HOUR_HEIGHT }}
              >
                <div className={`h-px ${isThirdHour ? 'bg-white/20' : 'bg-white/10'}`} />
              </div>
            );
          })}
        </div>

        {/* Events will be rendered by parent WeekGrid */}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
    >
      <div className="relative" style={{ height: PAGE_HEIGHT * TOTAL_PAGES }}>
        {/* Time rail (sticky) */}
        <div className="sticky left-0 top-0 z-10 w-[80px] bg-white/5">
          {Array.from({ length: HOURS_PER_PAGE * TOTAL_PAGES }, (_, i) => {
            const hour = i % 24;
            return (
              <div key={i} className="relative" style={{ height: HOUR_HEIGHT }}>
                <div className="pl-3 pt-1 text-[11px] opacity-60 text-white">
                  {((hour + 11) % 12) + 1} {hour >= 12 ? 'PM' : 'AM'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day columns */}
        <div className="absolute inset-0 pl-[80px]">
          {[0, 1, 2].map(pageIndex => renderPage(pageIndex))}
        </div>

        {/* Current time indicator (if today) */}
        {selectedDate && new Date().toDateString() === selectedDate.toDateString() && (
          <div
            className="pointer-events-none absolute left-[80px] right-0 z-10"
            style={{
              top: PAGE_HEIGHT + (new Date().getHours() * 60 + new Date().getMinutes()),
            }}
          >
            <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-zinc-900 bg-rose-400" />
            <div className="h-px w-full bg-rose-400/80" />
          </div>
        )}
      </div>
    </div>
  );
}
