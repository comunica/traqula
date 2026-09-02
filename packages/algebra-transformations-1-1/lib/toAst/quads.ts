import type * as RDF from '@rdfjs/types';
import type { Algebra } from '../index.js';
import { types } from '../toAlgebra/index.js';
import type { AstIndir } from './core.js';

/**
 * Removes quad component of triple and ...
 */
export const removeAlgQuads: AstIndir<'removeQuads', Algebra.Operation, [Algebra.Operation]> = {
  name: 'removeQuads',
  fun: ({ SUBRULE }) => (_, op) =>
    <typeof op>SUBRULE(removeAlgQuadsRecursive, op, [], false),
};

/**
 * Whether the `input` of `knownOp` will be read with the SELECT-expression reading of EXTEND
 * (`registerProjection`'s `c.project`), rather than the BIND reading. True only directly under
 * PROJECT/ASK/DESCRIBE, and passed through unchanged across a chain of EXTEND/ORDER_BY - exactly
 * the operators `registerProjection` does not close projection scope on. Every other operation
 * type (including CONSTRUCT, which never opens projection scope at all) closes it to false.
 */
function inputProjectionScope(knownOp: Algebra.Operation, projectionScope: boolean): boolean {
  if (knownOp.type === types.PROJECT || knownOp.type === types.ASK || knownOp.type === types.DESCRIBE) {
    return true;
  }
  if (knownOp.type === types.EXTEND || knownOp.type === types.ORDER_BY) {
    return projectionScope;
  }
  return false;
}

/**
 * Removes quad component of triples and wrap found bgps in Algebra.GraphOperations
 * Mainly returns same type as first arg
 * @param projectionScope whether we are directly below an EXTEND/ORDER_BY chain rooted at a
 * PROJECT/ASK/DESCRIBE - see {@link inputProjectionScope}.
 */
export const removeAlgQuadsRecursive: AstIndir<
  'removeQuadsRecursive',
