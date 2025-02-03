import { Wildcard } from '@traqula/rules-sparql-1-1';
import { BlankNode, DefaultGraph, NamedNode, Quad, Variable } from 'rdf-data-factory';
import { expect } from 'vitest';

expect.extend({
  toEqualParsedQuery(received, expected) {
    const pass = objectsEqual(received, expected);
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
          diffString && diffString.includes('- Expect') ?
            `Difference:\n\n${diffString}` :
            `Expected: ${this.utils.printExpected(expected)}\n` +
            `Received: ${this.utils.printReceived(received)}`}`
          );
        };

    return { pass, message };
  },
});

// We cannot use native instanceOf to test whether expected is a Term!
function objectsEqual(received: unknown, expected: unknown): boolean {
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
      if (!objectsEqual(element, expected[i])) {
        return false;
      }
    }
  } else {
    // Received == object
    if (expected === undefined || expected === null || isPrimitive(expected) || Array.isArray(expected)) {
      return false;
    }
    const keys_first = Object.keys(received);

    for (const key of keys_first) {
      // eslint-disable-next-line ts/ban-ts-comment
      // @ts-expect-error TS7053
      if (!objectsEqual(received[key], expected[key])) {
        return false;
      }
    }

    // We do this to make sure that we are not missing keys in the received object
    const keys_second = Object.keys(expected);
    for (const key of keys_second) {
      // eslint-disable-next-line ts/ban-ts-comment
      // @ts-expect-error TS7053
      if (!objectsEqual(received[key], expected[key])) {
        return false;
      }
    }
  }
  return true;
}

// If true, the value is a term. With ts annotation
function isTerm(value: unknown): value is { equals: (other: { termType: unknown } | undefined | null) => boolean } {
  return value instanceof DefaultGraph ||
    value instanceof NamedNode ||
    value instanceof BlankNode ||
    value instanceof Variable ||
    value instanceof Wildcard ||
    value instanceof Quad;
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
