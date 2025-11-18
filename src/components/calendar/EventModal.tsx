/**
 * EventModal.tsx - Modal for Creating/Editing Calendar Events
 *
 * This modal component handles both event creation and editing through a unified interface.
 * It supports standalone events, recurring series, and per-occurrence overrides.
 *
 * ## Features:
 * - Dual mode: create new events or edit existing ones
 * - Recurring events: Create series with RRULE
 * - Series editing: Choose to edit "this event" or "entire series"
 * - Form validation and error handling
 * - Delete confirmation with series awareness
 * - Accessible keyboard navigation (Esc to close)
 * - Loading states during server operations
 *
 * @example
 * ```tsx
 * // Create new event
 * <EventModal
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   defaults={{ calendar_id: 'uuid', starts_at: '2025-10-14T10:00', ends_at: '2025-10-14T11:00' }}
 *   mode="create"
 * />
 *
 * // Edit series instance
 * <EventModal
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   defaults={{
 *     id: 'uuid',
 *     calendar_id: 'uuid',
 *     title: 'Weekly Meeting',
 *     starts_at: '2025-10-14T10:00',
 *     ends_at: '2025-10-14T11:00',
 *     _series: { master_id: 'master-uuid', original_start: '2025-10-14T10:00:00.000Z' }
 *   }}
 *   mode="edit"
 * />
 * ```
 */

'use client';

import { useState, useEffect } from 'react';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  updateSeriesMaster,
  upsertOverride,
  addExdate,
  deleteSeriesMaster,
} from '@/app/calendar/_actions';
import { useToast } from '@/components/ui/Toaster';
import type { EventDraft, SeriesEditScope } from '@/types/events';
import RecurringPatternBuilder from './RecurringPatternBuilder';

type Props = {
  open: boolean;
  onClose: () => void;
  defaults: EventDraft;
  mode: 'create' | 'edit';
};

/**
 * Modal component for creating and editing calendar events
 */
