import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup } from './setup.js';

describe('ast 1.1 parse', async() => {
  const {
    sparqlJSparser,
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('sparqlJs 1.1 query -> AST', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        sparqlJSparser.parse(query);
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('sparqlJS to AST', measurements);
    }
    measurements.length = 0;
  } });
});
