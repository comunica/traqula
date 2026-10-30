import type * as RDF from '@rdfjs/types';
import type { IndirDefArg, TransformContext, TransformerSubTyped } from '@traqula/core';
import { forEveryNodeType } from '@traqula/core';
import type { AlgebraFactory } from '../algebraFactory.js';
import type { Algebra } from '../index.js';
import { defaultAlgebraTransformer, types } from '../toAlgebra/index.js';
import type { AstIndir } from './core.js';
import { eTypes } from './core.js';

type Graph = RDF.NamedNode | RDF.DefaultGraph | RDF.Variable;

/**
 * Identifies a graph by its term type and value, as the value alone does not tell `<>` from the default graph,
 * nor the variable `?g` from the relative IRI `<g>`.
 */
function graphKey(graph: Graph): string {
  return `${graph.termType}:${graph.value}`;
}

/**
 * Wraps an operation in a GRAPH. An expression cannot be wrapped, so the input of every EXISTS within it is wrapped.
 */
function wrapInGraph(AF: AlgebraFactory, op: Algebra.Operation, graph: Graph): object {
  if (op.type !== types.EXPRESSION) {
    return AF.createGraph(op, <RDF.NamedNode> graph);
  }
  if (op.subType === eTypes.EXISTENCE) {
    return { ...op, input: AF.createGraph(op.input, <RDF.NamedNode> graph) };
  }
  if (op.subType === eTypes.OPERATOR || op.subType === eTypes.NAMED) {
    return { ...op, args: op.args.map(arg => wrapInGraph(AF, arg, graph)) };
  }
  if (op.subType === eTypes.AGGREGATE) {
    return { ...op, expression: wrapInGraph(AF, op.expression, graph) };
  }
  return op;
}

/**
 * Whether the term mentions the variable. A SPARQL 1.1 term only does so by being the variable.
 * @param term the term to search.
 * @param variable the variable to find.
 * @return whether the variable occurs in the term.
 */
export const algTermMentionsVariable: AstIndir<'termMentionsVariable', boolean, [RDF.Term, RDF.Variable]> = {
  name: 'termMentionsVariable',
  fun: () => (_, term, variable) => term.termType === 'Variable' && term.value === variable.value,
};

/**
 * Whether the expression mentions the variable, ignoring EXISTS patterns.
 */
function mentionsVariable(
  SUBRULE: IndirDefArg['SUBRULE'],
  algebraTransformer: TransformerSubTyped<Algebra.Operation>,
  expression: Algebra.Expression,
  variable: RDF.Variable,
): boolean {
  let found = false;
  algebraTransformer.visitNodeSpecific(expression, {}, { [types.EXPRESSION]: {
    [eTypes.EXISTENCE]: { preVisitor: () => ({ continue: false }) },
    [eTypes.TERM]: { preVisitor: (term) => {
      found = SUBRULE(algTermMentionsVariable, term.term, variable);
      return { shortcut: found };
    } },
  }});
  return found;
}

/**
 * Removes quad component of triple and ...
 */
export const removeAlgQuads: AstIndir<'removeQuads', Algebra.Operation, [Algebra.Operation]> = {
  name: 'removeQuads',
  fun: ({ SUBRULE }) => (_, op) =>
    <typeof op>SUBRULE(removeAlgQuadsRecursive, op, [], false),
};

/**
 * Removes quad component of triples and wrap found bgps in Algebra.GraphOperations
 * Mainly returns same type as first arg.
 * Traverses with the algebra transformer, so its allowlist decides which keys hold operations.
 * @param graphs receives the graphs the value hands to its parent, in order of occurrence.
 * @param projectionScope whether we are directly below an EXTEND/ORDER_BY chain rooted at a
 * PROJECT/ASK/CONSTRUCT/DESCRIBE, so read as SELECT state rather than a pattern.
 */
export const removeAlgQuadsRecursive: AstIndir<
  'removeQuadsRecursive',
