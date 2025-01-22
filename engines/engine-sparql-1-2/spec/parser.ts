import {ErrorSkipped,} from 'rdf-test-suite';
import {Parser} from '../lib'
import {SparqlContext} from "@traqula/rules-sparql-1-1";

const parser = new Parser();
export function parse(query: string, context: Partial<SparqlContext> = {}) {
  parser.parse(query, context);
}
export function query() {
  return Promise.reject(new ErrorSkipped('Querying is not supported'));
}

export function update() {
  return Promise.reject(new ErrorSkipped('Updating is not supported'));
}
