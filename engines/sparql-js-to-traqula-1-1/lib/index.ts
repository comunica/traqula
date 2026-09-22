import { IndirBuilder } from '@traqula/core';
import type {
  Expression,
  GraphRef,
  GraphRefDefault,
  GraphRefSpecific,
  Path,
  Pattern,
  Query,
  QueryAsk,
  QueryConstruct,
  QueryDescribe,
  QuerySelect,
  Term,
  TripleNesting,
  Update,
  UpdateOperation,
} from '@traqula/rules-sparql-1-1';
import type { SparqlJsCompatOptions } from '@traqula/sparqljs-traqula-transformations';
import * as Rules from '@traqula/sparqljs-traqula-transformations';
import { createSparqlJsCompatContext } from '@traqula/sparqljs-traqula-transformations';
import type * as SparqlJs from 'sparqljs';

export { collapseIrisToPrefixed } from '@traqula/sparqljs-traqula-transformations';
export type { SparqlJsCompatOptions } from '@traqula/sparqljs-traqula-transformations';

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
 * Converts a SPARQL.js (RDF/JS) term, tolerating a missing `termType`.
 */
export function termFromSparqlJs(term: SparqlJs.Term): Term {
  return sparqlJsToTraqula11Builder.build().termFromSparqlJs(createSparqlJsCompatContext(), term);
}

/**
 * Converts a SPARQL.js property path or plain predicate IRI.
 */
export function pathFromSparqlJs(item: SparqlJs.IriTerm | SparqlJs.PropertyPath): Path {
  return sparqlJsToTraqula11Builder.build().pathFromSparqlJs(createSparqlJsCompatContext(), item);
}

/**
 * Converts a single SPARQL.js triple.
 */
export function tripleFromSparqlJs(triple: SparqlJs.Triple): TripleNesting {
  return sparqlJsToTraqula11Builder.build().tripleFromSparqlJs(createSparqlJsCompatContext(), triple);
}

/**
 * Converts a SPARQL.js expression.
 */
export function expressionFromSparqlJs(
  expression: SparqlJs.Expression,
  options?: SparqlJsCompatOptions,
): Expression {
  return sparqlJsToTraqula11Builder.build().expressionFromSparqlJs(createSparqlJsCompatContext(options), expression);
}

/**
 * Converts a single SPARQL.js pattern, e.g. a stored WHERE clause fragment.
 */
export function patternFromSparqlJs(pattern: SparqlJs.Pattern, options?: SparqlJsCompatOptions): Pattern {
  return sparqlJsToTraqula11Builder.build().patternFromSparqlJs(createSparqlJsCompatContext(options), pattern);
}

/**
 * Converts a SPARQL.js SELECT query.
 */
export function selectQueryFromSparqlJs(query: SparqlJs.SelectQuery, options?: SparqlJsCompatOptions): QuerySelect {
  return sparqlJsToTraqula11Builder.build().selectQueryFromSparqlJs(createSparqlJsCompatContext(options), query);
}

/**
 * Converts a SPARQL.js CONSTRUCT query.
 */
export function constructQueryFromSparqlJs(
  query: SparqlJs.ConstructQuery,
  options?: SparqlJsCompatOptions,
): QueryConstruct {
  return sparqlJsToTraqula11Builder.build().constructQueryFromSparqlJs(createSparqlJsCompatContext(options), query);
}

/**
 * Converts a SPARQL.js ASK query.
 */
export function askQueryFromSparqlJs(query: SparqlJs.AskQuery, options?: SparqlJsCompatOptions): QueryAsk {
  return sparqlJsToTraqula11Builder.build().askQueryFromSparqlJs(createSparqlJsCompatContext(options), query);
}

/**
 * Converts a SPARQL.js DESCRIBE query.
 */
export function describeQueryFromSparqlJs(
  query: SparqlJs.DescribeQuery,
  options?: SparqlJsCompatOptions,
): QueryDescribe {
  return sparqlJsToTraqula11Builder.build().describeQueryFromSparqlJs(createSparqlJsCompatContext(options), query);
}

/**
 * Converts a SPARQL.js query of any form.
 */
export function queryFromSparqlJs(query: SparqlJs.Query, options?: SparqlJsCompatOptions): Query {
  return sparqlJsToTraqula11Builder.build().queryFromSparqlJs(createSparqlJsCompatContext(options), query);
}

/**
 * Converts the graph of a CREATE/ADD/MOVE/COPY operation.
 */
export function graphOrDefaultToGraphRef(graph: SparqlJs.GraphOrDefault): GraphRefDefault | GraphRefSpecific {
  return sparqlJsToTraqula11Builder.build().graphOrDefaultToGraphRef(createSparqlJsCompatContext(), graph);
}

/**
 * Converts the graph of a CLEAR/DROP operation.
 */
export function graphReferenceToGraphRef(graph: SparqlJs.GraphReference): GraphRef {
  return sparqlJsToTraqula11Builder.build().graphReferenceToGraphRef(createSparqlJsCompatContext(), graph);
}

/**
 * Converts a single SPARQL.js update operation.
 */
export function updateOperationFromSparqlJs(
  operation: SparqlJs.UpdateOperation,
  options?: SparqlJsCompatOptions,
): UpdateOperation {
  return sparqlJsToTraqula11Builder.build()
    .updateOperationFromSparqlJs(createSparqlJsCompatContext(options), operation);
}

/**
 * Converts a SPARQL.js update request.
 */
export function updateFromSparqlJs(update: SparqlJs.Update, options?: SparqlJsCompatOptions): Update {
  return sparqlJsToTraqula11Builder.build().updateFromSparqlJs(createSparqlJsCompatContext(options), update);
}

/**
 * Converts a SPARQL.js query or update: a SPARQL.js parse result or a hand-built equivalent.
 */
export function sparqlQueryFromSparqlJs(query: SparqlJs.SparqlQuery, options?: SparqlJsCompatOptions): Query | Update {
  return sparqlJsToTraqula11Builder.build().sparqlQueryFromSparqlJs(createSparqlJsCompatContext(options), query);
}
