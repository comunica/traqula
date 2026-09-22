import { Generator } from '@traqula/generator-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
import { Parser as SparqlJsParser } from 'sparqljs';
import { describe, it } from 'vitest';
import { sparqlQueryFromSparqlJs } from '../lib/index.js';

/**
 * End-to-end regression net across the shared SPARQL 1.1 corpus (the same queries
 * `@traqula/parser-sparql-1-1` is tested against): parse each one with the real `sparqljs.Parser`,
 * convert it with this package, and generate it back with Traqula's own `Generator`. The output is
 * checked against a stored snapshot per query (`statics/sparql-1-1/<name>.sparql`, created on first run),
 * so a change to the conversion logic that alters generated output shows up as a diff here instead of
 * only being caught by the hand-picked unit tests in `fromSparqlJs.test.ts`.
 *
 * A handful of corpus queries use syntax sparqljs itself cannot parse (e.g. certain SPARQL-star-adjacent
 * or exotic constructs outside sparqljs' own grammar) - those are skipped rather than failed, since
 * sparqljs' own parsing behavior is not what this suite is testing.
 */
describe('sparqljs -> Traqula static round trip', () => {
  const sparqlJsParser = new SparqlJsParser();
  const generator = new Generator();

  for (const { name, statics } of positiveTest('sparql-1-1', x => ![
    // A PREFIX declaration with no update operation after it. Traqula's own grammar accepts this as a
    // degenerate zero-operation Update, but sparqljs returns a bare `{ prefixes }` object for it - neither
    // `type: 'query'` nor `type: 'update'` - so there is nothing a converter could meaningfully convert.
    'sparql-update-only-prefix',
  ].includes(x))) {
    it(`round trips ${name}`, async({ expect }) => {
      const { query } = await statics();
      let sparqlJsAst;
      try {
        sparqlJsAst = sparqlJsParser.parse(query);
      } catch {
        // Sparqljs cannot parse this corpus entry (e.g. a construct outside its own grammar) - not
        // something this converter can be tested against.
        return;
      }
      const traqulaAst = sparqlQueryFromSparqlJs(sparqlJsAst);
      const generated = generator.generate(traqulaAst);
      await expect(generated).toMatchFileSnapshot(`../statics/sparql-1-1/${name}.sparql`);
    });
  }
});
