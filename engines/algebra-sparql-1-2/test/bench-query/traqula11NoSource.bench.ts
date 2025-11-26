import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup } from './setup.js';

describe('algebra 1.2 parse', async() => {
  const {
    traqulaParser,
    astToAlgebraTransformer,
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('traqula 1.2 no source tracking query -> algebra', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        astToAlgebraTransformer.transform(traqulaParser.parse(query), { quads: true });
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('1.2 parser to algebra', measurements);
    }
    measurements.length = 0;
  } });
});
