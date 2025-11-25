import { describe, bench } from 'vitest';
import { setup, sourceTrackingParser } from './setup.js';

describe('ast 1.2 parse', async() => {
  const {
    allQueries,
  } = await setup();

  bench('traqula 1.2 source tracking query -> AST COLD', () => {
    for (const query of allQueries) {
      const traqulaSourceTracking = sourceTrackingParser();
      traqulaSourceTracking.parse(query);
    }
  });
});
