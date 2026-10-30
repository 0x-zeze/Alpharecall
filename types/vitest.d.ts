/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Local type definitions for test runners and assertions.
 * Allows test suites to compile under `tsc --noEmit` without requiring
 * heavy external testing framework dependencies or lockfile peer conflicts.
 */

declare module "vitest" {
  export interface Assertion {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toStrictEqual(expected: unknown): void;
    toBeNull(): void;
    not: {
      toBeNull(): void;
      toBe(expected: unknown): void;
      toEqual(expected: unknown): void;
    };
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toContain(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toThrow(expected?: unknown): void;
  }

  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function expect(actual: unknown): Assertion;

  export namespace vi {
    export function fn(impl?: any): any;
    export function spyOn(obj: any, method: string): any;
    export function restoreAllMocks(): void;
    export function clearAllMocks(): void;
  }
}
