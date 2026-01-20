import Parser from 'tree-sitter';

// eslint-disable-next-line ts/ban-ts-comment
// @ts-expect-error
import SPARQL from 'tree-sitter-sparql';
import { describe, bench } from 'vitest';
import { appendMeasurement, fastTestsConfig, perf, setup } from './setup.js';

describe('tree-sitter 1.1 cold parse', async() => {
  const parser = new Parser();
  parser.setLanguage(SPARQL);
  const {
    allQueries,
  } = await setup();

  const measurements: number[] = [];

  bench('sparqlJs 1.1 query -> AST COLD', () => {
    measurements.push(perf(() => {
      for (const query of allQueries) {
        const parser = new Parser();
        parser.setLanguage(SPARQL);
        parser.parse(query);
      }
    }));
  }, { ...fastTestsConfig, teardown: () => {
    if (measurements.length >= fastTestsConfig.iterations) {
      appendMeasurement('tree-sitter to AST COLD', measurements);
    }
    measurements.length = 0;
  } });
});
