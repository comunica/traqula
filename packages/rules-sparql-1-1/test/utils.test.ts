import { describe, it } from 'vitest';
import { sparqlCodepointEscape } from '../lib/index.js';

describe('sparqlCodepointEscape', () => {
  describe('within IRI references', () => {
    it('converts \\uXXXX escapes inside <...>', ({ expect }) => {
      expect(sparqlCodepointEscape('<hello\\u0041world>')).toBe('<helloAworld>');
      expect(sparqlCodepointEscape('<\\u0048\\u0069>')).toBe('<Hi>');
    });

    it('converts \\UXXXXXXXX escapes inside <...>', ({ expect }) => {
      expect(sparqlCodepointEscape('<\\U00000041>')).toBe('<A>');
      expect(sparqlCodepointEscape('<test\\U00000042end>')).toBe('<testBend>');
    });

    it('handles supplementary characters (above U+FFFF) inside <...>', ({ expect }) => {
      // U+1F600 (😀)
      expect(sparqlCodepointEscape('<\\U0001F600>')).toBe('<😀>');
    });

    it('throws on surrogate codepoints in \\uXXXX escape inside <...>', ({ expect }) => {
      expect(() => sparqlCodepointEscape('<\\uD800>')).toThrowError(/surrogate/u);
      expect(() => sparqlCodepointEscape('<\\uDFFF>')).toThrowError(/surrogate/u);
    });

    it('throws on raw lone surrogate inside <...>', ({ expect }) => {
      expect(() => sparqlCodepointEscape('<\uD800>')).toThrowError(/Invalid unicode codepoint/u);
    });
  });

  describe('within string literals', () => {
    it('converts \\uXXXX escapes inside double-quoted strings', ({ expect }) => {
      expect(sparqlCodepointEscape('"\\u0041"')).toBe('"A"');
    });

    it('converts \\uXXXX escapes inside single-quoted strings', ({ expect }) => {
      expect(sparqlCodepointEscape('\'\\u0041\'')).toBe('\'A\'');
    });

    it('converts \\uXXXX escapes inside long double-quoted strings', ({ expect }) => {
      expect(sparqlCodepointEscape('"""\\u0041"""')).toBe('"""A"""');
    });

    it('converts \\uXXXX escapes inside long single-quoted strings', ({ expect }) => {
      expect(sparqlCodepointEscape('\'\'\'\\u0041\'\'\'')).toBe('\'\'\'A\'\'\'');
    });

    it('throws on surrogate codepoints in \\uXXXX escape inside string', ({ expect }) => {
      expect(() => sparqlCodepointEscape('"\\uD83C"')).toThrowError(/surrogate/u);
    });

    it('throws on raw lone high surrogate inside string', ({ expect }) => {
      expect(() => sparqlCodepointEscape('"\uD800"')).toThrowError(/Invalid unicode codepoint/u);
    });
  });

  describe('outside string/IRI contexts', () => {
    it('throws on \\uXXXX escape in SPARQL keyword position', ({ expect }) => {
      expect(() => sparqlCodepointEscape('\\u0041SK {}')).toThrowError(/Codepoint escape not allowed/u);
    });

    it('throws on \\uXXXX escape in variable name', ({ expect }) => {
      const query = 'SELECT * { ?a\\u0062c <:p> ?o }';
      expect(() => sparqlCodepointEscape(query)).toThrowError(/Codepoint escape not allowed/u);
    });

    it('does not process \\uXXXX in # comments', ({ expect }) => {
      // Comments pass through unchanged; no error thrown
      expect(sparqlCodepointEscape('# \\u0041\nSELECT * {}')).toBe('# \\u0041\nSELECT * {}');
    });

    it('does not enter IRI mode for comparison operators', ({ expect }) => {
      // '< ' (with space) is a comparison, not an IRI ref
      expect(sparqlCodepointEscape('SELECT * { FILTER(?x < 5) }')).toBe('SELECT * { FILTER(?x < 5) }');
    });
  });

  it('passes through normal strings unchanged', ({ expect }) => {
    expect(sparqlCodepointEscape('SELECT * WHERE { ?s ?p ?o }')).toBe('SELECT * WHERE { ?s ?p ?o }');
  });

  it('handles unterminated short string at end of input gracefully', ({ expect }) => {
    // A string that is never closed (no closing quote before EOF)
    expect(sparqlCodepointEscape('"abc')).toBe('"abc');
    expect(sparqlCodepointEscape('\'abc')).toBe('\'abc');
  });
});
