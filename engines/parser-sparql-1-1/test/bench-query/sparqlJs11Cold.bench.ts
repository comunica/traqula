import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup, sparqlJsParser } from './setup.js';

describe('ast 1.1 parse', async() => {
  const {
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('sparqlJs 1.1 query -> AST COLD', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        const sparqlJSparser = sparqlJsParser();
        sparqlJSparser.parse(query);
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('sparqlJS to AST COLD', measurements);
    }
    measurements.length = 0;
  } });
});
