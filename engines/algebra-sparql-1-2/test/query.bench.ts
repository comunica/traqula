import { Parser as TraqulaParser } from '@traqula/parser-sparql-1-2';
import { positiveTest } from '@traqula/test-utils';
import { translate } from 'sparqlalgebrajs';
import { describe, bench } from 'vitest';
import { toAlgebra } from '../lib/index.js';

describe('algebra 1.2 parse', () => {
  const traqulaParser = new TraqulaParser();

  describe('general queries', async() => {
    const allQueries = await Promise.all([ ...positiveTest('sparql-1-1') ]
      .map(x => x.statics().then(x => x.query)));

    bench('traqula 1.2 query -> algebra', () => {
      for (const query of allQueries) {
        toAlgebra(traqulaParser.parse(query), { quads: true });
      }
    });

    bench('traqula 1.2 query -> algebra COLD', () => {
      for (const query of allQueries) {
        const traqulaParser = new TraqulaParser();
        toAlgebra(traqulaParser.parse(query), { quads: true });
      }
    });

    bench('sparqlAlgebraJs query -> algebra', () => {
      for (const query of allQueries) {
        translate(query, { quads: true });
      }
    });
  });
});
