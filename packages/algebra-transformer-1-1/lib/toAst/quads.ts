import type * as RDF from '@rdfjs/types';
import type { Algebra } from '../index';
import { types } from '../toAlgebra/core';
import type { AstContext } from './core';

/**
 * Removes quad component of triple and ...
 * DEBUG NOTE: the type is a little wrong but works in the general case.
 */
export function removeQuads<T extends Algebra.Operation>(c: AstContext, op: T): T {
  return removeQuadsRecursive(c, op, []);
}

/**
 * Removes quad component of triples and wrap found bgps in Algebra.GraphOperations
 */
export function removeQuadsRecursive<T extends Algebra.Operation | Algebra.Operation[]>(
  c: AstContext,
  op: T,
  graphs: (RDF.NamedNode | RDF.DefaultGraph)[],
): T {
  if (Array.isArray(op)) {
    return <T> op.map(sub => removeQuadsRecursive(c, sub, graphs));
  }

  if (!op.type) {
    return op;
  }

  // UPDATE operations with Patterns handle graphs a bit differently - do not traverse
  if (op.type === types.DELETE_INSERT) {
    return op;
  }

  // If triple or path register graph and return - graphs will be populated by in order graph occurrence
  if ((op.type === types.PATTERN || op.type === types.PATH) && op.graph) {
    const graph = <RDF.NamedNode | RDF.DefaultGraph> op.graph;
    // We create a list that tracks, for each pattern the original graph and remove the graph
    graphs.push(graph);
    // Remove non-default graphs
    if (graph.value !== '') {
      return op.type === types.PATTERN ?
        <T> c.factory.createPattern(op.subject, op.predicate, op.object) :
        <T> c.factory.createPath(op.subject, op.predicate, op.object);
    }
    return op;
  }

  // We build our `op` again.
  const result: any = {};
  // Unique graphs per key (keyof T)
  const keyGraphs: Record<string, (RDF.NamedNode | RDF.DefaultGraph)[]> = {};
  // Track all the unique graph names for the entire Operation
  const operationGraphNames: Record<string, RDF.NamedNode | RDF.DefaultGraph> = {};
  for (const key of Object.keys(op)) {
    const newGraphs: (RDF.NamedNode | RDF.DefaultGraph)[] = [];
    result[key] = removeQuadsRecursive(c, op[key], newGraphs);

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
    // We also need to create graph statement if we are at the edge of certain operations
    if (graphNameSet.length === 1 && ![ types.PROJECT, types.SERVICE ].includes(op.type)) {
      graphs.push(operationGraphNames[graphNameSet[0]]);
    } else if (op.type === types.BGP) {
      // This is the specific case that `op` got changed because of using quads. - This is where the cast of T is shaky
      return <T> splitBgpToGraphs(c, op, keyGraphs.patterns);
    } else {
      // Multiple graphs (or project), need to create graph objects for them
      for (const key of Object.keys(keyGraphs)) {
        const value = result[key];
        if (Array.isArray(value)) {
          result[key] = value.map((child, idx) =>
            // If DefaultGraph, do nothing, else wrap in plainly in Graph
            keyGraphs[key][idx].termType === 'DefaultGraph' ?
              child :
              c.factory.createGraph(child, keyGraphs[key][idx]));
        } else if (keyGraphs[key][0].termType !== 'DefaultGraph') {
          result[key] = c.factory.createGraph(value, keyGraphs[key][0]);
        }
      }
    }
  }

  return result;
}

/**
 * Graphs should be an array of length identical to `op.patterns`,
 * containing the corresponding graph for each triple.
 *
 * returns Join if more than 1 pattern present, otherwise if only default graph present returns Bgp, otherwise Graph.
 */
export function splitBgpToGraphs(
  c: AstContext,
  op: Algebra.Bgp,
  graphs: (RDF.NamedNode | RDF.DefaultGraph)[],
): Algebra.Join | Algebra.Graph | Algebra.Bgp {
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
    const bgp = c.factory.createBgp(patterns);
    // No name means DefaultGraph, otherwise wrap in graph
    children.push(graphName === '' ? bgp : c.factory.createGraph(bgp, graph));
  }

  // Join the graph objects
  let join: Algebra.Join | Algebra.Graph | Algebra.Bgp = children[0];
  for (const child of children.slice(1)) {
    join = c.factory.createJoin([ join, child ]);
  }

  return join;
}
