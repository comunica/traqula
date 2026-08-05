import type { SparqlContext } from '@traqula/rules-sparql-1-2';
import { ErrorSkipped } from 'rdf-test-suite';
import { Parser } from '../lib/index.js';

export function parse(query: string, context: Partial<SparqlContext> = {}): void {
  const parser = new Parser();
  parser.parse(query, context);
}
export function query(_data: unknown, queryString: string, context: Partial<SparqlContext> = {}): Promise<never> {
  // Evaluation is out of scope for a parser, but the query still has to parse.
  parse(queryString, context);
  return Promise.reject(new ErrorSkipped('Querying is not supported'));
}

export function update(_data: unknown, queryString: string, context: Partial<SparqlContext> = {}): Promise<never> {
  // Evaluation is out of scope for a parser, but the request still has to parse.
  parse(queryString, context);
  return Promise.reject(new ErrorSkipped('Updating is not supported'));
}
