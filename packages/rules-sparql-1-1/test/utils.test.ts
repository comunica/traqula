import { describe, it } from 'vitest';
import { sparqlCodepointEscape } from '@traqula/rules-sparql-1-1';

describe('sparqlCodepointEscape', () => {
  it('returns strings without escape sequences unchanged', ({ expect }) => {
    expect(sparqlCodepointEscape('hello world')).toBe('hello world');
    expect(sparqlCodepointEscape('')).toBe('');
  });

  it('converts \\u4-digit hex sequences to characters', ({ expect }) => {
    // \u0041 is 'A'
    expect(sparqlCodepointEscape('\\u0041')).toBe('A');
    // \u0048\u0065\u006C\u006C\u006F is 'Hello'
    expect(sparqlCodepointEscape('\\u0048\\u0065\\u006C\\u006C\\u006F')).toBe('Hello');
  });

  it('converts \\U8-digit hex sequences to characters (codepoint < 0xFFFF)', ({ expect }) => {
    // \U00000041 is 'A'
    expect(sparqlCodepointEscape('\\U00000041')).toBe('A');
    // \U0001F600 is an emoji (needs surrogate pair) - but \U0000FFFE is < 0xFFFF
    expect(sparqlCodepointEscape('\\U0000FFFE')).toBe('\uFFFE');
  });

  it('converts \\U8-digit hex sequences for codepoints >= 0xFFFF (supplementary planes)', ({ expect }) => {
    // \U0001F600 is 😀 (U+1F600), which requires a surrogate pair in JS
    const result = sparqlCodepointEscape('\\U0001F600');
    expect(result).toBe('\u{1F600}');
    expect([ ...result ]).toHaveLength(1);
  });

  it('handles mixed \\u and \\U escape sequences', ({ expect }) => {
    const result = sparqlCodepointEscape('\\u0041\\U00000042');
    expect(result).toBe('AB');
  });

  it('throws for invalid unicode surrogate pairs', ({ expect }) => {
    // Directly inject a lone surrogate to trigger the error
    // We can manually create a string with a lone high surrogate
    // The function checks for isolated surrogates in the result
    // \uD800 is a high surrogate without a following low surrogate
    // We need to produce this from an escape sequence that results in an isolated surrogate
    // Note: The regex \u{D800}-\u{DBFF} without following \u{DC00}-\u{DFFF} triggers the error
    // We can achieve a lone high surrogate using codepoint \U0000D800 (which is a surrogate)
    // String.fromCodePoint(0xD800) creates a lone high surrogate
    expect(() => sparqlCodepointEscape('\\uD800')).toThrow('Invalid unicode codepoint');
  });
});
