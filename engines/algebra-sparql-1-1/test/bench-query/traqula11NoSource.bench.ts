import { describe, bench } from 'vitest';
import { appendMeasurement, perf, fastTestsConfig, setup } from './setup.js';

describe('algebra 1.1 parse', async() => {
  const {
    traqulaParser,
    astToAlgebraTransformer,
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('traqula 1.1 no source tracking query -> algebra', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        astToAlgebraTransformer.transform(traqulaParser.parse(query), { quads: true });
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('1.1 to algebra', measurements);
    }
    measurements.length = 0;
  } });
});
