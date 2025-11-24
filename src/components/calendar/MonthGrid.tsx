'use client';

import { useState, useCallback } from 'react';
import { addDays, startOfWeek, startOfMonth } from '@/lib/time';
import DayExpansionModal from './DayExpansionModal';
import type { EventDraft } from '@/types/events';

type Event = {
  id: string | number;
  start: string;
  end: string;
  title: string;
  color?: string;
  where?: string;
  all_day?: boolean;
  _series?: {
    master_id: string;
    original_start: string;
    is_override?: boolean;
  };
};

type Props = {
  cursor: Date;
  events: Event[];
  onEditEvent?: (id: string, draft: EventDraft) => void;
  onDayClick?: (date: Date) => void;
  primaryCalendarId?: string;
  maxEventsPerDay?: number;
};

export default function MonthGrid({
  cursor,
  events,
  onEditEvent,
  onDayClick,
  primaryCalendarId,
  maxEventsPerDay = 3,
}: Props) {
  const [expandedDay, setExpandedDay] = useState<Date | null>(null);
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);

  const firstOfMonth = startOfMonth(cursor);
  const firstGrid = startOfWeek(firstOfMonth, 0); // grid starts on Sunday
  const totalDays = 42; // 6 weeks grid

  const cells = Array.from({ length: totalDays }, (_, i) => addDays(firstGrid, i));

  const eventsOnDay = useCallback(
    (d: Date) => {
      return events.filter((ev) => {
        const s = new Date(ev.start);
        return (
          s.getFullYear() === d.getFullYear() &&
          s.getMonth() === d.getMonth() &&
          s.getDate() === d.getDate()
        );
      });
    },
    [events]
  );

  const handleEventClick = useCallback(
    (ev: Event) => {
      if (!onEditEvent || !primaryCalendarId) return;

      // Convert to local datetime-local format for the form
      const startDate = new Date(ev.start);
      const endDate = new Date(ev.end);
      const offset = startDate.getTimezoneOffset() * 60000;
      const starts_at = new Date(startDate.getTime() - offset).toISOString().slice(0, 16);
      const ends_at = new Date(endDate.getTime() - offset).toISOString().slice(0, 16);

      const draft: EventDraft = {
        id: String(ev.id),
        calendar_id: primaryCalendarId,
        title: ev.title,
        starts_at,
        ends_at,
        location: ev.where,
        color: ev.color,
        all_day: ev.all_day,
        _series: ev._series,
      };

      onEditEvent(String(ev.id), draft);
    },
    [onEditEvent, primaryCalendarId]
  );

  const handleMoreClick = useCallback((d: Date) => {
    setExpandedDay(d);
  }, []);

  const handleExpansionClose = useCallback(() => {
    setExpandedDay(null);
  }, []);

  const handleExpansionEventClick = useCallback(
    (ev: { id: string; title: string; start: number; end: number; where?: string; color?: string; all_day?: boolean; _series?: { master_id: string; original_start: string; is_override?: boolean } }) => {
      // Close the expansion modal first
      setExpandedDay(null);

      if (!onEditEvent || !primaryCalendarId) return;

      // Convert timestamps to local datetime-local format
      const startDate = new Date(ev.start);
      const endDate = new Date(ev.end);
      const offset = startDate.getTimezoneOffset() * 60000;
      const starts_at = new Date(startDate.getTime() - offset).toISOString().slice(0, 16);
      const ends_at = new Date(endDate.getTime() - offset).toISOString().slice(0, 16);

      const draft: EventDraft = {
        id: String(ev.id),
        calendar_id: primaryCalendarId,
        title: ev.title,
        starts_at,
        ends_at,
        location: ev.where,
        color: ev.color,
        all_day: ev.all_day,
        _series: ev._series,
      };

      onEditEvent(String(ev.id), draft);
    },
    [onEditEvent, primaryCalendarId]
  );

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get events for expanded day modal (convert to timestamp format)
  const expandedDayEvents = expandedDay
    ? eventsOnDay(expandedDay).map((ev) => ({
        id: String(ev.id),
        title: ev.title,
        start: new Date(ev.start).getTime(),
        end: new Date(ev.end).getTime(),
        where: ev.where,
        color: ev.color,
        all_day: ev.all_day,
        _series: ev._series,
      }))
    : [];

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/10">
          {weekdays.map((w) => (
            <div key={w} className="px-3 py-2 text-xs opacity-70">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const dayNum = d.getDate();
            const dayEvents = eventsOnDay(d);
            const visibleEvents = dayEvents.slice(0, maxEventsPerDay);
            const hiddenCount = dayEvents.length - maxEventsPerDay;

            const isHovered = hoveredDay?.toDateString() === d.toDateString();

            return (
              <div
                key={i}
                className={`min-h-[96px] border-l border-t border-white/5 p-2 cursor-pointer transition-colors ${
                  inMonth ? '' : 'opacity-50'
                } ${
                  isHovered
                    ? 'bg-white/10 ring-2 ring-white/20 ring-inset'
                    : 'hover:bg-white/5'
                }`}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={(e) => {
                  // Only trigger if clicking empty space (not event button)
                  if (e.target === e.currentTarget || !(e.target as HTMLElement).closest('button')) {
                    onDayClick?.(d);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDayClick?.(d);
                  }
                }}
                role="button"
                tabIndex={onDayClick ? 0 : undefined}
                aria-label={`${d.toLocaleDateString()}, ${dayEvents.length} events`}
              >
                <div className="text-xs mb-1">{dayNum}</div>
                <div className="space-y-1">
                  {visibleEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => handleEventClick(ev)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleEventClick(ev);
                        }
                      }}
                      className="w-full text-left truncate rounded px-2 py-1 text-[11px] transition-all hover:ring-2 ring-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                      style={{
                        backgroundColor: ev.color
                          ? `${ev.color}30`
                          : 'rgba(255, 255, 255, 0.1)',
                        borderLeft: ev.color ? `3px solid ${ev.color}` : '3px solid rgba(255, 255, 255, 0.3)',
                      }}
                      tabIndex={0}
                      aria-label={`Edit event: ${ev.title}`}
                    >
                      {ev.title}
                    </button>
                  ))}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => handleMoreClick(d)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleMoreClick(d);
                        }
                      }}
                      className="text-[10px] text-white/60 hover:text-white hover:bg-white/10 rounded px-1 py-0.5 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                      tabIndex={0}
                      aria-label={`Show ${hiddenCount} more events on ${d.toLocaleDateString()}`}
                    >
                      +{hiddenCount} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day expansion modal */}
      {expandedDay && (
        <DayExpansionModal
          date={expandedDay}
          events={expandedDayEvents}
          onClose={handleExpansionClose}
          onEventClick={handleExpansionEventClick}
        />
      )}
    </>
  );
}
