#!/usr/bin/env node
/**
 * Test API validation with Zod schemas
 */

import { z } from 'zod';

console.log('=== Testing API Validation (Zod datetime schema) ===\n');

// Replicate the schema from src/lib/validation/events.ts
const datetimeSchema = z.string().datetime();

// Test 1: Valid ISO datetime (should pass)
console.log('Test 1: Valid ISO datetime format');
const validISO = '2025-11-25T13:00:00.000Z';
console.log('  Input:', validISO);
try {
  datetimeSchema.parse(validISO);
  console.log('  ✓ PASS - Validation succeeded\n');
} catch (err) {
  console.log('  ✗ FAIL:', err.issues[0].message, '\n');
}

// Test 2: Invalid datetime-local format (should fail)
console.log('Test 2: Invalid datetime-local format');
const invalidLocal = '2025-11-25T13:00';
console.log('  Input:', invalidLocal);
try {
  datetimeSchema.parse(invalidLocal);
  console.log('  ✗ FAIL - Should have rejected this format\n');
} catch (err) {
  console.log('  ✓ PASS - Correctly rejected:', err.issues[0].message, '\n');
}

// Test 3: ISO with timezone offset
console.log('Test 3: ISO with timezone offset');
const isoWithOffset = '2025-11-25T13:00:00-05:00';
console.log('  Input:', isoWithOffset);
try {
  datetimeSchema.parse(isoWithOffset);
  console.log('  ✓ PASS - Validation succeeded\n');
} catch (err) {
  console.log('  ✗ FAIL:', err.issues[0].message, '\n');
}

// Test 4: Full event validation
console.log('Test 4: Full event create schema validation');
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

const eventCreateSchema = baseEventSchema.refine(
  (v) => new Date(v.starts_at) < new Date(v.ends_at),
  {
    message: 'starts_at must be before ends_at',
    path: ['ends_at'],
  }
);

// Correct format (ISO)
const correctEvent = {
  calendar_id: '00000000-0000-0000-0000-000000000000',
  title: 'Test Event',
  starts_at: '2025-11-25T13:00:00.000Z',
  ends_at: '2025-11-25T14:00:00.000Z',
  all_day: false,
};

console.log('  Correct payload (ISO format):');
console.log('    ', JSON.stringify(correctEvent, null, 2).split('\n').join('\n     '));
try {
  const validated = eventCreateSchema.parse(correctEvent);
  console.log('  ✓ PASS - Full event validation succeeded\n');
} catch (err) {
  console.log('  ✗ FAIL:', err.issues.map(i => i.message).join(', '), '\n');
}

// Incorrect format (datetime-local)
const incorrectEvent = {
  calendar_id: '00000000-0000-0000-0000-000000000000',
  title: 'Test Event',
  starts_at: '2025-11-25T13:00',
  ends_at: '2025-11-25T14:00',
  all_day: false,
};

console.log('Test 5: Full event with datetime-local format (should fail)');
console.log('  Incorrect payload (datetime-local):');
console.log('    ', JSON.stringify(incorrectEvent, null, 2).split('\n').join('\n     '));
try {
  eventCreateSchema.parse(incorrectEvent);
  console.log('  ✗ FAIL - Should have rejected datetime-local format\n');
} catch (err) {
  console.log('  ✓ PASS - Correctly rejected:', err.issues[0].message, '\n');
}

console.log('=== All validation tests completed ===');
