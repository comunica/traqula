import { translate } from 'sparqlalgebrajs';
import { describe, bench } from 'vitest';
import { fastTestsConfig, setup } from './setup.js';

describe('algebra 1.2 parse', async() => {
  const {
    sparqlJSparser,
    allQueries,
  } = await setup();

  bench('sparqlJs 1.1 query -> algebra', () => {
    for (const query of allQueries) {
      translate(sparqlJSparser.parse(query), { quads: true });
    }
  }, fastTestsConfig);
});
