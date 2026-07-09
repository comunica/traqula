/**
 * Framework-agnostic implementation of the `toEqualParsedQuery` and
 * `toEqualParsedQueryIgnoring` matchers.
 *
 * The exported `parsedQueryMatchers` object can be passed directly to
 * `expect.extend(...)` in any test framework that follows the jest-style
 * matcher API (vitest, jest, ...). Framework-specific side-effect modules
 * live next to this file (e.g. `toEqualParsedQuery.ts` for vitest).
 */

// We cannot use native instanceOf to test whether expected is a Term!
export function objectsEqual(
  received: unknown,
  expected: unknown,
  selector: (obj: object) => boolean,
  ignoreKeys: string[],
): boolean {
  if (received === undefined || received === null || isPrimitive(received)) {
    return received === expected;
  }

  if (isTerm(received)) {
    // eslint-disable-next-line ts/ban-ts-comment
    // @ts-expect-error TS2345
    return received.equals(expected);
  }
  if (isTerm(expected)) {
    // eslint-disable-next-line ts/ban-ts-comment
    // @ts-expect-error TS2345
    return expected.equals(received);
  }

  if (Array.isArray(received)) {
    if (!Array.isArray(expected)) {
      return false;
    }
    if (received.length !== expected.length) {
      return false;
    }
    for (const [ i, element ] of received.entries()) {
      if (!objectsEqual(element, expected[i], selector, ignoreKeys)) {
        return false;
      }
    }
  } else {
    // Received == object
    if (expected === undefined || expected === null || isPrimitive(expected) || Array.isArray(expected)) {
      return false;
    }
    const keys_first = Object.keys(received);
    const receivedMatches = selector(received);

    for (const key of keys_first) {
      if (receivedMatches && ignoreKeys.includes(key)) {
        continue;
      }
      // eslint-disable-next-line ts/ban-ts-comment
      // @ts-expect-error TS7053
      if (!objectsEqual(received[key], expected[key], selector, ignoreKeys)) {
        return false;
      }
    }

    // Ensure no keys are missing in the received object
    const keys_second = Object.keys(expected);
    for (const key of keys_second) {
      // eslint-disable-next-line ts/ban-ts-comment
      // @ts-expect-error TS7053
      if (!objectsEqual(received[key], expected[key], selector, ignoreKeys)) {
        return false;
      }
    }
  }
  return true;
}

function isTerm(value: unknown): value is { equals: (other: { termType: unknown } | undefined | null) => boolean } {
  return typeof value === 'object' && value !== null && 'termType' in value && 'equals' in value;
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

// Minimal shape of `this` provided by jest/vitest to matcher implementations.
interface MatcherContext {
  expand?: boolean;
  utils: {
    matcherHint: (name: string) => string;
    printExpected: (value: unknown) => string;
    printReceived: (value: unknown) => string;
    diff: (a: unknown, b: unknown, options?: { expand?: boolean }) => string | null | undefined;
  };
}

export const parsedQueryMatchers = {
  toEqualParsedQuery(this: MatcherContext, received: unknown, expected: unknown): {
    pass: boolean;
    message: () => string;
  } {
    const pass = objectsEqual(received, expected, () => false, []);
    const message = pass ?
        (): string =>
        `${this.utils.matcherHint('toEqualParsedQuery')}\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Received: ${this.utils.printReceived(received)}` :
        () => {
          const diffString = this.utils.diff(expected, received, {
            expand: this.expand,
          });
          return (
            `${this.utils.matcherHint('toEqualParsedQuery')}\n\n${
              diffString ?
                `Difference:\n\n${diffString}` :
                `Expected: ${this.utils.printExpected(expected)}\n` +
                `Received: ${this.utils.printReceived(received)}`}`
          );
        };
    return { pass, message };
  },
  toEqualParsedQueryIgnoring(
    this: MatcherContext,
    received: unknown,
    selector: (obj: object) => boolean,
    ignoreKeys: string[],
    expected: unknown,
  ): {
      pass: boolean;
      message: () => string;
    } {
    const pass = objectsEqual(received, expected, selector, ignoreKeys);
    const message = pass ?
        (): string =>
        `${this.utils.matcherHint('toEqualParsedQueryIgnoring')}\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Received: ${this.utils.printReceived(received)}` :
        () => {
          const diffString = this.utils.diff(expected, received, {
            expand: this.expand,
          });
          return (
            `${this.utils.matcherHint('toEqualParsedQueryIgnoring')}\n\n${
              diffString ?
                `Difference:\n\n${diffString}` :
                `Expected: ${this.utils.printExpected(expected)}\n` +
                `Received: ${this.utils.printReceived(received)}`}`
          );
        };
    return { pass, message };
  },
};
