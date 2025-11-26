import { translate } from 'sparqlalgebrajs';
import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup } from './setup.js';

describe('algebra 1.1 parse', async() => {
  const {
    sparqlJSparser,
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('sparqlJs 1.1 query -> algebra', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        translate(sparqlJSparser.parse(query), { quads: true });
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('sparqlJS to algebra', measurements);
    }
    measurements.length = 0;
  } });
});
