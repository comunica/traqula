import { expect } from 'vitest';

expect.extend({
  toEqualParsedQuery(received: unknown, expected: unknown) {
    const pass = objectsEqual(received, expected, () => false, []);
    const message = pass ?
        () =>
          `${this.utils.matcherHint('toEqualParsedQuery')
        }\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Received: ${this.utils.printReceived(received)}` :
        () => {
          const diffString = this.utils.diff(expected, received, {
            expand: this.expand,
          });
          return (
            `${this.utils.matcherHint('toEqualParsedQuery')
          }\n\n${
          diffString ?
            `Difference:\n\n${diffString}` :
            `Expected: ${this.utils.printExpected(expected)}\n` +
            `Received: ${this.utils.printReceived(received)}`}`
          );
        };

    return { pass, message };
  },
  toEqualParsedQueryIgnoring(
    received: unknown,
    selector: (obj: object) => boolean,
    ignoreKeys: string[],
    expected: unknown,
  ) {
    const pass = objectsEqual(received, expected, selector, ignoreKeys);
    const message = pass ?
        () =>
        `${this.utils.matcherHint('toEqualParsedQuery')
        }\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Received: ${this.utils.printReceived(received)}` :
        () => {
          const diffString = this.utils.diff(expected, received, {
            expand: this.expand,
          });
          return (
          `${this.utils.matcherHint('toEqualParsedQuery')
          }\n\n${
            diffString ?
              `Difference:\n\n${diffString}` :
              `Expected: ${this.utils.printExpected(expected)}\n` +
              `Received: ${this.utils.printReceived(received)}`}`
          );
        };

    return { pass, message };
  },
});

// We cannot use native instanceOf to test whether expected is a Term!
function objectsEqual(
  received: unknown,
  expected: unknown,
  selector: (obj: object) => boolean,
  ignoreKeys: string[],
): boolean {
  if (received === undefined || received === null || isPrimitive(received)) {
    return received === expected;
  }

  if (isTerm(received)) {
    return received.equals(<{ termType: unknown } | undefined | null>expected);
  }
  if (isTerm(expected)) {
    return expected.equals(<{ termType: unknown } | undefined | null>received);
  }
  //  York
  // test
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
    const receivedObj = <Record<string, unknown>>received;
    const expectedObj = <Record<string, unknown>>expected;
    const keys_first = Object.keys(receivedObj);
    const receivedMatches = selector(receivedObj);

    for (const key of keys_first) {
      if (receivedMatches && ignoreKeys.includes(key)) {
        continue;
      }
      if (!objectsEqual(receivedObj[key], expectedObj[key], selector, ignoreKeys)) {
        return false;
      }
    }

    // We do this to make sure that we are not missing keys in the received object
    const keys_second = Object.keys(expectedObj);
    for (const key of keys_second) {
      if (!objectsEqual(receivedObj[key], expectedObj[key], selector, ignoreKeys)) {
        return false;
      }
    }
  }
  return true;
}

// If true, the value is a term. With ts annotation
function isTerm(value: unknown): value is { equals: (other: { termType: unknown } | undefined | null) => boolean } {
  return typeof value === 'object' && value !== null && 'termType' in value && 'equals' in value;
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
