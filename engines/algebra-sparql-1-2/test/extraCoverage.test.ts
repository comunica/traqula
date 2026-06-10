import { Parser } from '@traqula/parser-sparql-1-2';

import type {
  AlgebraTestSuite,
} from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { toAlgebra } from '../lib/index.js';

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
});
