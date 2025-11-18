import { z } from 'zod';
import { RRule } from 'rrule';

/**
 * Validate RRULE string format
 */
const rruleValidator = z.string().refine(
  (val) => {
    try {
      RRule.fromString(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid RRULE format' }
);

/**
 * Base event schema (common fields)
 */
const baseEventSchema = z.object({
  calendar_id: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required'),
  location: z.string().trim().optional().default(''),
  color: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/, 'Invalid color format')
    .optional()
    .default('#3b82f6'),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  all_day: z.boolean().optional().default(false),
});

/**
 * Schema for creating a regular (non-recurring) event
 */
export const eventCreateSchema = baseEventSchema.refine(
  (v) => new Date(v.starts_at) < new Date(v.ends_at),
  {
    message: 'starts_at must be before ends_at',
    path: ['ends_at'],
  }
);

/**
 * Schema for creating a recurring event series
 */
export const recurringEventCreateSchema = baseEventSchema
  .extend({
    rrule: rruleValidator,
    exdates: z.array(z.string().datetime()).optional().default([]),
  })
  .refine((v) => new Date(v.starts_at) < new Date(v.ends_at), {
    message: 'starts_at must be before ends_at',
    path: ['ends_at'],
  });

/**
 * Schema for creating an event override (modified instance)
 */
export const eventOverrideCreateSchema = baseEventSchema
  .extend({
    series_id: z.string().uuid(),
    original_start: z.string().datetime(),
  })
  .refine((v) => new Date(v.starts_at) < new Date(v.ends_at), {
    message: 'starts_at must be before ends_at',
    path: ['ends_at'],
  });

/**
 * Schema for updating any type of event
 */
export const eventUpdateSchema = eventCreateSchema
  .partial()
  .extend({ id: z.string().uuid() });

/**
 * Schema for updating a recurring series
 */
export const recurringEventUpdateSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1, 'Title is required').optional(),
    location: z.string().trim().optional(),
    color: z
      .string()
      .regex(/^#?[0-9a-fA-F]{6}$/, 'Invalid color format')
      .optional(),
    starts_at: z.string().datetime().optional(),
    ends_at: z.string().datetime().optional(),
    all_day: z.boolean().optional(),
    rrule: rruleValidator.optional(),
    exdates: z.array(z.string().datetime()).optional(),
  })
  .refine(
    (v) => {
      if (v.starts_at && v.ends_at) {
        return new Date(v.starts_at) < new Date(v.ends_at);
      }
      return true;
    },
    {
      message: 'starts_at must be before ends_at',
      path: ['ends_at'],
    }
  );

/**
 * Schema for adding an exclusion date to a series
 */
export const addExdateSchema = z.object({
  series_id: z.string().uuid(),
  exdate: z.string().datetime(),
});

// Type exports
export type EventCreate = z.infer<typeof eventCreateSchema>;
export type EventUpdate = z.infer<typeof eventUpdateSchema>;
export type RecurringEventCreate = z.infer<typeof recurringEventCreateSchema>;
export type EventOverrideCreate = z.infer<typeof eventOverrideCreateSchema>;
export type RecurringEventUpdate = z.infer<typeof recurringEventUpdateSchema>;
export type AddExdate = z.infer<typeof addExdateSchema>;
