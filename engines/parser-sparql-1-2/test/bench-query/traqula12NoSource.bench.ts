import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup } from './setup.js';

describe('ast 1.2 parse', async() => {
  const {
    traqulaParser,
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('traqula 1.2 no source tracking query -> AST', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        traqulaParser.parse(query);
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('1.2 parser to AST', measurements);
    }
    measurements.length = 0;
  } });
});
