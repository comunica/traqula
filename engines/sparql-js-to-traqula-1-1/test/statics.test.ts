import { Generator } from '@traqula/generator-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
import { Parser as SparqlJsParser } from 'sparqljs';
import { describe, it } from 'vitest';
import { sparqlQueryFromSparqlJs } from '../lib/index.js';

/**
 * Valid queries of the corpus that SPARQL.js's grouping validation rejects, because it does not account for
 * trailing VALUES variables or for reusing a select alias in a later projection expression.
 * These are parsed with SPARQL.js's ungrouped variable check skipped.
 */
const rejectedBySparqlJs = new Set([
  'group-by-trailing-values-projection',
  'group-by-trailing-values-select-expression',
  'group-by-trailing-values-shadows-pattern-variable',
  'implicit-group-trailing-values-projection',
  'select-variable-reuse',
]);

/**
 * Parses each query of the shared SPARQL 1.1 corpus with SPARQL.js, converts it and generates it with Traqula,
 * comparing the result against a stored snapshot in `statics/sparql-1-1/`.
 */
describe('sparqljs to Traqula static round trip', () => {
  const sparqlJsParser = new SparqlJsParser();
  const lenientSparqlJsParser = new SparqlJsParser({ skipUngroupedVariableCheck: true });
  const generator = new Generator();

  for (const { name, statics } of positiveTest('sparql-1-1')) {
    it(`round trips ${name}`, async({ expect }) => {
      const { query } = await statics();
      let parser = sparqlJsParser;
      if (rejectedBySparqlJs.has(name)) {
        expect(() => sparqlJsParser.parse(query)).toThrow(/ungrouped variable/u);
        parser = lenientSparqlJsParser;
      }
      // The SPARQL.js blank node counter is global; reset it so labels do not depend on the corpus order.
      parser._resetBlanks();
      const traqulaAst = sparqlQueryFromSparqlJs(parser.parse(query));
      await expect(generator.generate(traqulaAst)).toMatchFileSnapshot(`../statics/sparql-1-1/${name}.sparql`);
    });
  }
});