unknown,
[unknown, (RDF.NamedNode | RDF.DefaultGraph)[], boolean]
> = {
  name: 'removeQuadsRecursive',
  fun: ({ SUBRULE }) => ({ algebraFactory: AF }, unknownVal, graphs, projectionScope) => {
    if (Array.isArray(unknownVal)) {
      return unknownVal.map(sub => SUBRULE(removeAlgQuadsRecursive, sub, graphs, projectionScope));
    }

    if (typeof unknownVal !== 'object' || unknownVal === null || !('type' in unknownVal) || !unknownVal.type) {
      return unknownVal;
    }
    const knownOp = <Algebra.Operation> unknownVal;

    // UPDATE operations with Patterns handle graphs a bit differently - do not traverse
    if (knownOp.type === types.DELETE_INSERT) {
      return unknownVal;
    }

    // If triple or path register graph and return - graphs will be populated by in order graph occurrence
    if ((knownOp.type === types.PATTERN || knownOp.type === types.PATH) && knownOp.graph) {
      const graph = <RDF.NamedNode | RDF.DefaultGraph> knownOp.graph;
      // We create a list that tracks, for each pattern the original graph and remove the graph
      graphs.push(graph);
      // Remove non-default graphs
      if (graph.value !== '') {
        return knownOp.type === types.PATTERN ?
          AF.createPattern(knownOp.subject, knownOp.predicate, knownOp.object) :
          AF.createPath(knownOp.subject, knownOp.predicate, knownOp.object);
      }
      return knownOp;
    }

    // We build our `op` again.
    const result: any = {};
    // Unique graphs per key (keyof T)
    const keyGraphs: Record<string, (RDF.NamedNode | RDF.DefaultGraph)[]> = {};
    // Track all the unique graph names for the entire Operation
    const operationGraphNames: Record<string, RDF.NamedNode | RDF.DefaultGraph> = {};
    for (const [ key, value ] of Object.entries(knownOp)) {
      const newGraphs: (RDF.NamedNode | RDF.DefaultGraph)[] = [];
      // Only `input` ever continues a projection-scope chain; every other key (an EXTEND's own
      // `expression`, for instance) starts fresh outside of it - see `inputProjectionScope`.
      const childScope = key === 'input' && inputProjectionScope(knownOp, projectionScope);
      result[key] = SUBRULE(removeAlgQuadsRecursive, value, newGraphs, childScope);

      // If a graph was registered, we register the discovery we did at this key of the object
      //  and create graph identifier map
      if (newGraphs.length > 0) {
        keyGraphs[key] = newGraphs;
        for (const graph of newGraphs) {
          operationGraphNames[graph.value] = graph;
        }
      }
    }

    const graphNameSet = Object.keys(operationGraphNames);
    // Finally, if we found graphs at some keys, wrap those keys in Algebra.graphOperations
    if (graphNameSet.length > 0) {
      // We also need to create graph statement if we are at the edge of certain operations.
      // PROJECT/SERVICE are query/service boundaries the graph may not leak past. GROUP and
      // ORDER_BY are solution modifiers that always pass their input through untouched and
      // register themselves as external state instead (translateAlgGroup, translateAlgOrderBy),
      // so they never render as a bracket around their input - deferring the wrap past them
      // would place a GROUP BY / ORDER BY that belongs at the enclosing SELECT inside the GRAPH
      // clause along with the pattern, which is not where the original query put it (see
      // task.md entry 1 for the toAst-side twin of this same class of bug). EXTEND is the same
      // only in projection scope, where translateAlgExtend reads it as a SELECT-expression
      // alias rather than an inline BIND (`projectionScope`, mirroring `registerProjection`'s
      // `c.project`); outside that scope - e.g. under CONSTRUCT, which never opens it, or inside
      // a FILTER's EXISTS - it renders as a BIND sibling and must stay deferred like FILTER
      // itself. FILTER and the multi-branch combinators (JOIN, LEFT_JOIN, MINUS, UNION) are
      // deliberately left as always-deferring: they render their input inline in the same group
      // as their own clause, so deferring past them lets sibling occurrences of the same graph
      // (e.g. a FILTER whose EXISTS sub-pattern targets the same graph as its main pattern)
      // merge into one GRAPH block instead of each wrapping itself separately.
      const isBoundary = knownOp.type === types.PROJECT || knownOp.type === types.SERVICE ||
        knownOp.type === types.GROUP || knownOp.type === types.ORDER_BY ||
        (knownOp.type === types.EXTEND && projectionScope);
      if (graphNameSet.length === 1 && !isBoundary) {
        graphs.push(operationGraphNames[graphNameSet[0]]);
      } else if (knownOp.type === types.BGP) {
        // This is the specific case that `op` got changed because of using quads. -
        return SUBRULE(splitAlgBgpToGraphs, knownOp, keyGraphs.patterns);
      } else {
        // Multiple graphs (or project), need to create graph objects for them
        for (const key of Object.keys(keyGraphs)) {
          const value = result[key];
          if (Array.isArray(value)) {
            result[key] = value.map((child, idx) =>
              // If DefaultGraph, do nothing, else wrap in plainly in Graph
              keyGraphs[key][idx].termType === 'DefaultGraph' ?
                child :
                AF.createGraph(child, keyGraphs[key][idx]));
          } else if (keyGraphs[key][0].termType !== 'DefaultGraph') {
            result[key] = AF.createGraph(value, keyGraphs[key][0]);
          }
        }
      }
    }

    return result;
  },
};

/**
 * Graphs should be an array of length identical to `op.patterns`,
 * containing the corresponding graph for each triple.
 *
 * returns Join if more than 1 pattern present, otherwise if only default graph present returns Bgp, otherwise Graph.
 */
export const splitAlgBgpToGraphs: AstIndir<
  'splitBgpToGraphs',
Algebra.Join | Algebra.Graph | Algebra.Bgp,
[Algebra.Bgp, (RDF.NamedNode | RDF.DefaultGraph)[]]
> = {
  name: 'splitBgpToGraphs',
  fun: () => ({ algebraFactory: AF }, op, graphs) => {
    // Split patterns per graph
    const graphPatterns: Record<string, { patterns: Algebra.Pattern[]; graph: RDF.NamedNode }> = {};
    for (const [ index, pattern ] of op.patterns.entries()) {
      const graph = graphs[index];
      graphPatterns[graph.value] = graphPatterns[graph.value] ?? { patterns: [], graph };
      graphPatterns[graph.value].patterns.push(pattern);
    }

    // Create graph objects for every cluster
    const children: (Algebra.Graph | Algebra.Bgp)[] = [];
    for (const [ graphName, { patterns, graph }] of Object.entries(graphPatterns)) {
      const bgp = AF.createBgp(patterns);
      // No name means DefaultGraph, otherwise wrap in graph
      children.push(graphName === '' ? bgp : AF.createGraph(bgp, graph));
    }

    // Join the graph objects
    let join: Algebra.Join | Algebra.Graph | Algebra.Bgp = children[0];
    for (const child of children.slice(1)) {
      join = AF.createJoin([ join, child ]);
    }

    return join;
  },
};
