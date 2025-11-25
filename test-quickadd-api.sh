#!/bin/bash
# Test script for QuickAdd API POST endpoint

# Test 1: Valid ISO datetime format (correct)
echo "=== Test 1: Valid ISO datetime format ==="
curl -s -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "calendar_id": "00000000-0000-0000-0000-000000000000",
    "title": "Test Event ISO Format",
    "starts_at": "2025-11-25T13:00:00.000Z",
    "ends_at": "2025-11-25T14:00:00.000Z",
    "all_day": false
  }' | jq .

echo ""
echo "=== Test 2: Invalid datetime-local format (should fail) ==="
curl -s -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "calendar_id": "00000000-0000-0000-0000-000000000000",
    "title": "Test Event Local Format",
    "starts_at": "2025-11-25T13:00",
    "ends_at": "2025-11-25T14:00",
    "all_day": false
  }' | jq .

echo ""
echo "=== Test 3: Test datetime conversion utility ==="
node -e "
const { toISOString, toDatetimeLocal, isValidISO } = require('./src/lib/datetime.ts');

console.log('Input (datetime-local):', '2025-11-25T13:00');
console.log('Output (ISO):', toISOString('2025-11-25T13:00'));
console.log('Is valid ISO?:', isValidISO(toISOString('2025-11-25T13:00')));

const testDate = new Date('2025-11-25T18:00:00.000Z');
console.log('\\nReverse conversion:');
console.log('Input (Date):', testDate.toISOString());
console.log('Output (datetime-local):', toDatetimeLocal(testDate));
"
