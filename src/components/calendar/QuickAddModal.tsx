'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as chrono from 'chrono-node';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  primaryCalendarId: string;
  onSaved?: (event: any) => void;
}

type InputMode = 'natural' | 'manual';

export default function QuickAddModal({
  open,
  onClose,
  selectedDate,
  primaryCalendarId,
  onSaved,
}: QuickAddModalProps) {
  const [inputMode, setInputMode] = useState<InputMode>('natural');
  const [inputValue, setInputValue] = useState('');

  // NLP detection state
  const [detectedStart, setDetectedStart] = useState<Date | null>(null);
  const [detectedEnd, setDetectedEnd] = useState<Date | null>(null);

  // Manual input state
  const [manualDate, setManualDate] = useState('');
  const [manualStartHour, setManualStartHour] = useState('9');
  const [manualStartMinute, setManualStartMinute] = useState('00');
  const [manualStartPeriod, setManualStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [manualEndHour, setManualEndHour] = useState('10');
  const [manualEndMinute, setManualEndMinute] = useState('00');
  const [manualEndPeriod, setManualEndPeriod] = useState<'AM' | 'PM'>('AM');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setInputMode('natural');
      setInputValue('');
      setDetectedStart(null);
      setDetectedEnd(null);
      setIsSubmitting(false);

      // Initialize manual date picker with selected date
      const offset = selectedDate.getTimezoneOffset() * 60000;
      const localDate = new Date(selectedDate.getTime() - offset);
      setManualDate(localDate.toISOString().slice(0, 10));

      // Initialize time pickers with 9am-10am default
      setManualStartHour('9');
      setManualStartMinute('00');
      setManualStartPeriod('AM');
      setManualEndHour('10');
      setManualEndMinute('00');
      setManualEndPeriod('AM');

      // Focus input after modal animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, selectedDate]);

  // Parse natural language with chrono-node (debounced)
  useEffect(() => {
    if (!inputValue.trim() || inputMode !== 'natural') {
      setDetectedStart(null);
      setDetectedEnd(null);
      return;
    }

    const timer = setTimeout(() => {
      try {
        // Parse with selected date as reference
        const parsed = chrono.parse(inputValue, selectedDate, { forwardDate: true });

        if (parsed.length > 0) {
          const result = parsed[0];
          const start = result.start.date();
          const end = result.end?.date() || null;

          setDetectedStart(start);
          setDetectedEnd(end);

          // Sync to manual inputs
          syncNLPToManual(start, end);
        } else {
          setDetectedStart(null);
          setDetectedEnd(null);
        }
      } catch (error) {
        console.warn('[QuickAddModal] Parse error:', error);
        setDetectedStart(null);
        setDetectedEnd(null);
      }
    }, 250); // Debounce 250ms

    return () => clearTimeout(timer);
  }, [inputValue, selectedDate, inputMode]);

  // Sync NLP-detected times to manual inputs
  const syncNLPToManual = useCallback((start: Date, end: Date | null) => {
    // Update date
    const offset = start.getTimezoneOffset() * 60000;
    const localDate = new Date(start.getTime() - offset);
    setManualDate(localDate.toISOString().slice(0, 10));

    // Update start time
    let startHour = start.getHours();
    const startPeriod = startHour >= 12 ? 'PM' : 'AM';
    if (startHour === 0) startHour = 12;
    else if (startHour > 12) startHour -= 12;
    setManualStartHour(String(startHour));
    setManualStartMinute(String(start.getMinutes()).padStart(2, '0'));
    setManualStartPeriod(startPeriod);

    // Update end time
    const endDate = end || new Date(start.getTime() + 60 * 60 * 1000);
    let endHour = endDate.getHours();
    const endPeriod = endHour >= 12 ? 'PM' : 'AM';
    if (endHour === 0) endHour = 12;
    else if (endHour > 12) endHour -= 12;
    setManualEndHour(String(endHour));
    setManualEndMinute(String(endDate.getMinutes()).padStart(2, '0'));
    setManualEndPeriod(endPeriod);
  }, []);

  // Convert 12-hour time to Date object
  const parseManualTime = useCallback((
    dateStr: string,
    hour: string,
    minute: string,
    period: 'AM' | 'PM'
  ): Date => {
    const date = new Date(dateStr + 'T00:00:00');
    let hour24 = parseInt(hour, 10);

    if (period === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period === 'AM' && hour24 === 12) {
      hour24 = 0;
    }

    date.setHours(hour24, parseInt(minute, 10), 0, 0);
    return date;
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (isSubmitting) return;

    // Natural mode requires input
    if (inputMode === 'natural' && !inputValue.trim()) return;

    setIsSubmitting(true);

    try {
      // Determine start and end times based on mode
      let startTime: Date;
      let endTime: Date;

      if (inputMode === 'natural') {
        if (detectedStart) {
          startTime = detectedStart;
          endTime = detectedEnd || new Date(detectedStart.getTime() + 60 * 60 * 1000);
        } else {
          // No parsing detected, use default time on selected date
          startTime = new Date(selectedDate);
          startTime.setHours(9, 0, 0, 0);
          endTime = new Date(startTime);
          endTime.setHours(10, 0, 0, 0);
        }
      } else {
        // Manual mode
        startTime = parseManualTime(manualDate, manualStartHour, manualStartMinute, manualStartPeriod);
        endTime = parseManualTime(manualDate, manualEndHour, manualEndMinute, manualEndPeriod);

        // Ensure end is after start
        if (endTime <= startTime) {
          endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        }
      }

      // Convert to ISO 8601 format (required by API validation)
      const starts_at = startTime.toISOString();
      const ends_at = endTime.toISOString();

      // Get title (from natural input or default)
      const title = inputMode === 'natural' ? inputValue : (inputValue || 'New Event');

      // Create event via API
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_id: primaryCalendarId,
          title,
          starts_at,
          ends_at,
          all_day: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      const savedEvent = await response.json();

      // Notify parent
      onSaved?.(savedEvent);

      // Close modal
      onClose();
    } catch (error) {
      console.error('[QuickAddModal] Create error:', error);
      alert('Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    inputValue,
    inputMode,
    detectedStart,
    detectedEnd,
    selectedDate,
    primaryCalendarId,
    onSaved,
    onClose,
    isSubmitting,
    manualDate,
    manualStartHour,
    manualStartMinute,
    manualStartPeriod,
    manualEndHour,
    manualEndMinute,
    manualEndPeriod,
    parseManualTime,
  ]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose, isSubmitting]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  }, [onClose, isSubmitting]);

  if (!open) return null;

  // Generate hour options (1-12)
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  // Generate minute options (00, 15, 30, 45)
  const minutes = ['00', '15', '30', '45'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-title"
    >
      <div
        className="relative w-full max-w-lg bg-zinc-900 rounded-xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 id="quick-add-title" className="text-lg font-semibold text-white">
            Quick Add Event
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/60 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Date indicator */}
          <div className="flex items-center gap-2 text-sm text-white/60">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
            <button
              type="button"
              onClick={() => setInputMode('natural')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                inputMode === 'natural'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              Natural Language
            </button>
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                inputMode === 'manual'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              Manual
            </button>
          </div>

          {/* Natural language input */}
          {inputMode === 'natural' && (
            <>
              <div>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="e.g., Lunch at 1pm, Team meeting tomorrow at 3pm"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  aria-label="Event description"
                />
              </div>

              {/* Detected date/time preview */}
              {detectedStart && (
                <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <div className="font-medium text-green-300">Detected time:</div>
                    <div className="text-green-200/80">
                      {detectedStart.toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                      {detectedEnd && (
                        <span>
                          {' '}- {detectedEnd.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Help text */}
              <div className="text-xs text-white/40">
                Tip: Try natural language like "Dinner at 7pm" or "Meeting next Tuesday at 2pm"
              </div>
            </>
          )}

          {/* Manual input */}
          {inputMode === 'manual' && (
            <div className="space-y-4">
              {/* Event title */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Event Title
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="New Event"
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {/* Date picker */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {/* Start time picker */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Start Time
                </label>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <select
                    value={manualStartHour}
                    onChange={(e) => setManualStartHour(e.target.value)}
                    disabled={isSubmitting}
                    className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {hours.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <select
                    value={manualStartMinute}
                    onChange={(e) => setManualStartMinute(e.target.value)}
                    disabled={isSubmitting}
                    className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {minutes.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="flex rounded-lg overflow-hidden border border-white/10">
                    <button
                      type="button"
                      onClick={() => setManualStartPeriod('AM')}
                      className={`px-3 py-2.5 text-sm font-medium transition-colors ${
                        manualStartPeriod === 'AM'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 text-white/70 hover:text-white'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualStartPeriod('PM')}
                      className={`px-3 py-2.5 text-sm font-medium transition-colors border-l border-white/10 ${
                        manualStartPeriod === 'PM'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 text-white/70 hover:text-white'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* End time picker */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  End Time
                </label>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <select
                    value={manualEndHour}
                    onChange={(e) => setManualEndHour(e.target.value)}
                    disabled={isSubmitting}
                    className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {hours.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <select
                    value={manualEndMinute}
                    onChange={(e) => setManualEndMinute(e.target.value)}
                    disabled={isSubmitting}
                    className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {minutes.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="flex rounded-lg overflow-hidden border border-white/10">
                    <button
                      type="button"
                      onClick={() => setManualEndPeriod('AM')}
                      className={`px-3 py-2.5 text-sm font-medium transition-colors ${
                        manualEndPeriod === 'AM'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 text-white/70 hover:text-white'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualEndPeriod('PM')}
                      className={`px-3 py-2.5 text-sm font-medium transition-colors border-l border-white/10 ${
                        manualEndPeriod === 'PM'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 text-white/70 hover:text-white'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white/80 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
