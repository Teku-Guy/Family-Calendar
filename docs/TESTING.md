# Testing Guide

This document explains the testing infrastructure for the Family Calendar project.

## Test Runner: Bun

This project uses **Bun's built-in test runner** instead of Jest, Vitest, or other third-party test frameworks. Bun provides a fast, zero-config testing solution with Jest-compatible APIs.

### Why Bun Test?

- **Zero Configuration**: No setup required, works out of the box
- **Fast Execution**: Native performance, significantly faster than Node-based runners
- **Jest-Compatible API**: Familiar `describe`, `it`, `expect` syntax
- **Built-in**: No additional dependencies needed
- **TypeScript Support**: Native TypeScript execution without transpilation

## Running Tests

### Command-Line Usage

```bash
# Run all tests
bun test

# Run tests in watch mode (re-run on file changes)
bun test --watch

# Run specific test file
bun test src/lib/__tests__/when.test.ts

# Run tests with name pattern
bun test --test-name-pattern "timezone"

# Run with coverage
bun test --coverage
```

### NPM Scripts

The following scripts are available in `package.json`:

```bash
# Run all tests once
bun run test

# Run tests in watch mode
bun run test:watch
```

## Writing Tests

### Test File Locations

Test files should be placed in `__tests__` directories next to the code they test:

```
src/
├── lib/
│   ├── when.ts               # Code under test
│   └── __tests__/
│       ├── when.test.ts      # Test file
│       └── bun-test.d.ts     # Type definitions
```

### Test File Naming

- Use `.test.ts` or `.test.tsx` extension
- Match the filename of the code being tested (e.g., `when.ts` → `when.test.ts`)

### Basic Test Structure

```typescript
/// <reference path="./bun-test.d.ts" />

import { functionToTest } from '../module';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should do something specific', () => {
      const result = functionToTest('input');
      expect(result).toBe('expected output');
    });

    it('should handle edge cases', () => {
      expect(() => functionToTest(null)).toThrow();
    });
  });
});
```

**Important**: Include the triple-slash reference directive at the top of each test file to enable TypeScript type checking for test globals.

### Available Test APIs

#### Test Definition

```typescript
describe('suite name', () => {
  it('test name', () => {
    // test code
  });

  // Aliases
  test('test name', () => { }); // same as it()

  // Modifiers
  it.skip('skipped test', () => { }); // Skip this test
  it.only('focused test', () => { }); // Only run this test
  it.todo('future test'); // Mark as TODO
});
```

#### Lifecycle Hooks

```typescript
describe('suite', () => {
  beforeAll(() => {
    // Runs once before all tests
  });

  afterAll(() => {
    // Runs once after all tests
  });

  beforeEach(() => {
    // Runs before each test
  });

  afterEach(() => {
    // Runs after each test
  });
});
```

#### Assertions (expect)

**Equality**
```typescript
expect(actual).toBe(expected);           // === comparison
expect(actual).toEqual(expected);        // Deep equality
expect(actual).toStrictEqual(expected);  // Strict deep equality
```

**Truthiness**
```typescript
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();
```

**Numbers**
```typescript
expect(num).toBeGreaterThan(5);
expect(num).toBeGreaterThanOrEqual(5);
expect(num).toBeLessThan(10);
expect(num).toBeLessThanOrEqual(10);
expect(num).toBeCloseTo(0.3, 1); // Floating point comparison
expect(num).toBeNaN();
```

**Strings**
```typescript
expect(str).toMatch(/pattern/);
expect(str).toMatch('substring');
expect(str).toContain('substring');
```

**Arrays/Objects**
```typescript
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(obj).toHaveProperty('key', 'value');
expect(obj).toMatchObject({ key: 'value' });
```

**Errors**
```typescript
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('error message');
expect(() => fn()).toThrow(/error pattern/);
```

**Negation**
```typescript
expect(value).not.toBe(other);
expect(value).not.toContain(item);
```

## TypeScript Support

### Type Definitions

The project includes custom type definitions for Bun's test globals at:
`src/lib/__tests__/bun-test.d.ts`

These definitions provide IntelliSense and type checking for:
- `describe`, `it`, `test`
- `expect` and all matchers
- `beforeAll`, `afterAll`, `beforeEach`, `afterEach`
- Test modifiers (`.skip`, `.only`, `.todo`)

### Using Type Definitions

Add this reference at the top of each test file:

```typescript
/// <reference path="./bun-test.d.ts" />
```

This ensures TypeScript recognizes test globals without requiring `@types/jest` or similar packages.

### Why Not @types/jest?

While Bun's test API is Jest-compatible, we use custom type definitions because:

1. **No Dependencies**: Avoids installing unnecessary packages
2. **Accuracy**: Matches Bun's actual API (which differs slightly from Jest)
3. **Performance**: Smaller type footprint
4. **Clarity**: Shows exactly what APIs are available

## Example Tests

### Testing Pure Functions

```typescript
/// <reference path="./bun-test.d.ts" />

import { fmtDuration } from '../when';

describe('when.ts', () => {
  describe('fmtDuration', () => {
    it('should format minutes-only duration', () => {
      expect(fmtDuration(45)).toBe('45m');
    });

    it('should format hours-only duration', () => {
      expect(fmtDuration(120)).toBe('2h');
    });

    it('should format hours and minutes', () => {
      expect(fmtDuration(90)).toBe('1h 30m');
    });
  });
});
```

### Testing Async Functions

```typescript
describe('async operations', () => {
  it('should resolve successfully', async () => {
    const result = await fetchData();
    expect(result).toBeDefined();
  });

  it('should reject on error', async () => {
    await expect(fetchData('invalid')).rejects.toThrow();
  });
});
```

