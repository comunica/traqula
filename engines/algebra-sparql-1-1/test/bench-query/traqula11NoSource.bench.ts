import { describe, bench } from 'vitest';
import { fastTestsConfig, setup } from './setup.js';

describe('algebra 1.1 parse', async() => {
  const {
    traqulaParser,
    astToAlgebraTransformer,
    allQueries,
  } = await setup();

  bench('traqula 1.1 no source tracking query -> algebra', () => {
    for (const query of allQueries) {
      astToAlgebraTransformer.transform(traqulaParser.parse(query), { quads: true });
    }
  }, fastTestsConfig);
});
