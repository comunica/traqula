import { Parser as SparqlJSparser } from 'sparqljs';
import { describe, bench } from 'vitest';
import { Parser as TraqulaParqer } from '../lib/index.js';
import { queryLargeObjectList } from './heatmap.js';

describe('query, exclude construction', () => {
  const traqulaParqer = new TraqulaParqer();
  const sparqlJSparser = new SparqlJSparser();
  const query = queryLargeObjectList;

  bench('traqula parse', () => {
    traqulaParqer.parse(query);
  });
  bench('sparqljs', () => {
    sparqlJSparser.parse(query);
  });
});
