'use client';

import { useMemo } from 'react';

interface WorkingHoursOverlayProps {
  workingStart: number; // Hour (0-23), e.g., 9 for 9am
  workingEnd: number;   // Hour (0-23), e.g., 17 for 5pm
  dayStartHour: number; // e.g., 0 or 6
  dayEndHour: number;   // e.g., 24 or 22
  slotHeight: number;   // pixels per hour
  className?: string;
}

export default function WorkingHoursOverlay({
  workingStart,
  workingEnd,
  dayStartHour,
  dayEndHour,
  slotHeight,
  className = '',
}: WorkingHoursOverlayProps) {
  // Calculate overlay positions
  const overlayRegions = useMemo(() => {
    const regions: Array<{ top: number; height: number }> = [];

    // Before working hours (if any)
    if (workingStart > dayStartHour) {
      const beforeHeight = (workingStart - dayStartHour) * slotHeight;
      regions.push({
        top: 0,
        height: beforeHeight,
      });
    }

    // After working hours (if any)
    if (workingEnd < dayEndHour) {
      const afterTop = (workingEnd - dayStartHour) * slotHeight;
      const afterHeight = (dayEndHour - workingEnd) * slotHeight;
      regions.push({
        top: afterTop,
        height: afterHeight,
      });
    }

    return regions;
  }, [workingStart, workingEnd, dayStartHour, dayEndHour, slotHeight]);

  if (overlayRegions.length === 0) {
    return null; // No non-working hours to overlay
  }

  return (
    <>
      {overlayRegions.map((region, index) => (
        <div
          key={index}
          className={`absolute left-0 right-0 pointer-events-none bg-gray-100/40 dark:bg-gray-800/40 ${className}`}
          style={{
            top: `${region.top}px`,
            height: `${region.height}px`,
          }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
