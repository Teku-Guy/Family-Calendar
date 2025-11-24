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

export default function QuickAddModal({
  open,
  onClose,
  selectedDate,
  primaryCalendarId,
  onSaved,
}: QuickAddModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [detectedStart, setDetectedStart] = useState<Date | null>(null);
  const [detectedEnd, setDetectedEnd] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setInputValue('');
      setDetectedStart(null);
      setDetectedEnd(null);
      setIsSubmitting(false);
      // Focus input after modal animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Parse natural language with chrono-node (debounced)
  useEffect(() => {
    if (!inputValue.trim()) {
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
          setDetectedStart(result.start.date());
          setDetectedEnd(result.end?.date() || null);
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
  }, [inputValue, selectedDate]);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!inputValue.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Determine start and end times
      let startTime: Date;
      let endTime: Date;

      if (detectedStart) {
        startTime = detectedStart;
        // If end time detected, use it. Otherwise, add 1 hour
        endTime = detectedEnd || new Date(detectedStart.getTime() + 60 * 60 * 1000);
      } else {
        // No parsing detected, use default time on selected date
        startTime = new Date(selectedDate);
        startTime.setHours(9, 0, 0, 0); // Default to 9 AM
        endTime = new Date(startTime);
        endTime.setHours(10, 0, 0, 0); // 1 hour duration
      }

      // Convert to datetime-local format (YYYY-MM-DDTHH:mm)
      const offset = startTime.getTimezoneOffset() * 60000;
      const starts_at = new Date(startTime.getTime() - offset).toISOString().slice(0, 16);
      const ends_at = new Date(endTime.getTime() - offset).toISOString().slice(0, 16);

      // Create event via API
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_id: primaryCalendarId,
          title: inputValue,
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
  }, [inputValue, detectedStart, detectedEnd, selectedDate, primaryCalendarId, onSaved, onClose, isSubmitting]);

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

          {/* Natural language input */}
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
              disabled={!inputValue.trim() || isSubmitting}
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
