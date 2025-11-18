/**
 * Server Actions for Event CRUD
 *
 * These actions handle create, update, and delete operations for calendar events.
 * They run on the server and interact with Supabase using Row-Level Security.
 *
 * @module calendar/_actions
 */

'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Converts a FormData datetime value to ISO string
 * @throws {Error} if value is missing or invalid
 */
function toISO(v: FormDataEntryValue | null): string {
  if (!v) throw new Error('missing datetime');
  const d = new Date(String(v));
  if (isNaN(+d)) throw new Error('invalid datetime');
  return d.toISOString();
}

/**
 * Creates a new calendar event
 *
 * @param form - FormData containing:
 *   - title: Event title (optional, defaults to "(No title)")
 *   - calendar_id: UUID of the calendar
 *   - starts_at: ISO datetime string
 *   - ends_at: ISO datetime string
 *   - location: Location string (optional)
 *   - color: Hex color code (optional, defaults to #3b82f6)
 *   - all_day: Boolean flag for all-day events
 *
 * @throws {Error} if database insert fails
 */
export async function createEvent(form: FormData) {
  const sb = await supabaseServer();
  const title = String(form.get('title') || '(No title)');
  const calendar_id = String(form.get('calendar_id'));
  const starts_at = toISO(form.get('starts_at'));
  const ends_at = toISO(form.get('ends_at'));

  const { error } = await sb.from('events').insert({
    calendar_id,
    title,
    starts_at,
    ends_at,
    location: String(form.get('location') || ''),
    color: String(form.get('color') || '#3b82f6'),
    all_day: !!form.get('all_day'),
  });

  if (error) throw new Error(error.message);

  // Revalidate the calendar page to show the new event
  revalidatePath('/calendar');
}

/**
 * Updates an existing calendar event
 *
 * @param form - FormData containing:
 *   - id: Event UUID to update
 *   - title: New title (optional)
 *   - location: New location (optional)
 *   - color: New color (optional)
 *   - starts_at: New start time (optional)
 *   - ends_at: New end time (optional)
 *   - all_day: New all-day flag (optional)
 *
 * Only fields present in FormData will be updated.
 *
 * @throws {Error} if database update fails
 */
export async function updateEvent(form: FormData) {
  const sb = await supabaseServer();
  const id = String(form.get('id'));

  // Build patch object with only provided fields
  const patch: Record<string, unknown> = {};

  ['title', 'location', 'color'].forEach((k) => {
    if (form.get(k) != null) patch[k] = String(form.get(k)!);
  });

  if (form.get('starts_at')) patch.starts_at = toISO(form.get('starts_at'));
  if (form.get('ends_at')) patch.ends_at = toISO(form.get('ends_at'));
  if (form.get('all_day') != null) patch.all_day = !!form.get('all_day');

  const { error } = await sb.from('events').update(patch).eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/calendar');
}

/**
 * Deletes a calendar event
 *
 * @param form - FormData containing:
 *   - id: Event UUID to delete
 *
 * @throws {Error} if database delete fails
 */
export async function deleteEvent(form: FormData) {
  const sb = await supabaseServer();
  const id = String(form.get('id'));

  const { error } = await sb.from('events').delete().eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/calendar');
}

// ==================== RECURRING EVENTS (SERIES) ACTIONS ====================

/**
 * Updates a series master event (affects all future occurrences)
 *
 * This action updates the master event record that defines a recurring series.
 * Changes to the master affect all future (non-overridden) occurrences.
 *
 * @param form - FormData containing:
 *   - id: Master event UUID
 *   - title: New title (optional)
 *   - location: New location (optional)
 *   - starts_at: New start time (optional, shifts all occurrences)
 *   - ends_at: New end time (optional, changes duration)
 *   - all_day: New all-day flag (optional)
 *   - rrule: New RRULE string (optional, changes recurrence pattern)
 *
 * @throws {Error} if database update fails
 */
