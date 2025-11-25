import { Parser as SparqlJSparser } from 'sparqljs';
import type { SparqlParser as SparqlJSparserType } from 'sparqljs';
import { describe, bench } from 'vitest';
import { Parser as TraqulaParser } from '../lib/index.js';
import { queryLargeObjectList } from './heatmap.js';

describe('ast 1.1 parse', () => {
  const traqulaParser: TraqulaParser = new TraqulaParser();
  const sparqlJSparser: SparqlJSparserType = new SparqlJSparser();

  describe('large objectList', () => {
    const query = queryLargeObjectList;

    bench('traqula 1.1 large objectList', () => {
      traqulaParser.parse(query);
    });

    bench('sparqljs 1.1 large objectList', () => {
      sparqlJSparser.parse(query);
    });
  });
});
