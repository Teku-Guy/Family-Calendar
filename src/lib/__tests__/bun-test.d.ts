/**
 * Type definitions for Bun's built-in test runner
 *
 * This provides TypeScript support for Bun's global test functions:
 * - describe()
 * - it() / test()
 * - expect()
 * - beforeAll(), afterAll()
 * - beforeEach(), afterEach()
 *
 * @see https://bun.sh/docs/cli/test
 */

declare global {
  /**
   * Define a test suite
   */
  function describe(name: string, fn: () => void): void;

  namespace describe {
    /**
     * Skip this test suite
     */
    function skip(name: string, fn: () => void): void;

    /**
     * Only run this test suite
     */
    function only(name: string, fn: () => void): void;

    /**
     * Mark test suite as TODO
     */
    function todo(name: string, fn?: () => void): void;
  }

  /**
   * Define a test (alias for test())
   */
  function it(name: string, fn: () => void | Promise<void>): void;

  namespace it {
    /**
     * Skip this test
     */
    function skip(name: string, fn: () => void | Promise<void>): void;

    /**
     * Only run this test
     */
    function only(name: string, fn: () => void | Promise<void>): void;

    /**
     * Mark test as TODO
     */
    function todo(name: string, fn?: () => void | Promise<void>): void;
  }

  /**
   * Define a test (alias for it())
   */
  function test(name: string, fn: () => void | Promise<void>): void;

  namespace test {
    /**
     * Skip this test
     */
    function skip(name: string, fn: () => void | Promise<void>): void;

    /**
     * Only run this test
     */
    function only(name: string, fn: () => void | Promise<void>): void;

    /**
     * Mark test as TODO
     */
    function todo(name: string, fn?: () => void | Promise<void>): void;
  }

  /**
   * Run before all tests in a suite
   */
  function beforeAll(fn: () => void | Promise<void>): void;

  /**
   * Run after all tests in a suite
   */
  function afterAll(fn: () => void | Promise<void>): void;

  /**
   * Run before each test in a suite
   */
  function beforeEach(fn: () => void | Promise<void>): void;

  /**
   * Run after each test in a suite
   */
  function afterEach(fn: () => void | Promise<void>): void;

  /**
   * Assertion utilities
   */
  function expect<T>(actual: T): Matchers<T>;

  interface Matchers<T> {
    // Equality
    toBe(expected: T): void;
    toEqual(expected: T): void;
    toStrictEqual(expected: T): void;

    // Truthiness
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;

    // Numbers
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toBeCloseTo(expected: number, precision?: number): void;
    toBeNaN(): void;

    // Strings
    toMatch(expected: string | RegExp): void;
    toContain(expected: string): void;

    // Arrays
    toContain(expected: any): void;
    toHaveLength(expected: number): void;

    // Objects
    toHaveProperty(path: string | string[], value?: any): void;
    toMatchObject(expected: Record<string, any>): void;

    // Errors
    toThrow(expected?: string | RegExp | Error): void;
    toThrowError(expected?: string | RegExp | Error): void;

    // Promises
    resolves: Matchers<T extends Promise<infer U> ? U : T>;
    rejects: Matchers<T extends Promise<infer U> ? U : T>;

    // Negation
    not: Matchers<T>;
  }
}

export {};
