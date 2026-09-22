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
import * as Rules from '@traqula/sparqljs-traqula-transformations';
import { createSparqlJsCompatContext } from '@traqula/sparqljs-traqula-transformations';
import type * as SparqlJs from 'sparqljs';

export { collapseIrisToPrefixed } from '@traqula/sparqljs-traqula-transformations';

/**
 * Pre-configured {@link IndirBuilder} for converting sparqljs SPARQL 1.1 AST to Traqula's SPARQL 1.1 AST.
 * Combines all sparqljs-compat transformation definitions from `@traqula/sparqljs-traqula-transformations`.
 * Use {@link IndirBuilder.create IndirBuilder.create(sparqlJsToTraqula11Builder)} to extend or patch it -
 * for example to override `termFromSparqlJs` with a custom blank-node labeling scheme.
 */
export const sparqlJsToTraqula11Builder = IndirBuilder
  .create(<const> [ Rules.termFromSparqlJs, Rules.pathFromSparqlJs ])
  .addMany(
    Rules.tripleFromSparqlJs,
    Rules.quadsFromSparqlJs,
    Rules.valuesPatternFromSparqlJs,
    Rules.expressionFromSparqlJs,
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
 * Converts a single sparqljs (rdfjs-shaped) term into a Traqula {@link Term}.
 * Suitable for use on values coming from an rdfjs-compatible datastore, not only from sparqljs itself.
 * Tolerates a missing `termType` - see `@traqula/sparqljs-traqula-transformations`'s module docs.
 */
export function termFromSparqlJs(term: SparqlJs.Term): Term {
  return sparqlJsToTraqula11Builder.build().termFromSparqlJs(createSparqlJsCompatContext(), term);
}

/**
 * Converts a sparqljs property path (or plain predicate IRI) into a Traqula {@link Path}.
 */
export function pathFromSparqlJs(item: SparqlJs.IriTerm | SparqlJs.PropertyPath): Path {
  return sparqlJsToTraqula11Builder.build().pathFromSparqlJs(createSparqlJsCompatContext(), item);
}

/**
 * Converts a single sparqljs {@link SparqlJs.Triple} into a Traqula {@link TripleNesting}.
 */
export function tripleFromSparqlJs(triple: SparqlJs.Triple): TripleNesting {
  return sparqlJsToTraqula11Builder.build().tripleFromSparqlJs(createSparqlJsCompatContext(), triple);
}

/**
 * Converts a sparqljs {@link SparqlJs.Expression} into a Traqula {@link Expression}.
 */
export function expressionFromSparqlJs(expression: SparqlJs.Expression): Expression {
  return sparqlJsToTraqula11Builder.build().expressionFromSparqlJs(createSparqlJsCompatContext(), expression);
}

/**
 * Converts a single sparqljs {@link SparqlJs.Pattern} (a where-clause element, including nested subqueries)
 * into a Traqula {@link Pattern}.
 */
export function patternFromSparqlJs(pattern: SparqlJs.Pattern): Pattern {
  return sparqlJsToTraqula11Builder.build().patternFromSparqlJs(createSparqlJsCompatContext(), pattern);
}

export function selectQueryFromSparqlJs(query: SparqlJs.SelectQuery): QuerySelect {
  return sparqlJsToTraqula11Builder.build().selectQueryFromSparqlJs(createSparqlJsCompatContext(), query);
}

export function constructQueryFromSparqlJs(query: SparqlJs.ConstructQuery): QueryConstruct {
  return sparqlJsToTraqula11Builder.build().constructQueryFromSparqlJs(createSparqlJsCompatContext(), query);
}

export function askQueryFromSparqlJs(query: SparqlJs.AskQuery): QueryAsk {
  return sparqlJsToTraqula11Builder.build().askQueryFromSparqlJs(createSparqlJsCompatContext(), query);
}

export function describeQueryFromSparqlJs(query: SparqlJs.DescribeQuery): QueryDescribe {
  return sparqlJsToTraqula11Builder.build().describeQueryFromSparqlJs(createSparqlJsCompatContext(), query);
}

/**
 * Converts a sparqljs {@link SparqlJs.Query} (any of SELECT/CONSTRUCT/ASK/DESCRIBE) into a Traqula {@link Query}.
 */
export function queryFromSparqlJs(query: SparqlJs.Query): Query {
  return sparqlJsToTraqula11Builder.build().queryFromSparqlJs(createSparqlJsCompatContext(), query);
}

export function graphOrDefaultToGraphRef(graph: SparqlJs.GraphOrDefault): GraphRefDefault | GraphRefSpecific {
  return sparqlJsToTraqula11Builder.build().graphOrDefaultToGraphRef(createSparqlJsCompatContext(), graph);
}

export function graphReferenceToGraphRef(graph: SparqlJs.GraphReference): GraphRef {
  return sparqlJsToTraqula11Builder.build().graphReferenceToGraphRef(createSparqlJsCompatContext(), graph);
}

/**
 * Converts a single sparqljs update operation into a Traqula {@link UpdateOperation}.
 */
export function updateOperationFromSparqlJs(operation: SparqlJs.UpdateOperation): UpdateOperation {
  return sparqlJsToTraqula11Builder.build().updateOperationFromSparqlJs(createSparqlJsCompatContext(), operation);
}

/**
 * Converts a full sparqljs {@link SparqlJs.Update} into a Traqula {@link Update}.
 */
export function updateFromSparqlJs(update: SparqlJs.Update): Update {
  return sparqlJsToTraqula11Builder.build().updateFromSparqlJs(createSparqlJsCompatContext(), update);
}

/**
 * Converts a full sparqljs parse result (`new (require('sparqljs').Parser)().parse(queryString)`) into a
 * Traqula {@link Query}/{@link Update} AST. This is the main entry point most consumers want; every
 * intermediate conversion step above is exported too, so a single stored fragment (e.g. just a `Pattern`
 * used as one reusable query-builder piece) can be converted without a whole query around it.
 */
export function sparqlQueryFromSparqlJs(query: SparqlJs.SparqlQuery): Query | Update {
  return sparqlJsToTraqula11Builder.build().sparqlQueryFromSparqlJs(createSparqlJsCompatContext(), query);
}
