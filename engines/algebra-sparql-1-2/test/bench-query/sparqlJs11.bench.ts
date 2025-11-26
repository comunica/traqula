import { translate } from 'sparqlalgebrajs';
import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup } from './setup.js';

describe('algebra 1.2 parse', async() => {
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
    // eslint-disable-next-line no-console
    console.log(`Wrote ${measurements.length} measurements`);
    appendMeasurement('sparqlJS', measurements);
    measurements.length = 0;
  } });
});
