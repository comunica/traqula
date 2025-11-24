import { AstFactory } from '@traqula/rules-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
import { Parser as SparqlJSparser } from 'sparqljs';
import { describe, bench } from 'vitest';
import { Parser as TraqulaParser } from '../lib/index.js';
import { queryLargeObjectList } from './heatmap.js';

describe('ast 1.1 parse', () => {
  const sourceTrackingAstFactory = new AstFactory({ tracksSourceLocation: true });
  const sourceTrackingParser = new TraqulaParser({
    defaultContext: { astFactory: sourceTrackingAstFactory },
    lexerConfig: { positionTracking: 'full' },
  });
  const noSourceTrackingParser = new TraqulaParser();
  const sparqlJSparser = new SparqlJSparser();
  const query = queryLargeObjectList;

  describe('large objectList', () => {
    bench('traqula large objectList', () => {
      sourceTrackingParser.parse(query);
    });
    bench('sparqljs large objectList', () => {
      sparqlJSparser.parse(query);
    });
  });

  describe('general queries', async() => {
    const allQueries = await Promise.all([ ...positiveTest('sparql-1-1') ]
      .map(x => x.statics().then(x => x.query)));

    bench('traqula 1.1 source tracking query -> AST', () => {
      for (const query of allQueries) {
        sourceTrackingParser.parse(query);
      }
    });

    bench('traqula 1.1 source tracking query -> AST COLD', () => {
      for (const query of allQueries) {
        const sourceTrackingParser = new TraqulaParser({
          defaultContext: { astFactory: sourceTrackingAstFactory },
          lexerConfig: { positionTracking: 'full' },
        });
        sourceTrackingParser.parse(query);
      }
    });

    bench('sparqljs 1.1 query -> AST', () => {
      for (const query of allQueries) {
        sparqlJSparser.parse(query);
      }
    });

    bench('traqula 1.1 no-source tracking query -> AST', () => {
      for (const query of allQueries) {
        noSourceTrackingParser.parse(query);
      }
    });

    bench('traqula 1.1 no-source tracking query -> AST COLD', () => {
      for (const query of allQueries) {
        const noSourceTrackingTraqula = new TraqulaParser();
        noSourceTrackingTraqula.parse(query);
      }
    });
  });
});
