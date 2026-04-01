import { describe, it } from 'vitest';
import '../lib/index.js';

describe('toEqualParsedQuery matchers', () => {
  it('matches nested objects and arrays', ({ expect }) => {
    const query = {
      select: [ 'a', 'b' ],
      where: {
        type: 'group',
        patterns: [{ kind: 'triple', subject: '?s' }],
      },
    };

    expect(query).toEqualParsedQuery({
      select: [ 'a', 'b' ],
      where: {
        type: 'group',
        patterns: [{ kind: 'triple', subject: '?s' }],
      },
    });
  });

  it('reports differences for mismatched structures', ({ expect }) => {
    expect(() => expect({ a: 1, b: 2 }).toEqualParsedQuery({ a: 1, b: 3 })).toThrowError();
    expect(() => expect([ 1, 2, 3 ]).toEqualParsedQuery([ 1, 2 ])).toThrowError();
  });

  it('ignores selected keys only when selector matches', ({ expect }) => {
    const received = {
      generatedAt: 'runtime-value',
      value: 10,
    };

    const expected = {
      value: 10,
    };

    expect(received).toEqualParsedQueryIgnoring(obj => 'generatedAt' in obj, [ 'generatedAt' ], expected);

    expect(() =>
      expect(received).toEqualParsedQueryIgnoring(() => false, [ 'generatedAt' ], expected))
      .toThrowError();
  });

  it('handles primitive comparisons', ({ expect }) => {
    expect(42).toEqualParsedQuery(42);
    expect('hello').toEqualParsedQuery('hello');
    expect(true).toEqualParsedQuery(true);
    expect(null).toEqualParsedQuery(null);
    expect(undefined).toEqualParsedQuery(undefined);
  });

  it('fails when comparing array to non-array', ({ expect }) => {
    expect(() => expect([ 1, 2 ]).toEqualParsedQuery({ 0: 1, 1: 2 })).toThrowError();
  });

  it('fails when comparing object to primitive', ({ expect }) => {
    expect(() => expect({ a: 1 }).toEqualParsedQuery(42)).toThrowError();
    expect(() => expect({ a: 1 }).toEqualParsedQuery(null)).toThrowError();
    expect(() => expect({ a: 1 }).toEqualParsedQuery([ 1 ])).toThrowError();
  });

  it('detects missing keys in expected', ({ expect }) => {
    // Expected has more keys than received
    expect(() => expect({ a: 1 }).toEqualParsedQuery({ a: 1, b: 2 })).toThrowError();
  });

  it('handles deeply nested arrays', ({ expect }) => {
    const received = {
      data: [[[ 1, 2 ], [ 3, 4 ]], [[ 5, 6 ]]],
    };
    const expected = {
      data: [[[ 1, 2 ], [ 3, 4 ]], [[ 5, 6 ]]],
    };
    expect(received).toEqualParsedQuery(expected);
  });

  it('handles mixed nested structures', ({ expect }) => {
    const received = {
      items: [
        { name: 'a', values: [ 1, 2, 3 ]},
        { name: 'b', values: [ 4, 5 ]},
      ],
    };
    const expected = {
      items: [
        { name: 'a', values: [ 1, 2, 3 ]},
        { name: 'b', values: [ 4, 5 ]},
      ],
    };
    expect(received).toEqualParsedQuery(expected);
  });

  it('fails on nested array element mismatch', ({ expect }) => {
    const received = {
      data: [[ 1, 2 ], [ 3, 4 ]],
    };
    const expected = {
      data: [[ 1, 2 ], [ 3, 5 ]],
    };
    expect(() => expect(received).toEqualParsedQuery(expected)).toThrowError();
  });

  it('triggers pass message when using .not on a passing match', ({ expect }) => {
    // These cover the pass=true message lambdas in both matchers
    expect(() => expect({ a: 1 }).not.toEqualParsedQuery({ a: 1 })).toThrowError();
    expect(() =>
      expect({ a: 1 }).not.toEqualParsedQueryIgnoring(() => false, [], { a: 1 })).toThrowError();
  });

  it('handles term-like objects with termType and equals', ({ expect }) => {
    const term = {
      termType: 'NamedNode',
      value: 'http://example.org/',
      equals: (other: unknown) => other !== null && typeof other === 'object' &&
        (<{ value?: unknown }> other).value === 'http://example.org/',
    };
    expect(term).toEqualParsedQuery(term);
    const otherTerm = {
      termType: 'NamedNode',
      value: 'http://other.org/',
      equals: (other: unknown) => other !== null && typeof other === 'object' &&
        (<{ value?: unknown }> other).value === 'http://other.org/',
    };
    expect(() => expect(term).toEqualParsedQuery(otherTerm)).toThrowError();
    // Cover isTerm(expected) branch: received is NOT a term, expected IS a term
    const plainObj = { value: 'http://other.org/' };
    expect(() => expect(plainObj).toEqualParsedQuery(term)).toThrowError();
  });
});

