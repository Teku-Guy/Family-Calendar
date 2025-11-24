'use client';

import { useMemo } from 'react';

interface CurrentTimeIndicatorProps {
  currentTime: Date;
  startHour: number; // e.g., 0 for midnight, 6 for 6am
  endHour: number;   // e.g., 24 for midnight, 22 for 10pm
  slotHeight: number; // pixels per hour
  className?: string;
}

export default function CurrentTimeIndicator({
  currentTime,
  startHour,
  endHour,
  slotHeight,
  className = '',
}: CurrentTimeIndicatorProps) {
  // Calculate position of current time indicator
  const position = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    // Check if current time is within visible range
    if (hours < startHour || hours >= endHour) {
      return null; // Don't show indicator if outside visible hours
    }

    // Calculate offset from start hour
    const hoursFromStart = hours - startHour;
    const minuteFraction = minutes / 60;
    const totalOffset = (hoursFromStart + minuteFraction) * slotHeight;

    return totalOffset;
  }, [currentTime, startHour, endHour, slotHeight]);

  if (position === null) {
    return null; // Current time is outside visible range
  }

  return (
    <div
      className={`absolute left-0 right-0 z-20 flex items-center pointer-events-none ${className}`}
      style={{ top: `${position}px` }}
      aria-label={`Current time: ${currentTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}`}
    >
      {/* Circle marker */}
      <div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900 -ml-1.5" />

      {/* Line */}
      <div className="h-0.5 bg-red-500 flex-1" />
    </div>
  );
}
