/**
 * Memory intensive benchmarks are better run in isolation,
 * otherwise warmup or V8 optimization/ deoptimization might result in unfair comparisons
 */

import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { AstFactory } from '@traqula/rules-sparql-1-2';
import { positiveTest } from '@traqula/test-utils';
import type { SparqlParser as SparqlJSparserType } from 'sparqljs';
import { Parser as SparqlJSparser } from 'sparqljs';
import type { BenchOptions } from 'vitest';
import { Parser as TraqulaParser } from '../../lib/index.js';

interface SetupRet {
  allQueries: string[];
  traqulaParser: TraqulaParser;
  traqulaSourceTracking: TraqulaParser;
  sparqlJSparser: SparqlJSparserType;
}

export const fastTestsConfig = { warmupIterations: 100, iterations: 1000 } satisfies BenchOptions;
export const slowTestConfig = { warmupIterations: 10, iterations: 20 } satisfies BenchOptions;

export function noSourceTrackingParser(): TraqulaParser {
  return new TraqulaParser();
}

export function sourceTrackingParser(): TraqulaParser {
  const astFactory = new AstFactory();
  return new TraqulaParser({
    lexerConfig: { positionTracking: 'full' },
    defaultContext: { astFactory },
  });
}

export function sparqlJsParser(): SparqlJSparserType {
  return new SparqlJSparser();
}

export async function setup(): Promise<SetupRet> {
  const allQueries = await Promise.all([ ...positiveTest('AKSWBenchmark') ]
    .map(x => x.statics().then(x => x.query)));
  return {
    allQueries,
    traqulaParser: noSourceTrackingParser(),
    traqulaSourceTracking: sourceTrackingParser(),
    sparqlJSparser: sparqlJsParser(),
  };
}

export function perf(callback: () => void): number {
  const start = performance.now();
  callback();
  const end = performance.now();
  return end - start;
}

export function appendMeasurement(name: string, measurements: number[]): void {
  const file = join(__dirname, '../../../../bench-times.csv');
  appendFileSync(
    file,
    `${name};${measurements.join(';')}\n`,
    { encoding: 'utf-8' },
  );
  // eslint-disable-next-line no-console
  console.log(`Wrote ${measurements.length} into ${file}.`);
}
