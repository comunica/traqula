import { describe, bench } from 'vitest';
import { noSourceTrackingParser, setup } from './setup.js';

describe('ast 1.2 parse', async() => {
  const {
    allQueries,
  } = await setup();

  bench('traqula 1.2 no source tracking query -> AST COLD', () => {
    for (const query of allQueries) {
      const traqulaParser = noSourceTrackingParser();
      traqulaParser.parse(query);
    }
  });
});
