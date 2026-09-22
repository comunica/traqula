import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { TransformerObject } from '@traqula/core';
import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import type { SparqlContext } from '@traqula/rules-sparql-1-1';
import { ErrorSkipped } from 'rdf-test-suite';
import { toAlgebra, toAst } from '../lib/index.js';

/**
 * Maximum number of parse -> algebra -> AST -> generate cycles before the generated query must be stable.
 * Can be overwritten through the environment variable TRAQULA_ROUND_TRIP_MAX_ITERATIONS.
 */
const maxIterations = Number(process.env.TRAQULA_ROUND_TRIP_MAX_ITERATIONS ?? 2);

const transformer = new TransformerObject();

/**
 * The parser prefixes explicitly labelled blank nodes (`_:a` becomes `_:e_a`) to keep them apart from generated ones.
 * Strip that prefix again so labels do not grow on every round trip, while the query itself does not change.
 */
function stripBlankNodePrefix(algebra: Algebra.Operation): Algebra.Operation {
  return <Algebra.Operation> transformer.transformObject(algebra, (copy) => {
    const term = <{ termType?: unknown; value: string }> copy;
    if (term.termType === 'BlankNode' && term.value.startsWith('e_')) {
      term.value = term.value.slice('e_'.length);
    }
    return copy;
  });
}

/**
 * Parses the query, translates it to algebra and back to a query string, repeatedly,
 * until the generated query is a fixed point of this round trip.
 * Throws when the query is invalid, or when no fixed point is reached within {@link maxIterations}.
 */
export function parse(query: string, context: Partial<SparqlContext> = {}): void {
  const parser = new Parser();
  const generator = new Generator();
  let previous: string | undefined;
  let current = query;
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const ast = parser.parse(current, context);
    const algebra = stripBlankNodePrefix(toAlgebra(ast, { quads: true, baseIRI: context.baseIRI }));
    previous = current;
    current = generator.generate(toAst(algebra));
    if (iteration > 1 && current === previous) {
      return;
    }
  }
  throw new Error(`Round trip did not converge within ${maxIterations} iterations:\n${previous}\n---\n${current}`);
}

export function query(_data: unknown, queryString: string, context: Partial<SparqlContext> = {}): Promise<never> {
  // Evaluation is out of scope, but the query still has to round trip.
  parse(queryString, context);
  return Promise.reject(new ErrorSkipped('Querying is not supported'));
}

export function update(_data: unknown, queryString: string, context: Partial<SparqlContext> = {}): Promise<never> {
  // Evaluation is out of scope, but the request still has to round trip.
  parse(queryString, context);
  return Promise.reject(new ErrorSkipped('Updating is not supported'));
}
