import { IndirBuilder } from '@traqula/core';
import type { Path, Pattern, Query, Term, Update } from '@traqula/rules-sparql-1-1';
import type { SparqlJsCompatContext } from '@traqula/sparqljs-traqula-transformations';
import * as Rules from '@traqula/sparqljs-traqula-transformations';
import { createSparqlJsCompatContext } from '@traqula/sparqljs-traqula-transformations';
import type * as SparqlJs from 'sparqljs';

export { collapseIrisToPrefixed, createSparqlJsCompatContext } from '@traqula/sparqljs-traqula-transformations';
export type { SparqlJsCompatContext } from '@traqula/sparqljs-traqula-transformations';

/**
 * All SPARQL.js to Traqula conversion rules. Use `IndirBuilder.create(sparqlJsToTraqula11Builder)` to patch one.
 */
export const sparqlJsToTraqula11Builder = IndirBuilder
  .create(<const> [ Rules.inferSparqlJsTermType, Rules.termFromSparqlJs, Rules.pathFromSparqlJs ])
  .addMany(
    Rules.tripleFromSparqlJs,
    Rules.quadsFromSparqlJs,
    Rules.valuesPatternFromSparqlJs,
    Rules.expressionFromSparqlJs,
    Rules.ensurePatternGroup,
    Rules.groupPatternsFromSparqlJs,
    Rules.patternFromSparqlJs,
    Rules.contextFromSparqlJs,
    Rules.datasetClausesFromSparqlJs,
    Rules.solutionModifiersFromSparqlJs,
    Rules.selectQueryFromSparqlJs,
    Rules.constructQueryFromSparqlJs,
    Rules.askQueryFromSparqlJs,
    Rules.describeQueryFromSparqlJs,
    Rules.queryFromSparqlJs,
    Rules.graphOrDefaultToGraphRef,
    Rules.graphReferenceToGraphRef,
    Rules.updateOperationFromSparqlJs,
    Rules.updateFromSparqlJs,
    Rules.sparqlQueryFromSparqlJs,
  );

/**
 * Converts a SPARQL.js query or update: a SPARQL.js parse result or a hand-built equivalent.
 */
export function sparqlQueryFromSparqlJs(
  query: SparqlJs.SparqlQuery,
  context?: Partial<SparqlJsCompatContext>,
): Query | Update {
  return sparqlJsToTraqula11Builder.build().sparqlQueryFromSparqlJs(createSparqlJsCompatContext(context), query);
}

/**
 * Converts a SPARQL.js (RDF/JS) term, tolerating a missing `termType`.
 */
export function termFromSparqlJs(term: SparqlJs.Term, context?: Partial<SparqlJsCompatContext>): Term {
  return sparqlJsToTraqula11Builder.build().termFromSparqlJs(createSparqlJsCompatContext(context), term);
}

/**
 * Converts a single SPARQL.js pattern, e.g. a stored BGP or WHERE clause fragment.
 */
export function patternFromSparqlJs(pattern: SparqlJs.Pattern, context?: Partial<SparqlJsCompatContext>): Pattern {
  return sparqlJsToTraqula11Builder.build().patternFromSparqlJs(createSparqlJsCompatContext(context), pattern);
}

/**
 * Converts a SPARQL.js property path or plain predicate IRI.
 */
export function pathFromSparqlJs(
  path: SparqlJs.IriTerm | SparqlJs.PropertyPath,
  context?: Partial<SparqlJsCompatContext>,
): Path {
  return sparqlJsToTraqula11Builder.build().pathFromSparqlJs(createSparqlJsCompatContext(context), path);
}
