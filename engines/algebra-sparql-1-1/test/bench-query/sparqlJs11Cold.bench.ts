import { translate } from 'sparqlalgebrajs';
import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup, sparqlJsParser } from './setup.js';

describe('algebra 1.1 parse', async() => {
  const {
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('sparqlJs 1.1 query -> algebra COLD', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        const sparqlJSparser = sparqlJsParser();
        translate(sparqlJSparser.parse(query), { quads: true });
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('sparqlJS to algebra COLD', measurements);
    }
    measurements.length = 0;
  } });
});
