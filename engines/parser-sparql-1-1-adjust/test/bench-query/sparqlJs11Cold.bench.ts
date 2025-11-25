import { describe, bench } from 'vitest';
import { setup, sparqlJsParser } from './setup.js';

describe('ast 1.1 ADJUST parse', async() => {
  const {
    allQueries,
  } = await setup();

  bench('sparqlJs 1.1 query -> AST COLD', () => {
    for (const query of allQueries) {
      const sparqlJSparser = sparqlJsParser();
      sparqlJSparser.parse(query);
    }
  });
});