export default function EventModal({ open, onClose, defaults, mode }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  // Series editing state: "this" (single occurrence) or "all" (entire series)
  const [seriesScope, setSeriesScope] = useState<SeriesEditScope>('this');

  // Whether this is a series instance (has _series metadata)
  const isSeriesInstance = !!defaults._series;

  // Recurring pattern state
  const [showRecurring, setShowRecurring] = useState(!!defaults.rrule);
  const [rrule, setRrule] = useState(defaults.rrule || '');
  const [startDate, setStartDate] = useState(defaults.starts_at || '');

  // Close modal on Esc key
  useEffect(() => {
    if (!open) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  /**
   * Handles form submission for create or update
   */
  const handleSubmit = async (formData: FormData) => {
    try {
      setBusy(true);
      setError(null);

      if (mode === 'create') {
        // Creating a new event (might include rrule for series)
        await createEvent(formData);
        push({ title: 'Event created', kind: 'success' });
      } else if (isSeriesInstance && seriesScope === 'all') {
        // Editing the entire series (updates the master event)
        // Replace the id with the master_id
        formData.set('id', defaults._series!.master_id);
        await updateSeriesMaster(formData);
        push({ title: 'Series updated', kind: 'success' });
      } else if (isSeriesInstance && seriesScope === 'this') {
        // Editing a single occurrence (creates/updates an override)
        formData.set('series_id', defaults._series!.master_id);
        formData.set('original_start', defaults._series!.original_start);

        // If this is already an override, include its ID
        if (defaults._series!.is_override && defaults.id) {
          formData.set('id', defaults.id);
        }

        await upsertOverride(formData);
        push({ title: 'Event updated', kind: 'success' });
      } else {
        // Editing a standalone event (normal update)
        await updateEvent(formData);
        push({ title: 'Event updated', kind: 'success' });
      }

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save event';
      setError(message);
      push({ title: `Save failed: ${message}`, kind: 'error' });
      setBusy(false);
    }
  };

  /**
   * Handles event deletion with series awareness
   */
  const handleDelete = async (formData: FormData) => {
    try {
      setBusy(true);
      setError(null);

      if (isSeriesInstance && seriesScope === 'all') {
        // Delete the entire series (and all overrides)
        formData.set('id', defaults._series!.master_id);
        await deleteSeriesMaster(formData);
        push({ title: 'Series deleted', kind: 'success' });
      } else if (isSeriesInstance && seriesScope === 'this') {
        // Delete a single occurrence by adding it to exdates
        formData.set('series_id', defaults._series!.master_id);
        formData.set('original_start', defaults._series!.original_start);
        await addExdate(formData);
        push({ title: 'Event deleted', kind: 'success' });
      } else {
        // Delete a standalone event
        await deleteEvent(formData);
        push({ title: 'Event deleted', kind: 'success' });
      }

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete event';
      setError(message);
      push({ title: `Delete failed: ${message}`, kind: 'error' });
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        action={handleSubmit}
        className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden fields for IDs */}
        {defaults.id && !isSeriesInstance && (
          <input type="hidden" name="id" defaultValue={defaults.id} />
        )}
        <input type="hidden" name="calendar_id" defaultValue={defaults.calendar_id} />

        {/* Header */}
        <h2 className="mb-4 text-xl font-semibold">
          {mode === 'create' ? 'New Event' : 'Edit Event'}
        </h2>

        {/* Series Edit Scope Chooser */}
        {mode === 'edit' && isSeriesInstance && (
          <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
            <p className="mb-2 text-sm font-medium text-blue-200">This is a recurring event</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="series_scope"
                  value="this"
                  checked={seriesScope === 'this'}
                  onChange={(e) => setSeriesScope(e.target.value as SeriesEditScope)}
                  className="h-4 w-4 accent-blue-500"
                />
                <span className="text-sm">This event only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="series_scope"
                  value="all"
                  checked={seriesScope === 'all'}
                  onChange={(e) => setSeriesScope(e.target.value as SeriesEditScope)}
                  className="h-4 w-4 accent-blue-500"
                />
                <span className="text-sm">Entire series</span>
              </label>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Title field */}
        <label className="block text-sm font-medium opacity-80">Title</label>
        <input
          name="title"
          defaultValue={defaults.title || ''}
          placeholder="Event title"
          className="mb-4 w-full rounded-md bg-zinc-800 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-white/30"
          required
        />

        {/* Start/End time fields */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium opacity-80">Start</label>
            <input
              type="datetime-local"
              name="starts_at"
              defaultValue={defaults.starts_at}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium opacity-80">End</label>
            <input
              type="datetime-local"
              name="ends_at"
              defaultValue={defaults.ends_at}
              className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
              required
            />
          </div>
        </div>

        {/* Location field */}
        <label className="block text-sm font-medium opacity-80">Location</label>
        <input
          name="location"
          defaultValue={defaults.location || ''}
          placeholder="Add location"
          className="mb-4 w-full rounded-md bg-zinc-800 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-white/30"
        />

        {/* Color picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium opacity-80 mb-2">Color</label>
          <input
            type="color"
            name="color"
            defaultValue={defaults.color || '#3b82f6'}
            className="h-10 w-20 cursor-pointer rounded-md bg-zinc-800 border border-white/10"
          />
        </div>

        {/* All-day checkbox */}
        <label className="mb-4 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="all_day"
            defaultChecked={defaults.all_day}
            className="h-4 w-4 rounded bg-zinc-800 accent-blue-500"
          />
          <span className="text-sm">All-day event</span>
        </label>

        {/* Recurring pattern builder (create mode only) */}
        {mode === 'create' && (
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={showRecurring}
                onChange={(e) => setShowRecurring(e.target.checked)}
                className="h-4 w-4 rounded bg-zinc-800 accent-blue-500"
              />
              <span className="text-sm font-medium">Recurring event</span>
            </label>

            {showRecurring && (
              <>
                <RecurringPatternBuilder
                  value={rrule}
                  onChange={setRrule}
                  startDate={startDate}
                />
                <input type="hidden" name="rrule" value={rrule} />
              </>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-between gap-2">
          {mode === 'edit' ? (
            <button
              formAction={handleDelete}
              type="submit"
              className="rounded-md border border-red-400/40 px-4 py-2 text-sm text-red-300 hover:bg-red-400/10 active:bg-red-400/20 transition-colors"
              onClick={(e) => {
                const confirmMsg = isSeriesInstance && seriesScope === 'all'
                  ? 'Delete this entire series? All occurrences will be removed.'
                  : 'Delete this event?';
                if (!confirm(confirmMsg)) {
                  e.preventDefault();
                }
              }}
              disabled={busy}
            >
              Delete
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/20 px-4 py-2 text-sm hover:bg-white/5 active:bg-white/10 transition-colors"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white active:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Re-export EventDraft for backwards compatibility
export type { EventDraft } from '@/types/events';
