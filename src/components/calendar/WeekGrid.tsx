/**
 * WeekGrid.tsx - Responsive Week/Day Calendar View
 *
 * This component renders a Google Calendar-style week or day view with intelligent
 * event overlap handling. It uses a segment-based algorithm to position overlapping
 * events side-by-side in columns.
 *
 * ## Key Features:
 * - **Responsive**: 1 day (mobile), 2 days (sm), 4 days (md), 7 days (lg+)
 * - **Segment-based overlap**: Events are divided into vertical segments at boundary
 *   points, ensuring consistent column assignment
 * - **Interactive**: Click/tap events for popover details, keyboard navigation
 * - **Real-time marker**: Shows current time as a red line
 * - **Accessibility**: ARIA labels, keyboard support, focus management
 *
 * ## Coordinate System:
 * - **Vertical**: Minutes mapped to pixels (MINUTE_PX = 1, so 60px per hour)
 * - **Horizontal**: Events in the same time slot are divided into columns with
 *   COL_GUTTER_PX spacing between them
 *
 * ## Overlap Algorithm (Simplified):
 * 1. **Filter & Clamp**: Only show events that overlap the visible day window
 * 2. **Group by Collision**: Events that overlap are grouped together
 * 3. **Assign Columns**: Within each group, assign the lowest available column
 * 4. **Create Segments**: Split events at all boundary points in the group
 * 5. **Merge Adjacent**: Recombine adjacent segments with identical positioning
 *
 * This ensures that:
 * - Events never overlap visually
 * - Column widths adjust based on number of concurrent events
 * - Layout is deterministic and predictable
 *
 * @example
 * ```tsx
 * <WeekGrid
 *   mode="week"
 *   weekStart={startOfWeek(new Date())}
 *   events={events}
 *   dayStartHour={6}
 *   dayEndHour={22}
 * />
 * ```
 */
'use client';

import React, { useMemo, useState, useCallback, memo } from 'react';
import EventCard from '@/components/ui/EventCard';
import EventPopover from '@/components/ui/EventPopover';
import { startOfWeek, startOfDay, addDays } from '@/lib/time';
import WorkingHoursOverlay from '@/components/calendar/WorkingHoursOverlay';
import CurrentTimeIndicator from '@/components/calendar/CurrentTimeIndicator';
import { useTimeGrid } from '@/hooks/useTimeGrid';

// Segment type for layout calculations
type Segment = {
  id: string | number;
  title: string;
  where?: string;
  color?: string;
  _s: number;
  _e: number;
  col: number;
  styleLeft: string;
  styleWidth: string;
  top: number;
  height: number;
  _segId: string;
  z: number;
};

