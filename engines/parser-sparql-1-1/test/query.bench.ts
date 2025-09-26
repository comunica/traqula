import { positiveTest } from '@traqula/test-utils';
import { Parser as SparqlJSparser } from 'sparqljs';
import { describe, bench } from 'vitest';
import { Parser as TraqulaParqer } from '../lib/index.js';
import { queryLargeObjectList } from './heatmap.js';

describe('query, exclude construction', () => {
  const traqulaParser = new TraqulaParqer();
  const sparqlJSparser = new SparqlJSparser();
  const query = queryLargeObjectList;

  describe('large objectList', () => {
    bench('traqula parse', () => {
      traqulaParser.parse(query);
    });
    bench('sparqljs', () => {
      sparqlJSparser.parse(query);
    });
  });

  describe('general queries', async() => {
    const allQueries = await Promise.all([ ...positiveTest('sparql-1-1') ]
      .map(x => x.statics().then(x => x.query)));

    bench('traqula parse', () => {
      for (const query of allQueries) {
        traqulaParser.parse(query);
      }
    });
    bench('sparqljs', () => {
      for (const query of allQueries) {
        sparqlJSparser.parse(query);
      }
    });
  });
});
