/**
 * Memory intensive benchmarks are better run in isolation,
 * otherwise warmup or V8 optimization/ deoptimization might result in unfair comparisons
 */

import { AstFactory } from '@traqula/rules-sparql-1-1';
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

export const fastTestsConfig: BenchOptions = { warmupIterations: 100, iterations: 1000 };

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
  const allQueries = await Promise.all([ ...positiveTest('sparql-1-1') ]
    .map(x => x.statics().then(x => x.query)));
  return {
    allQueries,
    traqulaParser: noSourceTrackingParser(),
    traqulaSourceTracking: sourceTrackingParser(),
    sparqlJSparser: sparqlJsParser(),
  };
}
