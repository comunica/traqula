import { describe, bench } from 'vitest';
import {
  appendMeasurement,
  astToAlgebraTransformer,
  noSourceTrackingParser,
  perf,
  setup,
  slowTestConfig,
} from './setup.js';

describe('algebra 1.2 parse', async() => {
  const {
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('traqula 1.2 no source tracking query -> algebra COLD', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        const traqulaParser = noSourceTrackingParser();
        const transformer = astToAlgebraTransformer();
        transformer.transform(traqulaParser.parse(query), { quads: true });
      }
    }));
  }, { ...slowTestConfig, teardown: () => {
    if (measurements.length >= slowTestConfig.iterations) {
      appendMeasurement('1.2 parser to algebra COLD', measurements);
    }
    measurements.length = 0;
  } });
});
