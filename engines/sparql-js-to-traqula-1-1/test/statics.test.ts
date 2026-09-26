import { Generator } from '@traqula/generator-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
import { Parser as SparqlJsParser } from 'sparqljs';
import { describe, it } from 'vitest';
import { sparqlQueryFromSparqlJs } from '../lib/index.js';

/**
 * Parses each query of the shared SPARQL 1.1 corpus with SPARQL.js, converts it and generates it with Traqula,
 * comparing the result against a stored snapshot in `statics/sparql-1-1/`.
 */
describe('sparqljs to Traqula static round trip', () => {
  const sparqlJsParser = new SparqlJsParser();
  const generator = new Generator();

  for (const { name, statics } of positiveTest('sparql-1-1')) {
    it(`round trips ${name}`, async({ expect }) => {
      const { query } = await statics();
      // The SPARQL.js blank node counter is global; reset it so labels do not depend on the corpus order.
      sparqlJsParser._resetBlanks();
      const traqulaAst = sparqlQueryFromSparqlJs(sparqlJsParser.parse(query));
      await expect(generator.generate(traqulaAst)).toMatchFileSnapshot(`../statics/sparql-1-1/${name}.sparql`);
    });
  }
});
