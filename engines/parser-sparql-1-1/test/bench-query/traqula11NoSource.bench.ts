import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup } from './setup.js';

describe('ast 1.1 parse', async() => {
  const {
    traqulaParser,
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('traqula 1.1 no source tracking query -> AST', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        traqulaParser.parse(query);
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('1.1 parser to AST', measurements);
    }
    measurements.length = 0;
  } });
});
