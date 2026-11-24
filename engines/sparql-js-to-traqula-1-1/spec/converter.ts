import { Generator } from '@traqula/generator-sparql-1-1';
import { ErrorSkipped } from 'rdf-test-suite';
import { Parser as SparqlJsParser } from 'sparqljs';
import { sparqlQueryFromSparqlJs } from '../lib/index.js';

/**
 * Drives the rdf-test-suite runner (see package.json's `spec:*` scripts) against the official W3C SPARQL
 * test suite, exercising `sparqljs.Parser -> sparqlQueryFromSparqlJs -> @traqula/generator-sparql-1-1`
 * end to end for every spec test case, the same way `@traqula/parser-sparql-1-1`'s own `spec/parser.ts`
 * exercises Traqula's parser directly. Evaluation is out of scope for a converter, but the query/update
 * still has to parse, convert and regenerate without throwing.
 */
export function parse(queryString: string, options: { baseIRI?: string } = {}): void {
  const sparqlJsParser = new SparqlJsParser({ baseIRI: options.baseIRI });
  const sparqlJsAst = sparqlJsParser.parse(queryString);
  const traqulaAst = sparqlQueryFromSparqlJs(sparqlJsAst);
  new Generator().generate(traqulaAst);
}

export function query(_data: unknown, queryString: string, options: { baseIRI?: string } = {}): Promise<never> {
  parse(queryString, options);
  return Promise.reject(new ErrorSkipped('Querying is not supported'));
}

export function update(_data: unknown, queryString: string, options: { baseIRI?: string } = {}): Promise<never> {
  parse(queryString, options);
  return Promise.reject(new ErrorSkipped('Updating is not supported'));
}
