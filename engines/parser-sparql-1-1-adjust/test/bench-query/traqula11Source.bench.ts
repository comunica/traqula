import { describe, bench } from 'vitest';
import { fastTestsConfig, setup } from './setup.js';

describe('ast 1.1 ADJUST parse', async() => {
  const {
    traqulaSourceTracking,
    allQueries,
  } = await setup();

  bench('traqula 1.1 ADJUST source tracking query -> AST', () => {
    for (const query of allQueries) {
      traqulaSourceTracking.parse(query);
    }
  }, fastTestsConfig);
});