unknown,
[unknown, Graph[], boolean]
> = {
  name: 'removeQuadsRecursive',
  fun: ({ SUBRULE }) => (
    { algebraFactory: AF, algebraTransformer = defaultAlgebraTransformer },
    value,
    graphs,
    projectionScope,
  ) => {
    // Per transformed operation, the graphs it hands to its parent, in order of occurrence
    const graphsOfOp = new Map<object, Graph[]>();
    // The original operations directly below an EXTEND/ORDER_BY chain rooted at a query form.
    // Tracked by identity, which assumes the operations form a tree: an operation object occurring both in
    // and out of projection scope is in scope at its occurrences visited after the one in scope.
    // That only adds GRAPH boundaries, so the query keeps its meaning, but the shape depends on the order.
    const inProjectionScope = new Set<unknown>(projectionScope ? [ value ] : []);
    const noContext = {};
    const defaultGraph = AF.dataFactory.defaultGraph();

    // Puts the input of an operation in projection scope.
    const scopeInput = (orig: Algebra.Single): TransformContext => {
      inProjectionScope.add(orig.input);
      return noContext;
    };

    const opIsBoundary = (operation: Algebra.Operation, graph: Graph | undefined): boolean => {
      let result = [
        types.PROJECT,
        types.ASK,
        types.DESCRIBE,
        types.CONSTRUCT,
        types.SERVICE,
        types.GROUP,
        types.ORDER_BY,
      ].includes(operation.type);
      result ||= operation.type === types.EXTEND && inProjectionScope.has(operation);
      result ||= operation.type === types.FILTER && graph?.termType === 'Variable' &&
        mentionsVariable(SUBRULE, algebraTransformer, operation.expression, graph);
      return result;
    };

    // Removes the graph of a quad pattern or path, and registers it to its parent.
    const removeGraph = (copy: Algebra.Pattern | Algebra.Path): unknown => {
      // A pattern or path without a graph, e.g. one not built by the algebra factory, is in the default graph
      const graph = <Graph | undefined> copy.graph ?? defaultGraph;
      // Remove non-default graphs
      let result = copy;
      if (!defaultGraph.equals(graph)) {
        if (copy.type === types.PATTERN) {
          result = AF.createPattern(copy.subject, copy.predicate, copy.object);
        } else {
          result = AF.createPath(copy.subject, copy.predicate, copy.object);
        }
      }
      graphsOfOp.set(result, [ graph ]);
      return result;
    };

    // Wraps the keys of an operation that hold graphs, once its children are transformed.
    function wrapGraphsOfKeys(result: Record<string, any>, orig: Algebra.Operation): unknown {
      // Unique graphs per key
      const keyGraphs: Record<string, Graph[]> = Object.create(null);
      // For keys holding an array: the graph each element registered, if any.
      // Not every element registers one (e.g. the term `?s` in `IF(?s, EXISTS {...}, EXISTS {...})`),
      // so the graphs of a key cannot be matched with its elements by index.
      const elementGraphs: Record<string, (Graph | undefined)[]> = Object.create(null);
      // Track all the unique graph names for the entire Operation
      const operationGraphNames: Record<string, Graph> = Object.create(null);
      for (const [ key, value ] of Object.entries(result)) {
        const newGraphs: Graph[] = [];
        if (Array.isArray(value)) {
          elementGraphs[key] = value.map((element) => {
            const graphsOfElement = graphsOfOp.get(element) ?? [];
            newGraphs.push(...graphsOfElement);
            return graphsOfElement.length === 1 ? graphsOfElement[0] : undefined;
          });
        } else {
          newGraphs.push(...graphsOfOp.get(value) ?? []);
        }
        // If a graph was registered, we register the discovery we did at this key of the object
        if (newGraphs.length > 0) {
          keyGraphs[key] = newGraphs;
          for (const graph of newGraphs) {
            operationGraphNames[graphKey(graph)] = graph;
          }
        }
      }

      const graphNameSet = Object.keys(operationGraphNames);
      if (graphNameSet.length === 0) {
        return result;
      }
      // Finally, as we found graphs at some keys, wrap those keys in Algebra.graphOperations.
      // PROJECT/SERVICE/GROUP/ORDER_BY, and EXTEND in projection scope, never bracket their
      // input - they're external SELECT state, not a pattern - so the GRAPH must wrap right
      // below them, not defer further up. The same goes for the other query forms, ASK/DESCRIBE/CONSTRUCT,
      // whose WHERE clause would otherwise lose its GRAPH. FILTER and the multi-branch combinators (JOIN,
      // LEFT_JOIN, MINUS, UNION) do defer: they share a group with sibling patterns, so matching
      // graphs merge into one GRAPH block instead of each wrapping itself separately.
      // A FILTER on the graph variable is a boundary too: ?g is not bound within GRAPH ?g (18.5).
      const onlyGraph = graphNameSet.length === 1 ? operationGraphNames[graphNameSet[0]] : undefined;
      const isBoundary = opIsBoundary(orig, onlyGraph);

      if (graphNameSet.length === 1 && !isBoundary) {
        graphsOfOp.set(result, [ operationGraphNames[graphNameSet[0]] ]);
        return result;
      }

      // The graphs are wrapped here, so to the parent this is default graph content.
      // Registering nothing would let the parent pull it into the GRAPH of one of its siblings.
      if (orig.type === types.BGP) {
        // This is the specific case that `op` got changed because of using quads.
        const split = SUBRULE(splitAlgBgpToGraphs, orig, <RDF.NamedNode[]> keyGraphs.patterns);
        graphsOfOp.set(split, [ defaultGraph ]);
        return split;
      }
      // Multiple graphs (or project), need to create graph objects for them
      for (const key of Object.keys(keyGraphs)) {
        const value = result[key];
        if (Array.isArray(value)) {
          result[key] = value.map((child, idx) => {
            const graph = elementGraphs[key][idx];
            // If no graph or DefaultGraph, do nothing, else wrap in plainly in Graph
            return graph === undefined || defaultGraph.equals(graph) ? child : wrapInGraph(AF, child, graph);
          });
        } else if (!defaultGraph.equals(keyGraphs[key][0])) {
          result[key] = wrapInGraph(AF, value, keyGraphs[key][0]);
        }
      }
      if (!isBoundary) {
        graphsOfOp.set(result, [ defaultGraph ]);
      }
      return result;
    }

    // A pattern or path holds no operations with graphs
    const quadCallbacks = { preVisitor: () => ({ continue: false }), transform: removeGraph };
    const scopeCallbacks = { preVisitor: scopeInput, transform: wrapGraphsOfKeys };

    /**
     * Carries the projection scope of an EXTEND/ORDER_BY on to its input.
     * @param orig the EXTEND/ORDER_BY.
     * @return no context, so the input is traversed.
     */
    function carryScope(orig: Algebra.Extend | Algebra.OrderBy): TransformContext {
      return inProjectionScope.has(orig) ? scopeInput(orig) : noContext;
    }

    const result = algebraTransformer.transformNode<'unsafe', object>(
      <object> value,
      forEveryNodeType({ transform: wrapGraphsOfKeys }, {
        // The input of a query form is read as SELECT state, see registerProjection
        [types.PROJECT]: scopeCallbacks,
        [types.ASK]: scopeCallbacks,
        [types.DESCRIBE]: scopeCallbacks,
        [types.CONSTRUCT]: {
          // A CONSTRUCT template holds the triples to produce, not patterns of the WHERE clause:
          // it is never wrapped in a GRAPH, and does not change how the WHERE clause is wrapped.
          preVisitor: (orig: Algebra.Construct) => ({ ...scopeInput(orig), ignoreKeys: new Set([ 'template' ]) }),
          transform: wrapGraphsOfKeys,
        },
        // An EXTEND/ORDER_BY chain carries the projection scope
        [types.EXTEND]: { preVisitor: carryScope, transform: wrapGraphsOfKeys },
        [types.ORDER_BY]: { preVisitor: carryScope, transform: wrapGraphsOfKeys },
        [types.GROUP]: {
          // `translateAlgGroup` reads an EXTEND binding a group variable as a `GROUP BY (expr AS ?v)` condition
          preVisitor: (orig: Algebra.Group) => orig.input.type === types.EXTEND &&
          orig.variables.some(variable => variable.value === (<Algebra.Extend> orig.input).variable.value) ?
            scopeInput(orig) :
            noContext,
          transform: wrapGraphsOfKeys,
        },
        [types.PATTERN]: quadCallbacks,
        [types.PATH]: quadCallbacks,
        // UPDATE operations with patterns handle graphs a bit differently: they are kept as is
        [types.DELETE_INSERT]: { preVisitor: () => ({ continue: false, copy: false }) },
      }),
    );
    for (const operation of Array.isArray(result) ? result : [ result ]) {
      graphs.push(...graphsOfOp.get(operation) ?? []);
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
[Algebra.Bgp, (Graph)[]]
> = {
  name: 'splitBgpToGraphs',
  fun: () => ({ algebraFactory: AF }, op, graphs) => {
    const defaultGraph = AF.dataFactory.defaultGraph();
    // Split patterns per graph
    const graphPatterns: Record<string, { patterns: Algebra.Pattern[]; graph: RDF.NamedNode }> = Object.create(null);
    for (const [ index, pattern ] of op.patterns.entries()) {
      const graph = graphs[index];
      const key = graphKey(graph);
      graphPatterns[key] = graphPatterns[key] ?? { patterns: [], graph };
      graphPatterns[key].patterns.push(pattern);
    }

    // Create graph objects for every cluster
    const children: (Algebra.Graph | Algebra.Bgp)[] = [];
    for (const [ , { patterns, graph }] of Object.entries(graphPatterns)) {
      const bgp = AF.createBgp(patterns);
      // No name means DefaultGraph, otherwise wrap in graph
      children.push(defaultGraph.equals(graph) ? bgp : AF.createGraph(bgp, graph));
    }

    // Join the graph objects
    let join: Algebra.Join | Algebra.Graph | Algebra.Bgp = children[0];
    for (const child of children.slice(1)) {
      join = AF.createJoin([ join, child ]);
    }

    return join;
  },
};
