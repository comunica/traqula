import { describe, bench } from 'vitest';
import { appendMeasurement, noSourceTrackingParser, perf, setup, slowTestConfig } from './setup.js';

describe('ast 1.2 parse', async() => {
  const {
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('traqula 1.2 no source tracking query -> AST COLD', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        const traqulaParser = noSourceTrackingParser();
        traqulaParser.parse(query);
      }
    }));
  }, { ...slowTestConfig, teardown: () => {
    if (measurements.length >= slowTestConfig.iterations) {
      appendMeasurement('1.2 parser to AST COLD', measurements);
    }
    measurements.length = 0;
  } });
});
