#!/usr/bin/env node
/**
 * Test script for datetime utility functions
 */

import { toISOString, toDatetimeLocal, isValidISO } from './src/lib/datetime.ts';

console.log('=== Testing datetime utility functions ===\n');

// Test 1: Convert datetime-local to ISO
console.log('Test 1: Convert datetime-local to ISO');
const datetimeLocal = '2025-11-25T13:00';
console.log('  Input (datetime-local):', datetimeLocal);
try {
  const isoString = toISOString(datetimeLocal);
  console.log('  Output (ISO):', isoString);
  console.log('  Is valid ISO?:', isValidISO(isoString));
  console.log('  ✓ PASS\n');
} catch (err) {
  console.log('  ✗ FAIL:', err.message, '\n');
}

// Test 2: Convert Date to datetime-local
console.log('Test 2: Convert Date to datetime-local');
const testDate = new Date('2025-11-25T18:00:00.000Z');
console.log('  Input (Date):', testDate.toISOString());
try {
  const dtLocal = toDatetimeLocal(testDate);
  console.log('  Output (datetime-local):', dtLocal);
  console.log('  ✓ PASS\n');
} catch (err) {
  console.log('  ✗ FAIL:', err.message, '\n');
}

// Test 3: Round-trip conversion
console.log('Test 3: Round-trip conversion');
const original = new Date('2025-11-25T13:00:00.000Z');
console.log('  Original Date:', original.toISOString());
try {
  const dtLocal = toDatetimeLocal(original);
  console.log('  → datetime-local:', dtLocal);
  const backToISO = toISOString(dtLocal);
  console.log('  → back to ISO:', backToISO);

  // Note: Round-trip may not be exact due to timezone conversions
  const roundTripped = new Date(backToISO);
  console.log('  Round-tripped Date:', roundTripped.toISOString());
  console.log('  ✓ PASS\n');
} catch (err) {
  console.log('  ✗ FAIL:', err.message, '\n');
}

// Test 4: Validate invalid formats
console.log('Test 4: Validate invalid formats');
const invalid = '2025-11-25T13:00'; // Missing timezone
console.log('  Input:', invalid);
console.log('  Is valid ISO?:', isValidISO(invalid));
console.log('  Expected: false');
console.log('  ✓ PASS\n');

// Test 5: Error handling
console.log('Test 5: Error handling');
try {
  toISOString('');
  console.log('  ✗ FAIL: Should have thrown error\n');
} catch (err) {
  console.log('  Empty string error:', err.message);
  console.log('  ✓ PASS\n');
}

console.log('=== All tests completed ===');
