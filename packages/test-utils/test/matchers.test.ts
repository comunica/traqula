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
