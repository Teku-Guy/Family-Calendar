'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toaster';

interface EventDefaults {
  id?: string;
  calendar_id: string;
  title?: string;
  starts_at: string;
  ends_at: string;
  location?: string;
  color?: string;
  all_day?: boolean;
}

interface SavedEvent {
  id: string;
  calendar_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location?: string;
  color?: string;
  all_day?: boolean;
}

type Props = {
  open: boolean;
  onClose: () => void;
  defaults: EventDefaults;
  mode: 'create' | 'edit';
  onSaved?: (event: SavedEvent) => void;
  onDeleted?: (id: string) => void;
};

export default function EventModalSimple({
  open,
  onClose,
  defaults,
  mode,
  onSaved,
  onDeleted,
}: Props) {
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);

    const fd = new FormData(e.currentTarget);
    const entries = Object.fromEntries(fd.entries());

    // Build typed object
    const obj = {
      calendar_id: entries.calendar_id as string,
      title: entries.title as string,
      starts_at: entries.starts_at as string,
      ends_at: entries.ends_at as string,
      location: entries.location as string,
      color: entries.color as string,
      all_day: fd.get('all_day') === 'on',
    };

    try {
      if (mode === 'create') {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(obj),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || res.statusText);

        push({ title: 'Event created', kind: 'success' });
        onSaved?.({ id: j.id, ...obj });
      } else {
        const res = await fetch(`/api/events/${defaults.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(obj),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || res.statusText);

        push({ title: 'Event updated', kind: 'success' });
        if (defaults.id) {
          onSaved?.({ id: defaults.id, ...obj });
        }
      }

      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      push({ title: `Save failed: ${message}`, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this event?')) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/events/${defaults.id}`, {
        method: 'DELETE',
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);

      push({ title: 'Event deleted', kind: 'success' });
      if (defaults.id) {
        onDeleted?.(defaults.id);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      push({ title: `Delete failed: ${message}`, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input type="hidden" name="calendar_id" defaultValue={defaults.calendar_id} />

        <h2 className="mb-4 text-xl font-semibold">
          {mode === 'create' ? 'New Event' : 'Edit Event'}
        </h2>

        {/* Title */}
        <label className="block text-sm font-medium opacity-80 mb-1">Title</label>
        <input
          name="title"
          defaultValue={defaults.title || ''}
          placeholder="Event title"
          className="mb-4 w-full rounded-md bg-zinc-800 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-white/30"
          required
        />

        {/* Start/End */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium opacity-80 mb-1">Start</label>
            <input
              type="datetime-local"
              name="starts_at"
              defaultValue={defaults.starts_at}
              className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium opacity-80 mb-1">End</label>
            <input
              type="datetime-local"
              name="ends_at"
              defaultValue={defaults.ends_at}
              className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
              required
            />
          </div>
        </div>

        {/* Location */}
        <label className="block text-sm font-medium opacity-80 mb-1">Location</label>
        <input
          name="location"
          defaultValue={defaults.location || ''}
          placeholder="Add location"
          className="mb-4 w-full rounded-md bg-zinc-800 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-white/30"
        />

        {/* Color */}
        <label className="block text-sm font-medium opacity-80 mb-1">Color</label>
        <input
          type="color"
          name="color"
          defaultValue={defaults.color || '#3b82f6'}
          className="mb-4 h-10 w-20 cursor-pointer rounded-md bg-zinc-800 border border-white/10"
        />

        {/* All-day */}
        <label className="mb-6 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="all_day"
            defaultChecked={defaults.all_day}
            className="h-4 w-4 rounded bg-zinc-800 accent-blue-500"
          />
          <span className="text-sm">All-day event</span>
        </label>

        {/* Buttons */}
        <div className="flex items-center justify-between gap-2">
          {mode === 'edit' ? (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md border border-red-400/40 px-4 py-2 text-sm text-red-300 hover:bg-red-400/10 transition-colors"
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
              className="rounded-md border border-white/20 px-4 py-2 text-sm hover:bg-white/5 transition-colors"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition-colors disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
