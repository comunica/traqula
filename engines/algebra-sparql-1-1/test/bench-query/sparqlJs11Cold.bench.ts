import { translate } from 'sparqlalgebrajs';
import { describe, bench } from 'vitest';
import { setup, sparqlJsParser } from './setup.js';

describe('algebra 1.1 parse', async() => {
  const {
    allQueries,
  } = await setup();

  bench('sparqlJs 1.1 query -> algebra COLD', () => {
    for (const query of allQueries) {
      const sparqlJSparser = sparqlJsParser();
      translate(sparqlJSparser.parse(query), { quads: true });
    }
  });
});
