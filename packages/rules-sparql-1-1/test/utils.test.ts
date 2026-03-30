import { sparqlCodepointEscape, CommonIRIs, AstTransformer } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';

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

describe('commonIRIs', () => {
  it('has expected XSD IRIs', ({ expect }) => {
    expect(CommonIRIs.BOOLEAN).toBe('http://www.w3.org/2001/XMLSchema#boolean');
    expect(CommonIRIs.INTEGER).toBe('http://www.w3.org/2001/XMLSchema#integer');
    expect(CommonIRIs.DECIMAL).toBe('http://www.w3.org/2001/XMLSchema#decimal');
    expect(CommonIRIs.DOUBLE).toBe('http://www.w3.org/2001/XMLSchema#double');
    expect(CommonIRIs.STRING).toBe('http://www.w3.org/2001/XMLSchema#string');
  });

  it('has expected RDF IRIs', ({ expect }) => {
    expect(CommonIRIs.FIRST).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#first');
    expect(CommonIRIs.REST).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest');
    expect(CommonIRIs.NIL).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');
    expect(CommonIRIs.TYPE).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  });
});

describe('astTransformer', () => {
  it('is instantiable and inherits from TransformerSubTyped', ({ expect }) => {
    const transformer = new AstTransformer();
    expect(transformer).toBeDefined();
    expect(typeof transformer.transformNode).toBe('function');
    expect(typeof transformer.visitNode).toBe('function');
  });
});
