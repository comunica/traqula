import { describe, bench } from 'vitest';
import { fastTestsConfig, setup } from './setup.js';

describe('ast 1.1 ADJUST parse', async() => {
  const {
    traqulaParser,
    allQueries,
  } = await setup();

  bench('traqula 1.1 ADJUST no source tracking query -> AST', () => {
    for (const query of allQueries) {
      traqulaParser.parse(query);
    }
  }, fastTestsConfig);
});
