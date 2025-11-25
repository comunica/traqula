import { describe, bench } from 'vitest';
import { fastTestsConfig, setup } from './setup.js';

describe('ast 1.1 ADJUST parse', async() => {
  const {
    sparqlJSparser,
    allQueries,
  } = await setup();

  bench('sparqlJs 1.1 query -> AST', () => {
    for (const query of allQueries) {
      sparqlJSparser.parse(query);
    }
  }, fastTestsConfig);
});
