import { describe, bench } from 'vitest';
import { setup, sourceTrackingParser } from './setup.js';

describe('ast 1.1 ADJUST parse', async() => {
  const {
    allQueries,
  } = await setup();

  bench('traqula 1.1 ADJUST source tracking query -> AST COLD', () => {
    for (const query of allQueries) {
      const traqulaSourceTracking = sourceTrackingParser();
      traqulaSourceTracking.parse(query);
    }
  });
});
