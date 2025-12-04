/**
 * Memory intensive benchmarks are better run in isolation,
 * otherwise warmup or V8 optimization/ deoptimization might result in unfair comparisons
 */

import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { Parser as TraqulaParser } from '@traqula/parser-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
import type { SparqlParser as SparqlJSparserType } from 'sparqljs';
import { Parser as SparqlJSparser } from 'sparqljs';
import type { BenchOptions } from 'vitest';
import { AstToAlgebraTransformer } from '../../lib/index.js';

interface SetupRet {
  allQueries: string[];
  traqulaParser: TraqulaParser;
  astToAlgebraTransformer: AstToAlgebraTransformer;
  sparqlJSparser: SparqlJSparserType;
}

export const fastTestsConfig = { warmupIterations: 100, iterations: 1000 } satisfies BenchOptions;
export const slowTestConfig = { warmupIterations: 10, iterations: 20 } satisfies BenchOptions;

export function noSourceTrackingParser(): TraqulaParser {
  return new TraqulaParser();
}

export function sparqlJsParser(): SparqlJSparserType {
  return new SparqlJSparser();
}

export function astToAlgebraTransformer(): AstToAlgebraTransformer {
  return new AstToAlgebraTransformer();
}

export async function setup(): Promise<SetupRet> {
  const allQueries = await Promise.all([ ...positiveTest('AKSWBenchmark') ]
    .map(x => x.statics().then(x => x.query)));
  console.log(allQueries.length);
  return {
    allQueries,
    traqulaParser: noSourceTrackingParser(),
    astToAlgebraTransformer: astToAlgebraTransformer(),
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