export async function updateSeriesMaster(form: FormData) {
  const sb = await supabaseServer();
  const id = String(form.get('id'));

  // Build patch object with only provided fields
  const patch: Record<string, unknown> = {};

  ['title', 'location', 'color', 'rrule'].forEach((k) => {
    if (form.get(k) != null) patch[k] = String(form.get(k)!);
  });

  if (form.get('starts_at')) patch.starts_at = toISO(form.get('starts_at'));
  if (form.get('ends_at')) patch.ends_at = toISO(form.get('ends_at'));
  if (form.get('all_day') != null) patch.all_day = !!form.get('all_day');

  const { error } = await sb.from('events').update(patch).eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/calendar');
}

/**
 * Creates or updates an override for a single occurrence in a series
 *
 * This action creates a new event row (or updates an existing override) that
 * modifies a specific occurrence of a recurring series. The override can change
 * the time, title, location, or any other property for just that one instance.
 *
 * @param form - FormData containing:
 *   - series_id: Master event UUID
 *   - original_start: ISO datetime of the original occurrence being overridden
 *   - id: Override event UUID (optional, for updating existing override)
 *   - calendar_id: Calendar UUID
 *   - title: Override title
 *   - starts_at: Override start time
 *   - ends_at: Override end time
 *   - location: Override location (optional)
 *   - all_day: Override all-day flag (optional)
 *
 * @throws {Error} if database operation fails
 */
export async function upsertOverride(form: FormData) {
  const sb = await supabaseServer();

  const series_id = String(form.get('series_id'));
  const original_start = toISO(form.get('original_start'));
  const calendar_id = String(form.get('calendar_id'));
  const title = String(form.get('title') || '(No title)');
  const starts_at = toISO(form.get('starts_at'));
  const ends_at = toISO(form.get('ends_at'));
  const location = String(form.get('location') || '');
  const color = String(form.get('color') || '#3b82f6');
  const all_day = !!form.get('all_day');

  // Check if an override already exists for this occurrence
  const overrideId = form.get('id') ? String(form.get('id')) : null;

  if (overrideId) {
    // Update existing override
    const { error } = await sb
      .from('events')
      .update({
        title,
        starts_at,
        ends_at,
        location,
        color,
        all_day,
      })
      .eq('id', overrideId);

    if (error) throw new Error(error.message);
  } else {
    // Create new override
    const { error } = await sb.from('events').insert({
      calendar_id,
      series_id,
      original_start,
      title,
      starts_at,
      ends_at,
      location,
      color,
      all_day,
    });

    if (error) throw new Error(error.message);
  }

  revalidatePath('/calendar');
}

/**
 * Adds an exception date to a series master (skips one occurrence)
 *
 * This action appends a timestamp to the series master's exdates array,
 * causing that specific occurrence to be excluded from the expansion.
 * The occurrence will not appear in the calendar.
 *
 * @param form - FormData containing:
 *   - series_id: Master event UUID
 *   - original_start: ISO datetime of the occurrence to skip
 *
 * @throws {Error} if database update fails
 */
export async function addExdate(form: FormData) {
  const sb = await supabaseServer();

  const series_id = String(form.get('series_id'));
  const original_start = toISO(form.get('original_start'));

  // Fetch current exdates array
  const { data: master, error: fetchError } = await sb
    .from('events')
    .select('exdates')
    .eq('id', series_id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  // Build new exdates array (avoid duplicates)
  const currentExdates = ((master as Record<string, unknown>).exdates as string[]) || [];
  const newExdates = currentExdates.includes(original_start)
    ? currentExdates
    : [...currentExdates, original_start];

  // Update the master event
  const { error: updateError } = await sb
    .from('events')
    .update({ exdates: newExdates })
    .eq('id', series_id);

  if (updateError) throw new Error(updateError.message);

  revalidatePath('/calendar');
}

/**
 * Deletes a series master (removes all occurrences and overrides)
 *
 * This action deletes the master event, which cascades to all override instances
 * due to the foreign key constraint (ON DELETE CASCADE).
 *
 * @param form - FormData containing:
 *   - id: Master event UUID
 *
 * @throws {Error} if database delete fails
 */
export async function deleteSeriesMaster(form: FormData) {
  const sb = await supabaseServer();
  const id = String(form.get('id'));

  // Delete master (cascades to all overrides via FK)
  const { error } = await sb.from('events').delete().eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/calendar');
}
