'use client';

import { format } from 'date-fns';

interface EventPreviewContentProps {
  event: {
    id: string | number;
    title: string;
    start: string;
    end: string;
    where?: string;
    color?: string;
    all_day?: boolean;
    _series?: {
      master_id: string;
      original_start: string;
      is_override?: boolean;
    };
  };
  onTimeClick?: () => void;
}

export default function EventPreviewContent({ event, onTimeClick }: EventPreviewContentProps) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  const formatTime = (date: Date): string => {
    return format(date, 'h:mm a');
  };

  const formatDate = (date: Date): string => {
    return format(date, 'EEEE, MMMM d');
  };

  const isSameDay = (d1: Date, d2: Date): boolean => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  return (
    <div className="space-y-3">
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {event.title}
      </h3>

      {/* Date & Time */}
      <button
        onClick={onTimeClick}
        className="flex items-start gap-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group w-full"
      >
        <svg
          className="w-5 h-5 mt-0.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1">
          {event.all_day ? (
            <div>
              <div className="font-medium">{formatDate(startDate)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">All day</div>
            </div>
          ) : (
            <div>
              <div className="font-medium">{formatDate(startDate)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(startDate)} – {formatTime(endDate)}
                {!isSameDay(startDate, endDate) && (
                  <span className="ml-1">({formatDate(endDate)})</span>
                )}
              </div>
            </div>
          )}
        </div>
      </button>

      {/* Location */}
      {event.where && (
        <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <svg
            className="w-5 h-5 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <div className="flex-1 break-words">{event.where}</div>
        </div>
      )}

      {/* Recurring indicator */}
      {event._series && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Recurring event</span>
        </div>
      )}
    </div>
  );
}