// Memoized DayColumn component to reduce re-renders
const DayColumn = memo(function DayColumn({
  day,
  items,
  isToday,
  dayHeight,
  dayStartHour,
  dayEndHour,
  nowMarker,
  dayIndex,
  mode,
  onMouseDown,
  onEventClick,
  workingHoursStart,
  workingHoursEnd,
  currentTime,
  className = '',
}: {
  day: Date;
  items: Segment[];
  isToday: boolean;
  dayHeight: number;
  dayStartHour: number;
  dayEndHour: number;
  nowMarker: { dayIndex: number; minute: number } | null;
  dayIndex: number;
  mode: 'day' | 'week';
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onEventClick: (ev: Segment) => void;
  workingHoursStart: number;
  workingHoursEnd: number;
  currentTime: Date;
  className?: string;
}) {
  const MINUTE_PX = 1;

  return (
    <div
      className={`relative border-l border-white/10 cursor-crosshair ${className}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.hour-grid')) {
          onMouseDown(e);
        }
      }}
    >
      {/* hour lines */}
      <div className="pointer-events-none absolute inset-0 hour-grid" style={{ height: dayHeight }}>
        {Array.from({ length: (dayEndHour - dayStartHour) + 1 }).map((_, idx) => {
          const isThirdHour = idx % 3 === 0;
          return (
            <div
              key={idx}
              className="absolute left-0 right-0"
              style={{ top: idx * 60 * MINUTE_PX }}
            >
              <div className={`h-px ${isThirdHour ? 'bg-white/20' : 'bg-white/10'}`} />
            </div>
          );
        })}
      </div>

      {isToday && <div className="absolute inset-0 bg-sky-400/5" aria-hidden />}

      {/* Working hours overlay */}
      <WorkingHoursOverlay
        workingStart={workingHoursStart}
        workingEnd={workingHoursEnd}
        dayStartHour={dayStartHour}
        dayEndHour={dayEndHour}
        slotHeight={60}
      />

      {/* Current time indicator (only show if this is today's column) */}
      {((mode === 'day' && dayIndex === 0 && isToday) || (mode === 'week' && isToday)) && (
        <CurrentTimeIndicator
          currentTime={currentTime}
          startHour={dayStartHour}
          endHour={dayEndHour}
          slotHeight={60}
        />
      )}

      {/* events */}
      <div className="relative" style={{ height: dayHeight }}>
        {items.map((ev) => (
          <div
            key={ev._segId ?? ev.id}
            className="absolute px-0.5 md:px-1 cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`${ev.title}, ${ev.where || ''}`}
            style={{ top: ev.top, height: ev.height, left: ev.styleLeft, width: ev.styleWidth, zIndex: ev.z ?? 1 }}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(ev);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEventClick(ev);
              }
            }}
          >
            <EventCard
              title={ev.title}
              where={ev.where}
              color={ev.color}
              height={ev.height}
              startTime={new Date(ev._s).toISOString()}
              endTime={new Date(ev._e).toISOString()}
            />
          </div>
        ))}
      </div>

      {/* now line */}
      {nowMarker &&
        ((mode === 'day' && dayIndex === 0) || (mode === 'week' && nowMarker.dayIndex === dayIndex)) &&
        nowMarker.minute >= dayStartHour * 60 &&
        nowMarker.minute <= dayEndHour * 60 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10"
            style={{ top: (nowMarker.minute - dayStartHour * 60) * MINUTE_PX }}
          >
            <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-zinc-900 bg-rose-400" />
            <div className="h-px w-full bg-rose-400/80" />
          </div>
        )}
    </div>
  );
});

type CalendarEvent = {
  id: string | number;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  where?: string;
  color?: string;
  all_day?: boolean;
};

// Memoized AllDayEventBanner component for displaying all-day events
const AllDayEventBanner = memo(function AllDayEventBanner({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  // Determine color class based on event color
  const colorMap: Record<string, string> = {
    rose: 'bg-rose-500/20 border-rose-500/40 text-rose-200',
    pink: 'bg-pink-500/20 border-pink-500/40 text-pink-200',
    fuchsia: 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-200',
    purple: 'bg-purple-500/20 border-purple-500/40 text-purple-200',
    violet: 'bg-violet-500/20 border-violet-500/40 text-violet-200',
    indigo: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200',
    blue: 'bg-blue-500/20 border-blue-500/40 text-blue-200',
    sky: 'bg-sky-500/20 border-sky-500/40 text-sky-200',
    cyan: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200',
    teal: 'bg-teal-500/20 border-teal-500/40 text-teal-200',
    emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200',
    green: 'bg-green-500/20 border-green-500/40 text-green-200',
    lime: 'bg-lime-500/20 border-lime-500/40 text-lime-200',
    yellow: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-200',
    amber: 'bg-amber-500/20 border-amber-500/40 text-amber-200',
    orange: 'bg-orange-500/20 border-orange-500/40 text-orange-200',
    red: 'bg-red-500/20 border-red-500/40 text-red-200',
  };

  const colorClass = event.color && colorMap[event.color]
    ? colorMap[event.color]
    : 'bg-white/10 border-white/20 text-white/90';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`All day event: ${event.title}${event.where ? `, ${event.where}` : ''}`}
      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs cursor-pointer hover:brightness-110 transition-all truncate ${colorClass}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="truncate font-medium">{event.title}</span>
      {event.where && (
        <span className="truncate opacity-70 hidden sm:inline">- {event.where}</span>
      )}
    </div>
  );
});

/**
 * Callback when user drags to create a new event
 */
export type OnCreateDraft = (draft: {
  calendar_id: string;
  starts_at: string;
  ends_at: string;
}) => void;

/**
 * Callback when user clicks an existing event to edit
 */
export type OnEditEvent = (id: string, init: {
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
  selectedDate?: Date;        // used when mode === 'day'
  events: CalendarEvent[];
  dayStartHour?: number;      // default 6
  dayEndHour?: number;        // default 22
  primaryCalendarId?: string; // For creating new events
  onCreateDraft?: OnCreateDraft;
  onEditEvent?: OnEditEvent;
};

const MINUTE_PX = 1;          // 60px per hour (tweak for density)
const COL_GUTTER_PX = 4;      // space between overlapping columns
// const MIN_COL_WIDTH_PX = 100; // minimum column width before showing "+X more" (reserved for future use)

export default function WeekGrid({
  mode = 'week',
  weekStart,
  selectedDate,
  events,
  dayStartHour = 6,
  dayEndHour = 22,
  primaryCalendarId,
  onCreateDraft,
  onEditEvent,
}: Props) {
  // Enhanced Time Grid hook for working hours overlay and current time
  const { workingHours, currentTime } = useTimeGrid();

  // Popover state for event details
  const [popover, setPopover] = useState<{
    anchor: DOMRect;
    event: CalendarEvent & { start: string; end: string };
  } | null>(null);

  // Which days are we rendering?
  const base = mode === 'day'
    ? startOfDay(selectedDate ?? new Date())
    : startOfWeek(weekStart ?? new Date(), 0);

  const days = useMemo(
    () => (mode === 'day' ? [base] : Array.from({ length: 7 }, (_, i) => addDays(base, i))),
    [mode, base]
  );

  const dayHeight = (dayEndHour - dayStartHour) * 60 * MINUTE_PX;

  // Filter events into all-day and timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];

    events.forEach(ev => {
      if (ev.all_day) {
        allDay.push(ev);
      } else {
        timed.push(ev);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  // Get all-day events for a specific day
  const getAllDayEventsForDay = useCallback((day: Date): CalendarEvent[] => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    return allDayEvents.filter(ev => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      // Event overlaps with this day
      return evStart <= dayEnd && evEnd >= dayStart;
    });
  }, [allDayEvents]);

  // Close popover callback
  const closePopover = useCallback(() => {
    setPopover(null);
  }, []);

  /**
   * Converts a Date to local datetime-local input format (YYYY-MM-DDTHH:mm)
   */
  const toLocalInputFormat = useCallback((date: Date): string => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }, []);

  /**
   * Handles drag-to-create on a day column
   * Captures mouse down, tracks movement, and calls onCreateDraft on mouse up
   */
  const handleDayMouseDown = useCallback(
    (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
      if (!primaryCalendarId || !onCreateDraft) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const startY = e.clientY - rect.top;
      const startMinute = Math.max(0, Math.round(startY / MINUTE_PX));

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mouseup', handleMouseUp);

        const endY = upEvent.clientY - rect.top;
        const endMinute = Math.max(0, Math.round(endY / MINUTE_PX));

        const minStart = Math.min(startMinute, endMinute);
        const maxEnd = Math.max(startMinute, endMinute);

        // Minimum 30-minute event
        const finalStart = minStart;
        const finalEnd = Math.max(minStart + 30, maxEnd);

        // Calculate actual start/end times
        const start = new Date(day);
        start.setHours(dayStartHour, 0, 0, 0);
        start.setMinutes(start.getMinutes() + finalStart);

        const end = new Date(day);
        end.setHours(dayStartHour, 0, 0, 0);
        end.setMinutes(end.getMinutes() + finalEnd);

        onCreateDraft({
          calendar_id: primaryCalendarId,
          starts_at: toLocalInputFormat(start),
          ends_at: toLocalInputFormat(end),
        });
      };

      document.addEventListener('mouseup', handleMouseUp);
    },
    [dayStartHour, primaryCalendarId, onCreateDraft, toLocalInputFormat]
  );

  /**
   * Handles click on an event segment to open edit modal
   */
  const handleEventEditClick = useCallback(
    (ev: { id: string | number; title: string; where?: string; color?: string; _s: number; _e: number }) => {
      if (!onEditEvent || !primaryCalendarId) return;

      onEditEvent(String(ev.id), {
        id: String(ev.id),
        calendar_id: primaryCalendarId,
        title: ev.title,
        location: ev.where,
        color: ev.color,
        starts_at: toLocalInputFormat(new Date(ev._s)),
        ends_at: toLocalInputFormat(new Date(ev._e)),
      });
    },
    [onEditEvent, primaryCalendarId, toLocalInputFormat]
  );

  /**
   * Handles click on an all-day event to open edit modal
   */
  const handleAllDayEventClick = useCallback(
    (ev: CalendarEvent) => {
      if (!onEditEvent || !primaryCalendarId) return;

      onEditEvent(String(ev.id), {
        id: String(ev.id),
        calendar_id: primaryCalendarId,
        title: ev.title,
        location: ev.where,
        color: ev.color,
        starts_at: toLocalInputFormat(new Date(ev.start)),
        ends_at: toLocalInputFormat(new Date(ev.end)),
      });
    },
    [onEditEvent, primaryCalendarId, toLocalInputFormat]
  );

  // ---- Segment-based overlap layout (Google Calendar–style) ---------------
  // Split each day into vertical segments at event boundaries, then assign
  // consistent column positions to all overlapping events within each group.
  // This function is called for each day, results are memoized via useMemo below
  const layoutDayFn = useCallback((day: Date): Segment[] => {
    const dayStart = new Date(day);
    dayStart.setHours(dayStartHour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(dayEndHour, 0, 0, 0);

    // Filter and clamp events to the visible day window (only timed events, not all-day)
    const dayEvents = timedEvents
      .map((ev) => {
        const s = new Date(ev.start);
        const e = new Date(ev.end);

        // Overlap test: starts before dayEnd AND ends after dayStart
        const overlapsDay = s.getTime() < dayEnd.getTime() && e.getTime() > dayStart.getTime();
        if (!overlapsDay) return null;

        // Clamp to visible window
        const startMs = Math.max(s.getTime(), dayStart.getTime());
        const endMs = Math.min(e.getTime(), dayEnd.getTime());
        if (endMs <= startMs) return null;

        return {
          ...ev,
          _s: startMs,
          _e: endMs,
        };
      })
      .filter(Boolean) as Array<CalendarEvent & { _s: number; _e: number }>;

    if (dayEvents.length === 0) return [];

    // Sort by start time, then by end time (longer events first for better column assignment)
    dayEvents.sort((a, b) => a._s - b._s || b._e - a._e);

    // Step 1: Assign each event to a collision group using sweep line
    type EventWithGroup = (typeof dayEvents)[number] & { groupId: number; col: number };
    const eventsWithGroups: EventWithGroup[] = [];
    let groupId = 0;
    let activeGroup: EventWithGroup[] = [];

    for (const ev of dayEvents) {
      // Remove events that no longer overlap
      activeGroup = activeGroup.filter((a) => a._e > ev._s);

      // Start a new group if no active events
      if (activeGroup.length === 0) groupId++;

      // Find the lowest available column
      const takenCols = new Set(activeGroup.map((a) => a.col));
      let col = 0;
      while (takenCols.has(col)) col++;

      const eventWithGroup: EventWithGroup = { ...ev, groupId, col };
      activeGroup.push(eventWithGroup);
      eventsWithGroups.push(eventWithGroup);
    }

    // Step 2: Group events by collision group
    const groups = new Map<number, EventWithGroup[]>();
    eventsWithGroups.forEach((e) => {
      const arr = groups.get(e.groupId) || [];
      arr.push(e);
      groups.set(e.groupId, arr);
    });

    // Step 3: For each group, create segments at all unique boundaries
    type Segment = {
      id: string | number;
      title: string;
      where?: string;
      color?: string;
      _s: number;
      _e: number;
      col: number;
      styleLeft: string;
      styleWidth: string;
      top: number;
      height: number;
      _segId: string;
      z: number;
    };

    const allSegments: Segment[] = [];

    groups.forEach((groupEvents) => {
      // Collect all unique time boundaries in this group
      const boundaries = new Set<number>();
      groupEvents.forEach((e) => {
        boundaries.add(e._s);
        boundaries.add(e._e);
      });
      const sortedBounds = Array.from(boundaries).sort((a, b) => a - b);

      // Process each vertical segment
      for (let i = 0; i < sortedBounds.length - 1; i++) {
        const segStart = sortedBounds[i];
        const segEnd = sortedBounds[i + 1];
        if (segEnd <= segStart) continue;

        // Find all events active in this segment
        const activeInSegment = groupEvents
          .filter((e) => e._s < segEnd && e._e > segStart)
          .sort((a, b) => a.col - b.col); // Sort by assigned column

        const numCols = Math.max(...activeInSegment.map((e) => e.col)) + 1;
        const totalGutter = (numCols - 1) * COL_GUTTER_PX;
        const widthCalc = `calc((100% - ${totalGutter}px) / ${numCols})`;

        // Create a segment for each active event
        activeInSegment.forEach((e) => {
          const leftCalc = e.col === 0 ? '0px' : `calc((${widthCalc} + ${COL_GUTTER_PX}px) * ${e.col})`;
          const top = ((segStart - dayStart.getTime()) / 60000) * MINUTE_PX;
          const height = ((segEnd - segStart) / 60000) * MINUTE_PX;

          allSegments.push({
            id: e.id,
            title: e.title,
            where: e.where,
            color: e.color,
            _s: segStart,
            _e: segEnd,
            col: e.col,
            styleLeft: leftCalc,
            styleWidth: widthCalc,
            top,
            height,
            _segId: `${e.id}-${segStart}`,
            z: 10 + e.col,
          });
        });
      }
    });

    // Step 4: Merge adjacent segments with identical positioning
    const merged: Segment[] = [];
    const byEvent = new Map<string | number, Segment[]>();

    allSegments.forEach((seg) => {
      const arr = byEvent.get(seg.id) || [];
      arr.push(seg);
      byEvent.set(seg.id, arr);
    });

    byEvent.forEach((segs) => {
      segs.sort((a, b) => a._s - b._s);

      let current = segs[0];
      for (let i = 1; i < segs.length; i++) {
        const next = segs[i];
        // Merge if adjacent and same positioning
        if (
          next._s === current._e &&
          next.styleLeft === current.styleLeft &&
          next.styleWidth === current.styleWidth
        ) {
          current = {
            ...current,
            _e: next._e,
            height: current.height + next.height,
          };
        } else {
          merged.push(current);
          current = next;
        }
      }
      merged.push(current);
    });

    return merged;
  }, [timedEvents, dayStartHour, dayEndHour]);

  // Memoize layout results for all days to prevent recalculation
  const dayLayouts = useMemo(() => {
    return days.map(day => layoutDayFn(day));
  }, [days, layoutDayFn]);

  // Now marker
  const nowMarker = (() => {
    const now = new Date();
    const first = new Date(days[0]); first.setHours(0,0,0,0);
    const last  = new Date(days[days.length - 1]); last.setHours(23,59,59,999);
    if (now < first || now > last) return null;

    const minute = now.getHours() * 60 + now.getMinutes();
    return {
      dayIndex: mode === 'day' ? 0 : now.getDay(),
      minute,
    };
  })();

  // ---------- Mobile: stacked days ----------
  const StackedDays = (
    <div className="space-y-5">
      {days.map((d, i) => {
        const isToday = new Date().toDateString() === d.toDateString();
        const items = dayLayouts[i];
        const dayAllDayEvents = getAllDayEventsForDay(d);
        return (
          <section key={i} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-white/10 bg-white/5 backdrop-blur-sm px-3 py-2">
              <div className={`text-[clamp(0.95rem,2.5vw,1.05rem)] ${isToday ? 'font-semibold' : 'opacity-85'}`}>
                {d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              {isToday && (
                <span className="rounded bg-sky-400/15 px-2 py-0.5 text-xs text-sky-300">Today</span>
              )}
            </header>

            {/* All-day events section */}
            {dayAllDayEvents.length > 0 && (
              <div className="border-b border-white/10 bg-white/3 px-3 py-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] uppercase tracking-wide opacity-60">All day</span>
                </div>
                <div className="flex flex-col gap-1">
                  {dayAllDayEvents.map((ev) => (
                    <AllDayEventBanner
                      key={ev.id}
                      event={ev}
                      onClick={() => handleAllDayEventClick(ev)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div
              className="relative cursor-crosshair"
              style={{ height: dayHeight }}
              onMouseDown={(e) => {
                // Only trigger drag-to-create if clicking on empty space (not an event)
                if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.hour-grid')) {
                  handleDayMouseDown(d, e);
                }
              }}
            >
              {/* hour grid with visual hierarchy */}
              <div className="absolute inset-0 hour-grid">
                {Array.from({ length: (dayEndHour - dayStartHour) + 1 }).map((_, idx) => {
                  const h = dayStartHour + idx;
                  const isThirdHour = idx % 3 === 0;
              return (
                <div key={idx} className="relative" style={{ height: 60 * MINUTE_PX }}>
                  <div className={`absolute inset-x-0 top-0 h-px ${isThirdHour ? 'bg-white/20' : 'bg-white/10'}`} />
                  {h % 2 === 0 && (
                    <div className="absolute left-2 top-0 -translate-y-1/2 text-[11px] opacity-60">
                      {((h + 11) % 12) + 1}{h >= 12 ? 'p' : 'a'}
                    </div>
                  )}
                </div>
              );
                })}
              </div>

              {/* today tint */}
              {isToday && <div className="pointer-events-none absolute inset-0 bg-sky-400/5" />}

              {/* Working hours overlay */}
              <WorkingHoursOverlay
                workingStart={workingHours.start}
                workingEnd={workingHours.end}
                dayStartHour={dayStartHour}
                dayEndHour={dayEndHour}
                slotHeight={60}
              />

              {/* Current time indicator */}
              {isToday && (
                <CurrentTimeIndicator
                  currentTime={currentTime}
                  startHour={dayStartHour}
                  endHour={dayEndHour}
                  slotHeight={60}
                />
              )}

              {/* events with interactions */}
              <div className="relative h-full w-full">
                {items.map((ev) => (
                  <div
                    key={ev._segId ?? ev.id}
                    className="absolute px-1 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${ev.title}, ${ev.where || ''}`}
                    style={{ top: ev.top, height: ev.height, left: ev.styleLeft, width: ev.styleWidth, zIndex: ev.z ?? 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEventEditClick(ev);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleEventEditClick(ev);
                      }
                    }}
                  >
                    <EventCard
                      title={ev.title}
                      where={ev.where}
                      color={ev.color}
                      height={ev.height}
                      startTime={new Date(ev._s).toISOString()}
                      endTime={new Date(ev._e).toISOString()}
                    />
                  </div>
                ))}
              </div>

              {/* now line */}
              {nowMarker &&
                ((mode === 'day' && i === 0) || (mode === 'week' && nowMarker.dayIndex === i)) &&
                nowMarker.minute >= dayStartHour * 60 &&
                nowMarker.minute <= dayEndHour * 60 && (
                  <div
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: (nowMarker.minute - dayStartHour * 60) * MINUTE_PX }}
                  >
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-zinc-900 bg-rose-400" />
                    <div className="h-px w-full bg-rose-400/80" />
                  </div>
                )}
            </div>
          </section>
        );
      })}
    </div>
  );

  // ---------- Desktop: full week grid ----------
  const DesktopWeek = (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {/* headers - responsive grid: 2 days on md, 4 on lg, 7 on xl */}
      <div className="grid grid-cols-[minmax(60px,90px)_repeat(2,1fr)] md:grid-cols-[minmax(70px,100px)_repeat(4,1fr)] lg:grid-cols-[minmax(70px,110px)_repeat(7,1fr)] border-b border-white/10">
        <div className="sticky left-0 z-20 bg-white/5 px-2 md:px-3 py-2 text-[clamp(0.7rem,1vw,0.8rem)] opacity-70">Time</div>
        {days.slice(0, 2).map((d, i) => {
          const isToday = new Date().toDateString() === d.toDateString();
          const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <div
              key={i}
              className={`px-2 md:px-3 py-2 text-[clamp(0.7rem,1vw,0.85rem)] ${isToday ? 'font-semibold' : 'opacity-80'} lg:hidden`}
              aria-current={isToday ? 'date' : undefined}
            >
              {label}
            </div>
          );
        })}
        {days.slice(0, 4).map((d, i) => {
          const isToday = new Date().toDateString() === d.toDateString();
          const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <div
              key={i}
              className={`hidden md:block lg:hidden px-2 md:px-3 py-2 text-[clamp(0.7rem,1vw,0.85rem)] ${isToday ? 'font-semibold' : 'opacity-80'}`}
              aria-current={isToday ? 'date' : undefined}
            >
              {label}
            </div>
          );
        })}
        {days.map((d, i) => {
          const isToday = new Date().toDateString() === d.toDateString();
          const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <div
              key={i}
              className={`hidden lg:block px-3 py-2 text-[clamp(0.7rem,1vw,0.85rem)] ${isToday ? 'font-semibold' : 'opacity-80'}`}
              aria-current={isToday ? 'date' : undefined}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* All-day events section - desktop */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[minmax(60px,90px)_repeat(2,1fr)] md:grid-cols-[minmax(70px,100px)_repeat(4,1fr)] lg:grid-cols-[minmax(70px,110px)_repeat(7,1fr)] border-b border-white/10 bg-white/3">
          {/* Label cell */}
          <div className="sticky left-0 z-10 bg-white/3 px-2 md:px-3 py-1.5 text-[10px] uppercase tracking-wide opacity-60 flex items-center">
            All day
          </div>
          {/* 2-day view (base breakpoint) */}
          {days.slice(0, 2).map((d, i) => {
            const dayAllDayEvents = getAllDayEventsForDay(d);
            return (
              <div key={`allday-2-${i}`} className="border-l border-white/10 px-1 py-1.5 lg:hidden">
                <div className="flex flex-col gap-1">
                  {dayAllDayEvents.map((ev) => (
                    <AllDayEventBanner
                      key={ev.id}
                      event={ev}
                      onClick={() => handleAllDayEventClick(ev)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {/* 4-day view (md breakpoint) */}
          {days.slice(0, 4).map((d, i) => {
            const dayAllDayEvents = getAllDayEventsForDay(d);
            return (
              <div key={`allday-4-${i}`} className="hidden md:block lg:hidden border-l border-white/10 px-1 py-1.5">
                <div className="flex flex-col gap-1">
                  {dayAllDayEvents.map((ev) => (
                    <AllDayEventBanner
                      key={ev.id}
                      event={ev}
                      onClick={() => handleAllDayEventClick(ev)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {/* 7-day view (lg breakpoint) */}
          {days.map((d, i) => {
            const dayAllDayEvents = getAllDayEventsForDay(d);
            return (
              <div key={`allday-7-${i}`} className="hidden lg:block border-l border-white/10 px-1 py-1.5">
                <div className="flex flex-col gap-1">
                  {dayAllDayEvents.map((ev) => (
                    <AllDayEventBanner
                      key={ev.id}
                      event={ev}
                      onClick={() => handleAllDayEventClick(ev)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative grid grid-cols-[minmax(60px,90px)_repeat(2,1fr)] md:grid-cols-[minmax(70px,100px)_repeat(4,1fr)] lg:grid-cols-[minmax(70px,110px)_repeat(7,1fr)]">
        {/* time rail - sticky */}
        <div className="sticky left-0 z-10 bg-white/5">
          <div className="relative" style={{ height: dayHeight }}>
            {Array.from({ length: (dayEndHour - dayStartHour) + 1 }).map((_, idx) => {
              const h = dayStartHour + idx;
              const isThirdHour = idx % 3 === 0;
              return (
                <div key={idx} className="relative" style={{ height: 60 * MINUTE_PX }}>
                  <div className="pl-2 md:pl-3 text-[10px] md:text-[11px] opacity-60">
                    {((h + 11) % 12) + 1} {h >= 12 ? 'PM' : 'AM'}
                  </div>
                  <div className={`absolute inset-x-0 top-0 h-px ${isThirdHour ? 'bg-white/20' : 'bg-white/10'}`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* day columns - show 2 on base, 4 on md, 7 on lg */}
        {/* 2-day view (base breakpoint) */}
        {days.slice(0, 2).map((d, i) => (
          <DayColumn
            key={`2day-${i}`}
            day={d}
            items={dayLayouts[i]}
            isToday={new Date().toDateString() === d.toDateString()}
            dayHeight={dayHeight}
            dayStartHour={dayStartHour}
            dayEndHour={dayEndHour}
            nowMarker={nowMarker}
            dayIndex={i}
            mode={mode}
            onMouseDown={(e) => handleDayMouseDown(d, e)}
            onEventClick={handleEventEditClick}
            workingHoursStart={workingHours.start}
            workingHoursEnd={workingHours.end}
            currentTime={currentTime}
            className="lg:hidden"
          />
        ))}
        {/* 4-day view (md breakpoint) */}
        {days.slice(0, 4).map((d, i) => (
          <DayColumn
            key={`4day-${i}`}
            day={d}
            items={dayLayouts[i]}
            isToday={new Date().toDateString() === d.toDateString()}
            dayHeight={dayHeight}
            dayStartHour={dayStartHour}
            dayEndHour={dayEndHour}
            nowMarker={nowMarker}
            dayIndex={i}
            mode={mode}
            onMouseDown={(e) => handleDayMouseDown(d, e)}
            onEventClick={handleEventEditClick}
            workingHoursStart={workingHours.start}
            workingHoursEnd={workingHours.end}
            currentTime={currentTime}
            className="hidden md:block lg:hidden"
          />
        ))}
        {/* 7-day view (lg breakpoint) */}
        {days.map((d, i) => (
          <DayColumn
            key={`7day-${i}`}
            day={d}
            items={dayLayouts[i]}
            isToday={new Date().toDateString() === d.toDateString()}
            dayHeight={dayHeight}
            dayStartHour={dayStartHour}
            dayEndHour={dayEndHour}
            nowMarker={nowMarker}
            dayIndex={i}
            mode={mode}
            onMouseDown={(e) => handleDayMouseDown(d, e)}
            onEventClick={handleEventEditClick}
            workingHoursStart={workingHours.start}
            workingHoursEnd={workingHours.end}
            currentTime={currentTime}
            className="hidden lg:block"
          />
        ))}
      </div>
    </div>
  );

  // outer container — fluid height + responsive switch + horizontal scroll support
  return (
    <>
      <div className="relative h-[calc(100vh-9rem)] overflow-auto">
        {mode === 'day' ? (
          <div>{StackedDays}</div>
        ) : (
          <>
            <div className="block md:hidden">{StackedDays}</div>
            <div className="hidden md:block">{DesktopWeek}</div>
          </>
        )}
      </div>

      {/* Event popover */}
      {popover && (
        <EventPopover
          anchor={popover.anchor}
          event={popover.event}
          onClose={closePopover}
          onEdit={() => {
            closePopover();
            alert('Edit functionality coming soon');
          }}
          onDelete={() => {
            closePopover();
            if (confirm(`Delete "${popover.event.title}"?`)) {
              alert('Delete functionality coming soon');
            }
          }}
        />
      )}
    </>
  );
}