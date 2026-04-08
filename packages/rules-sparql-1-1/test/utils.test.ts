import { describe, it } from 'vitest';
import { sparqlCodepointEscape } from '../lib/index.js';

describe('sparqlCodepointEscape', () => {
  it('converts \\uXXXX escapes to unicode characters', ({ expect }) => {
    expect(sparqlCodepointEscape('hello\\u0041world')).toBe('helloAworld');
    expect(sparqlCodepointEscape('\\u0048\\u0069')).toBe('Hi');
  });

  it('converts \\UXXXXXXXX escapes to unicode characters', ({ expect }) => {
    expect(sparqlCodepointEscape('\\U00000041')).toBe('A');
    expect(sparqlCodepointEscape('test\\U00000042end')).toBe('testBend');
  });

  it('handles characters above 0xFFFF (surrogate pairs)', ({ expect }) => {
    // U+1F600 (😀) = 0x1F600 = 128512
    expect(sparqlCodepointEscape('\\U0001F600')).toBe('😀');
  });

  it('throws on invalid unicode surrogate pairs', ({ expect }) => {
    // A high surrogate (D800-DBFF) not followed by a low surrogate
    expect(() => sparqlCodepointEscape('\uD800')).toThrowError(/Invalid unicode codepoint/u);
  });

  it('passes through normal strings unchanged', ({ expect }) => {
    expect(sparqlCodepointEscape('hello world')).toBe('hello world');
  });
});
