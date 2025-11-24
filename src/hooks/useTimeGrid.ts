'use client';

import { useState, useEffect, useCallback } from 'react';

// Custom hook for localStorage with SSR safety
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Initialize from localStorage after mount (client-side only)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  const setValue = useCallback(
    (value: T) => {
      try {
        setStoredValue(value);
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  return [storedValue, setValue];
}

export interface WorkingHours {
  start: number; // Hour (0-23)
  end: number;   // Hour (0-23)
}

export type IntervalMinutes = 30 | 60;
export type ZoomLevel = 1 | 1.5 | 2;

export function useTimeGrid() {
  // Persisted settings
  const [intervalMinutes, setIntervalMinutes] = useLocalStorage<IntervalMinutes>(
    'calendar-interval',
    60
  );
  const [zoomLevel, setZoomLevel] = useLocalStorage<ZoomLevel>(
    'calendar-zoom',
    1
  );
  const [workingHours, setWorkingHours] = useLocalStorage<WorkingHours>(
    'calendar-working-hours',
    { start: 9, end: 17 }
  );

  // Current time updates every minute
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update current time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Calculate slot height based on zoom level
  const getSlotHeight = useCallback((): number => {
    const baseHeight = 48; // pixels per hour at 1x zoom
    return baseHeight * zoomLevel;
  }, [zoomLevel]);

  // Check if a given hour is within working hours
  const isWorkingHour = useCallback(
    (hour: number): boolean => {
      return hour >= workingHours.start && hour < workingHours.end;
    },
    [workingHours]
  );

  return {
    // State
    intervalMinutes,
    zoomLevel,
    workingHours,
    currentTime,

    // Setters
    setIntervalMinutes,
    setZoomLevel,
    setWorkingHours,

    // Helpers
    getSlotHeight,
    isWorkingHour,
  };
}
