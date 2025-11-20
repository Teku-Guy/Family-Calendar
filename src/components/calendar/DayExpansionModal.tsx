'use client';

import { useEffect, useRef, useCallback } from 'react';

type EventItem = {
  id: string;
  title: string;
  start: number;
  end: number;
  where?: string;
  color?: string;
  all_day?: boolean;
  _series?: {
    master_id: string;
    original_start: string;
    is_override?: boolean;
  };
};

type Props = {
  date: Date;
  events: EventItem[];
  onClose: () => void;
  onEventClick: (event: EventItem) => void;
};

export default function DayExpansionModal({
  date,
  events,
  onClose,
  onEventClick,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const firstEventRef = useRef<HTMLButtonElement>(null);

  const formatDate = (d: Date): string => {
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: number): string => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTimeRange = (start: number, end: number): string => {
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    const previouslyFocused = document.activeElement as HTMLElement;

    if (firstEventRef.current) {
      firstEventRef.current.focus();
    } else if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const sortedEvents = [...events].sort((a, b) => {
    if (a.all_day && !b.all_day) return -1;
    if (!a.all_day && b.all_day) return 1;
    return a.start - b.start;
  });

  const titleId = 'day-expansion-modal-title';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md mx-4 bg-zinc-900 rounded-xl shadow-2xl border border-zinc-700 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-zinc-700">
          <h2
            id={titleId}
            className="text-lg font-semibold text-zinc-100"
          >
            {formatDate(date)}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </p>
        </div>

        <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
          {sortedEvents.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No events</p>
          ) : (
            <ul className="space-y-2">
              {sortedEvents.map((event, index) => (
                <li key={event.id}>
                  <button
                    ref={index === 0 ? firstEventRef : undefined}
                    onClick={() => onEventClick(event)}
                    className="w-full text-left px-3 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 focus:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-1 h-full min-h-[2.5rem] rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: event.color || '#3b82f6',
                        }}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-100 truncate group-hover:text-white">
                          {event.title}
                        </p>
                        <p className="text-sm text-zinc-400 mt-0.5">
                          {event.all_day
                            ? 'All day'
                            : formatTimeRange(event.start, event.end)}
                        </p>
                        {event.where && (
                          <p className="text-sm text-zinc-500 mt-1 truncate">
                            {event.where}
                          </p>
                        )}
                        {event._series && (
                          <p className="text-xs text-zinc-600 mt-1">
                            Recurring event
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-700">
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
