import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup } from './setup.js';

describe('ast 1.2 parse', async() => {
  const {
    traqulaSourceTracking,
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('traqula 1.2 source tracking query -> AST', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        traqulaSourceTracking.parse(query);
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('1.2 parser to AST + source', measurements);
    }
    measurements.length = 0;
  } });
});
