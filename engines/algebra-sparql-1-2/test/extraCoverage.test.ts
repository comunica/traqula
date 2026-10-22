import { algebraUtils } from '@traqula/algebra-transformations-1-2';
import { Generator } from '@traqula/generator-sparql-1-2';
import { Parser } from '@traqula/parser-sparql-1-2';

import type {
  AlgebraTestSuite,
} from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { toAlgebra, toAst } from '../lib/index.js';

export const suites: AlgebraTestSuite[] = [ 'dawg-syntax', 'sparql11-query', 'sparql-1.1', 'sparql12' ];

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('algebra output 1.2', () => {
  const parser = new Parser();
  describe('prototype-key reserved-name bypass (security fix)', () => {
    // When a prefix name collides with an Object.prototype property, the algebra
    // must still throw "Unknown prefix" rather than silently expanding to garbage.
    it('throws Unknown prefix for constructor when not declared', ({ expect }) => {
      const ast = parser.parse('SELECT * WHERE { ?s constructor:foo ?o }', { skipValidation: true });
      expect(() => toAlgebra(ast, {})).toThrow(/Unknown prefix: constructor/u);
    });

    it('correctly expands a declared prefix whose name is a prototype key', ({ expect }) => {
      const ast = parser.parse('PREFIX constructor: <http://ex.org/> SELECT * WHERE { ?s constructor:foo ?o }');
      const result = toAlgebra(ast, {});
      expect(result).toMatchObject({
        input: { patterns: [{ predicate: { value: 'http://ex.org/foo' }}]},
      });
    });

    it('correctly expands a prototype-key prefix passed via config', ({ expect }) => {
      const ast = parser.parse('SELECT * WHERE { ?s constructor:foo ?o }', { skipValidation: true });
      const result = toAlgebra(ast, { prefixes: { constructor: 'http://ex.org/' }});
      expect(result).toMatchObject({
        input: { patterns: [{ predicate: { value: 'http://ex.org/foo' }}]},
      });
    });
  });

  describe('algebraUtils.objectify', () => {
    it('keeps the direction of directional literals nested in triple terms', ({ expect }) => {
      const ast = parser.parse('SELECT * WHERE { ?s ?p <<( ?s ?p "hello"@en--ltr )>> }');
      const algebra = algebraUtils.objectify(toAlgebra(ast));
      expect(algebra).toMatchObject({
        input: { patterns: [{ object: { object: { value: 'hello', language: 'en', direction: 'ltr' }}}]},
      });
    });

    it('returns null and undefined as-is', ({ expect }) => {
      expect(algebraUtils.objectify(null)).toBeNull();
      expect(algebraUtils.objectify(undefined)).toBeUndefined();
      expect(algebraUtils.objectify({ a: null, b: [ undefined ]})).toEqual({ a: null, b: [ undefined ]});
    });
  });

  describe('toAst with quads', () => {
    const generator = new Generator();

    for (const tripleTerm of [
      '<<( ?g <http://p> <http://o> )>>',
      '<<( ?s <http://p> <<( <http://s> <http://p> ?g )>> )>>',
    ]) {
      it(`keeps a FILTER mentioning the graph variable in ${tripleTerm} outside of the GRAPH`, ({ expect }) => {
        // ?g is not bound within GRAPH ?g (18.5), so moving the FILTER inside would change the results.
        const ast = parser.parse(`SELECT * WHERE { GRAPH ?g { ?s ?p ?o } FILTER(?o = ${tripleTerm}) }`);
        const query = generator.generate(toAst(toAlgebra(ast, { quads: true })));
        expect(query).toBe(`SELECT ?g ?o ?p ?s WHERE {
  GRAPH ?g {
    ?s ?p ?o .
  }
  FILTER ( ( ?o = ${tripleTerm} ) )
}`);
      });
    }

    it('moves a FILTER with a triple term not mentioning the graph variable inside the GRAPH', ({ expect }) => {
      const ast = parser.parse('SELECT * WHERE { GRAPH ?g { ?s ?p ?o } FILTER(?o = <<( ?s <http://p> ?o )>>) }');
      const query = generator.generate(toAst(toAlgebra(ast, { quads: true })));
      expect(query).toBe(`SELECT ?g ?o ?p ?s WHERE {
  GRAPH ?g {
    {
      ?s ?p ?o .
      FILTER ( ( ?o = <<( ?s <http://p> ?o )>> ) )
    }
  }
}`);
    });
  });
});
