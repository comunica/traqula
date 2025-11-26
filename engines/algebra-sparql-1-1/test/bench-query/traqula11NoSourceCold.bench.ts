import { describe, bench } from 'vitest';
import {
  appendMeasurement,
  perf,
  astToAlgebraTransformer,
  noSourceTrackingParser,
  setup,
  slowTestConfig,
} from './setup.js';

describe('algebra 1.1 parse', async() => {
  const {
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('traqula 1.1 no source tracking query -> algebra COLD', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        const traqulaParser = noSourceTrackingParser();
        const transformer = astToAlgebraTransformer();
        transformer.transform(traqulaParser.parse(query), { quads: true });
      }
    }));
  }, { ...slowTestConfig, teardown: () => {
    if (measurements.length >= slowTestConfig.iterations) {
      appendMeasurement('1.1 parser to algebra COLD', measurements);
    }
    measurements.length = 0;
  } });
});
