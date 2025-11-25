import { describe, bench } from 'vitest';
import { astToAlgebraTransformer, noSourceTrackingParser, setup } from './setup.js';

describe('algebra 1.1 parse', async() => {
  const {
    allQueries,
  } = await setup();

  bench('traqula 1.1 no source tracking query -> algebra COLD', () => {
    for (const query of allQueries) {
      const traqulaParser = noSourceTrackingParser();
      const transformer = astToAlgebraTransformer();
      transformer.transform(traqulaParser.parse(query), { quads: true });
    }
  });
});
