/**
 * Memory intensive benchmarks are better run in isolation,
 * otherwise warmup or V8 optimization/ deoptimization might result in unfair comparisons
 */

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

export const fastTestsConfig: BenchOptions = { warmupIterations: 100, iterations: 1000 };

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
  const allQueries = await Promise.all([ ...positiveTest('sparql-1-1') ]
    .map(x => x.statics().then(x => x.query)));
  return {
    allQueries,
    traqulaParser: noSourceTrackingParser(),
    astToAlgebraTransformer: astToAlgebraTransformer(),
    sparqlJSparser: sparqlJsParser(),
  };
}