describe('toEqualParsedQuery - diffString falsy branch (lines 19, 48)', () => {
  it('toEqualParsedQuery: covers FALSE diffString branch when diff returns null (same reference, false equals)', ({ expect }) => {
    // Covers toEqualParsedQuery.ts line 19 FALSE branch of `diffString ?`:
    // diff(a, a) returns null when comparing same reference — but objectsEqual can return false
    // if the object has a custom equals() that always returns false.
    // When diffString is null, the fallback Expected:/Received: text is shown.
    const weirdObj = { termType: 'NamedNode', value: 'x', equals: () => false };
    let caughtMessage = '';
    try {
      // pass = false (equals returns false), diff(weirdObj, weirdObj) = null (same reference)
      expect(weirdObj).toEqualParsedQuery(weirdObj);
    } catch (e: any) {
      caughtMessage = String(e.message ?? e);
    }
    expect(caughtMessage).toContain('Expected:');
  });

  it('toEqualParsedQueryIgnoring: covers FALSE diffString branch', ({ expect }) => {
    // Covers toEqualParsedQuery.ts line 48 FALSE branch of `diffString ?`
    const weirdObj = { termType: 'NamedNode', value: 'x', equals: () => false };
    let caughtMessage = '';
    try {
      expect(weirdObj).toEqualParsedQueryIgnoring(() => false, [], weirdObj);
    } catch (e: any) {
      caughtMessage = String(e.message ?? e);
    }
    expect(caughtMessage).toContain('Expected:');
  });

  it('toEqualParsedQuery: covers TRUE diffString branch (normal diff)', ({ expect }) => {
    // Covers toEqualParsedQuery.ts line 19 TRUE branch of `diffString ?`
    let caughtMessage = '';
    try {
      expect({ a: 1, b: 2 }).toEqualParsedQuery({ a: 1, b: 9 });
    } catch (e: any) {
      caughtMessage = String(e.message ?? e);
    }
    expect(caughtMessage.length).toBeGreaterThan(0);
  });

  it('toEqualParsedQueryIgnoring: covers TRUE diffString branch', ({ expect }) => {
    // Covers toEqualParsedQuery.ts line 48 TRUE branch of `diffString ?`
    let caughtMessage = '';
    try {
      expect({ a: 1, b: 2 }).toEqualParsedQueryIgnoring(() => false, [], { a: 1, b: 9 });
    } catch (e: any) {
      caughtMessage = String(e.message ?? e);
    }
    expect(caughtMessage.length).toBeGreaterThan(0);
  });
});

describe('toEqualParsedQuery - diffString undefined branch via asymmetric matcher (lines 19, 48)', () => {
  it('toEqualParsedQuery: covers line 19 FALSE when diff returns undefined (non-jest asymmetricMatch)', ({ expect }) => {
    // When diff(a, b) returns undefined (non-jest asymmetric matcher), diffString is falsy.
    // This covers the FALSE branch of `diffString ? ... : ...` at line 19.
    const weirdObj = {
      asymmetricMatch: () => false,
      $$typeof: Symbol.for('not.a.jest.matcher'),
    };
    let caughtMessage = '';
    try {
      // objectsEqual(42, weirdObj): isPrimitive(42)=true → 42 === weirdObj → false → pass=false
      // diff(weirdObj, 42): weirdObj has asymmetricMatch, $$typeof !== jest marker → returns undefined
      // diffString is undefined (falsy) → FALSE branch of diffString ? covered
      expect(42).toEqualParsedQuery(weirdObj as any);
    } catch (e: any) {
      caughtMessage = String(e.message ?? e);
    }
    expect(caughtMessage.length).toBeGreaterThan(0);
    expect(caughtMessage).toContain('Expected');
  });

  it('toEqualParsedQueryIgnoring: covers line 48 FALSE when diff returns undefined', ({ expect }) => {
    // Same as above but for toEqualParsedQueryIgnoring
    const weirdObj = {
      asymmetricMatch: () => false,
      $$typeof: Symbol.for('not.a.jest.matcher'),
    };
    let caughtMessage = '';
    try {
      expect(42).toEqualParsedQueryIgnoring(() => false, [], weirdObj as any);
    } catch (e: any) {
      caughtMessage = String(e.message ?? e);
    }
    expect(caughtMessage.length).toBeGreaterThan(0);
    expect(caughtMessage).toContain('Expected');
  });
});