### Testing Date/Time Functions

```typescript
describe('timezone utilities', () => {
  it('should convert UTC to local datetime-local format', () => {
    const utc = '2025-10-15T14:00:00.000Z';
    const local = toLocalInput(utc);

    // Format should be YYYY-MM-DDTHH:mm
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('should identify today in local timezone', () => {
    const now = new Date().toISOString();
    expect(isToday(now)).toBe(true);
  });
});
```

## Best Practices

### Test Organization

1. **One test file per module**: `when.ts` → `when.test.ts`
2. **Mirror directory structure**: Keep tests close to implementation
3. **Use descriptive names**: Test names should explain what's being tested
4. **Group related tests**: Use nested `describe` blocks for organization

### Test Quality

1. **Test behavior, not implementation**: Focus on inputs and outputs
2. **Keep tests independent**: Each test should run in isolation
3. **Use meaningful assertions**: Prefer specific matchers over generic ones
4. **Test edge cases**: Include null, undefined, empty, and boundary values
5. **Mock external dependencies**: Isolate code under test from external systems

### Timezone-Aware Testing

When testing date/time functions:

1. **Use UTC timestamps**: Store test dates in UTC format
2. **Test DST transitions**: Include tests for spring forward and fall back
3. **Avoid hardcoded offsets**: Let JavaScript Date handle timezone math
4. **Test locale-awareness**: Verify formatting works across locales

### Example: Comprehensive Test Suite

```typescript
/// <reference path="./bun-test.d.ts" />

import { duration, fmtDuration, fmtRange } from '../when';

describe('when.ts - Time Utilities', () => {
  describe('duration', () => {
    it('should calculate same-day duration', () => {
      const start = '2025-10-15T14:00:00.000Z';
      const end = '2025-10-15T15:30:00.000Z';
      expect(duration(start, end)).toBe(90);
    });

    it('should handle cross-day durations', () => {
      const start = '2025-10-15T23:00:00.000Z';
      const end = '2025-10-16T01:00:00.000Z';
      expect(duration(start, end)).toBe(120);
    });

    it('should handle zero duration', () => {
      const time = '2025-10-15T14:00:00.000Z';
      expect(duration(time, time)).toBe(0);
    });
  });

  describe('fmtDuration', () => {
    it('should format zero minutes', () => {
      expect(fmtDuration(0)).toBe('0m');
    });

    it('should format single minute', () => {
      expect(fmtDuration(1)).toBe('1m');
    });

    it('should format hours and minutes', () => {
      expect(fmtDuration(90)).toBe('1h 30m');
    });

    it('should format multiple hours', () => {
      expect(fmtDuration(180)).toBe('3h');
    });
  });

  describe('fmtRange', () => {
    it('should format same-day time range', () => {
      const start = '2025-10-15T14:30:00.000Z';
      const end = '2025-10-15T15:15:00.000Z';
      const formatted = fmtRange(start, end);

      expect(formatted).toContain('–');
      expect(formatted).toBeTruthy();
    });

    it('should include date for cross-day ranges', () => {
      const start = '2025-10-15T15:00:00.000Z';
      const end = '2025-10-16T16:00:00.000Z';
      const formatted = fmtRange(start, end);

      expect(formatted).toContain('–');
      expect(formatted).toBeTruthy();
    });
  });
});
```

## Troubleshooting

### TypeScript Errors

**Problem**: "Cannot find name 'describe'" or "Cannot find name 'expect'"

**Solution**: Add triple-slash reference at top of test file:
```typescript
/// <reference path="./bun-test.d.ts" />
```

### Tests Not Running

**Problem**: Tests aren't being discovered

**Solution**: Ensure test files:
1. Use `.test.ts` or `.test.tsx` extension
2. Are in a `__tests__` directory or match pattern `**/*.test.ts`
3. Are not in `node_modules` or `.next` directories

### Type Mismatches

**Problem**: Matcher types don't match expectations

**Solution**: Check `bun-test.d.ts` for available matchers. Bun's test API may differ slightly from Jest.

## Coverage Reports

Generate coverage reports to identify untested code:

```bash
# Generate coverage
bun test --coverage

# Generate coverage with lcov format
bun test --coverage --coverage-reporter=lcov

# View coverage report
open coverage/lcov-report/index.html
```

Coverage reports show:
- **Lines**: Percentage of code lines executed
- **Branches**: Percentage of conditional branches tested
- **Functions**: Percentage of functions called
- **Statements**: Percentage of statements executed

## Continuous Integration

For CI/CD pipelines, use:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: bun test --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Further Reading

- [Bun Test Runner Documentation](https://bun.sh/docs/cli/test)
- [Bun Test API Reference](https://bun.sh/docs/test/writing)
- [Jest API Compatibility](https://jestjs.io/docs/api)

## Current Test Coverage

### Modules with Tests

- **`src/lib/when.ts`**: Timezone utilities (19 tests, 28 assertions)
  - UTC/local conversion
  - Date/time formatting
  - Duration calculations
  - DST handling
  - Relative time formatting

### Modules Needing Tests

Future testing priorities:

1. **Event CRUD Operations**: `src/lib/events-simple.ts`, `src/lib/events-recurring.ts`
2. **RRULE Expansion**: `src/lib/events/materialize.ts`
3. **Google Sync Logic**: `src/lib/google/push.ts`
4. **Validation Schemas**: `src/lib/validation/events.ts`
5. **API Routes**: `src/app/api/events/route.ts`
6. **React Components**: Calendar views, modals, event cards

Test coverage will expand as the project matures.
