import { describe, bench } from 'vitest';
import { fastTestsConfig, setup } from './setup.js';

describe('ast 1.2 parse', async() => {
  const {
    sparqlJSparser,
    allQueries,
  } = await setup();

  bench('sparqlJs 1.2 query -> AST', () => {
    for (const query of allQueries) {
      sparqlJSparser.parse(query);
    }
  }, fastTestsConfig);
});
