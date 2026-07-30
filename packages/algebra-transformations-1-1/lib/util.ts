import type * as RDF from '@rdfjs/types';
import type { TransformContext, VisitContext } from '@traqula/core';
import { TransformerSubTyped } from '@traqula/core';
import type * as A from './algebra.js';
import { ExpressionTypes, Types } from './algebra.js';

const transformer = new TransformerSubTyped<A.Operation>({}, {
  // Optimization that causes search tree pruning
  [Types.PATTERN]: { ignoreKeys: new Set([ 'subject', 'predicate', 'object', 'graph' ]) } satisfies TransformContext,
  [Types.EXPRESSION]: { ignoreKeys: new Set([ 'name', 'term', 'wildcard', 'variable' ]) } satisfies VisitContext,
  [Types.DESCRIBE]: { ignoreKeys: new Set([ 'terms' ]) },
  [Types.EXTEND]: { ignoreKeys: new Set([ 'variable' ]) },
  [Types.FROM]: { ignoreKeys: new Set([ 'default', 'named' ]) },
  [Types.GRAPH]: { ignoreKeys: new Set([ 'name' ]) },
  [Types.GROUP]: { ignoreKeys: new Set([ 'variables' ]) },
  [Types.LINK]: { ignoreKeys: new Set([ 'iri' ]) },
  [Types.NPS]: { ignoreKeys: new Set([ 'iris' ]) },
  [Types.PATH]: { ignoreKeys: new Set([ 'subject', 'object', 'graph' ]) },
  [Types.PROJECT]: { ignoreKeys: new Set([ 'variables' ]) },
  [Types.SERVICE]: { ignoreKeys: new Set([ 'name' ]) },
  [Types.VALUES]: { ignoreKeys: new Set([ 'variables', 'bindings' ]) },
  [Types.LOAD]: { ignoreKeys: new Set([ 'source', 'destination' ]) },
  [Types.CLEAR]: { ignoreKeys: new Set([ 'source' ]) },
  [Types.CREATE]: { ignoreKeys: new Set([ 'source' ]) },
  [Types.DROP]: { ignoreKeys: new Set([ 'source' ]) },
  [Types.ADD]: { ignoreKeys: new Set([ 'source', 'destination' ]) },
  [Types.MOVE]: { ignoreKeys: new Set([ 'source', 'destination' ]) },
  [Types.COPY]: { ignoreKeys: new Set([ 'source', 'destination' ]) },
});

/**
 * Transform a single operation.
 * e.g. wrapping a distinct around the outermost project:
 * ```ts
 * mapOperation({
 *   type: Algebra.Types.SLICE,
 *   input: {
 *     type: Algebra.Types.PROJECT,
 *     input: {
 *       type: Algebra.Types.JOIN,
 *       input: [{ type: Algebra.Types.PROJECT }, { type: Algebra.Types.BGP }],
 *     },
 *   },
 * }, {
 *   [Algebra.Types.PROJECT]: {
 *     preVisitor: () => ({ continue: false }),
 *     transform: projection => algebraFactory.createDistinct(projection),
 *   },
 * });
 * const returns = {
 *   type: Algebra.Types.SLICE,
 *   input: {
 *     type: Algebra.Types.DISTINCT,
 *     input: {
 *       type: Algebra.Types.PROJECT,
 *       input: {
 *         type: Algebra.Types.JOIN,
 *         input: [{ type: Algebra.Types.PROJECT }, { type: Algebra.Types.BGP }],
 *       },
 *     },
 *   },
 * };
 * ```
 * @param startObject the object from which we will start the transformation,
 *   potentially visiting and transforming its descendants along the way.
 * @param nodeCallBacks a dictionary mapping the various operation types to objects optionally
 *    containing preVisitor and transformer.
 *    The preVisitor allows you to provide {@link TransformContext} for the current object,
 *    altering how it will be transformed.
 *    The transformer allows you to manipulate the copy of the current object,
 *    and expects you to return the value that should take the current objects place.
 * @return the result of transforming the requested descendant operations (based on the preVisitor)
 * using a transformer that works its way back up from the descendant to the startObject.
 */
export const mapOperation = transformer.transformNode.bind(transformer);

/**
 * Transform a single operation pre-order, the dual of {@link mapOperation}.
 * Transforms an operation _before_ its descendants, and iterates into the result of that transformation.
 *
 * This is what you want when an operation has to travel deeper into the tree, like a filter pushdown:
 * a callback only has to describe how an operation swaps places with the operation right below it,
 * the copy it sank into is transformed in turn, and swaps places with the operation below that one.
 * ```ts
 * mapOperationPreOrder(query, {
 *   [Algebra.Types.FILTER]: (filter) => {
 *     // Sink the filter into every branch of a union - all of them keep sinking on their own.
 *     if (filter.input.type === Algebra.Types.UNION) {
 *       return { newValue: algebraFactory.createUnion(
 *         filter.input.input.map(branch => algebraFactory.createFilter(branch, filter.expression)),
 *       ) };
 *     }
 *     // Anything else is a barrier: returning the copy untouched stops the descent of this filter.
 *     return { newValue: filter };
 *   },
 * });
 * ```
 * Contrary to {@link mapOperation}, a callback does not just return the value taking the place of the
 * operation, it returns a {@link PreOrderMapping}: that value, plus the {@link TransformContext} of that
 * value. Since the callback decides what we iterate into, it is the one telling us how to iterate into it,
 * so there is no separate preVisitor.
 *
 * An operation that is the result of a rewrite is transformed once. Rules rewriting an operation into an
 * operation taking the exact same place - like a rule merging two nested filters - additionally need
 * {@link TransformContext.reTransform}, making the transform be applied until the operation stabilizes.
 *
 * Also contrary to {@link mapOperation}, the descendants of the operation given to the callback are not
 * transformed yet: they are the operations of the input tree itself. You are free to replace the operation,
 * to reuse its descendants in the operation you return, and to change the own properties of the copy you got,
 * but changing the properties _of a descendant_ writes straight into the input tree.
 * @param startObject the object from which we will start the transformation,
 *   potentially visiting and transforming its descendants along the way.
 * @param nodeCallBacks a dictionary mapping the various operation types to a mapper.
 *    The mapper allows you to manipulate the copy of the current operation, and expects you to return the
 *    value that should take the current operations place, together with the context of that value.
 *    The returned value is dispatched again, and is what we iterate into.
 * @return the result of transforming the startObject and the descendants of its rewrites.
 */
export const mapOperationPreOrder = transformer.transformNodePreOrder.bind(transformer);

/**
 * Transform a single operation, similar to {@link mapOperation}, but also allowing you to target subTypes.
 * e.g. wrapping a distinct around the all project operations not contained in an aggregate expression
 * (invalid algebra anyway):
 * ```ts
 * mapOperationSub({
 *   type: Algebra.Types.SLICE,
 *   input: {
 *     type: Algebra.Types.PROJECT,
 *     input: {
 *       type: Algebra.Types.JOIN,
 *       input: [{
 *         type: Algebra.Types.EXPRESSION,
 *         subType: Algebra.ExpressionTypes.AGGREGATE,
 *         input: { type: Algebra.Types.PROJECT },
 *       }, { type: Algebra.Types.BGP }],
 *     },
 *   },
 * }, { [Algebra.Types.PROJECT]: {
 *   transform: projection => algebraFactory.createDistinct(projection),
 * }}, { [Algebra.Types.EXPRESSION]: { [Algebra.ExpressionTypes.AGGREGATE]: {
 *   preVisitor: () => ({ continue: false }),
 * }}});
 * const returns = {
 *   type: Algebra.Types.SLICE,
 *   input: {
 *     type: Algebra.Types.DISTINCT,
 *     input: {
 *       type: Algebra.Types.PROJECT,
 *       input: {
 *         type: Algebra.Types.JOIN,
 *         input: [{
 *           type: Algebra.Types.EXPRESSION,
 *           subType: Algebra.ExpressionTypes.AGGREGATE,
 *           input: { type: Algebra.Types.PROJECT },
 *         }, { type: Algebra.Types.BGP }],
 *       },
 *     },
 *   },
 * };
 * ```
 * @param startObject the object from which we will start the transformation,
 *   potentially visiting and transforming its descendants along the way.
 * @param nodeCallBacks a dictionary mapping the various operation types to objects optionally
 *    containing preVisitor and transformer.
 *    The preVisitor allows you to provide {@link TransformContext} for the current object,
 *    altering how it will be transformed.
 *    The transformer allows you to manipulate the copy of the current object,
 *    and expects you to return the value that should take the current objects place.
 * @param nodeSpecificCallBacks Same as nodeCallBacks but using an additional level of indirection to
 *     indicate the subType.
 * @return the result of transforming the requested descendant operations (based on the preVisitor)
 * using a transformer that works its way back up from the descendant to the startObject.
 */
export const mapOperationSub = transformer.transformNodeSpecific.bind(transformer);

/**
 * Transform a single operation pre-order, the dual of {@link mapOperationSub}.
 * Similar to {@link mapOperationPreOrder}, but also allowing you to target subTypes.
 * The operation is transformed _before_ its descendants, and we iterate into the result of that
 * transformation, making it the tool of choice for operations that have to travel deeper into the tree,
 * like a filter pushdown.
 *
 * Contrary to {@link mapOperationSub}, the descendants of the operation given to the callback are not
 * transformed yet: they are the operations of the input tree itself, so changing the properties
 * _of a descendant_ writes straight into the input tree.
 * Documented in detail on {@link mapOperationPreOrder}.
 * @param startObject the object from which we will start the transformation,
 *   potentially visiting and transforming its descendants along the way.
 * @param nodeCallBacks a dictionary mapping the various operation types to a mapper.
 *    The mapper allows you to manipulate the copy of the current operation, and expects you to return the
 *    value that should take the current operations place, together with the context of that value.
 *    The returned value is dispatched again, and is what we iterate into.
 * @param nodeSpecificCallBacks Same as nodeCallBacks but using an additional level of indirection to
 *     indicate the subType.
 * @return the result of transforming the startObject and the descendants of its rewrites.
 */
export const mapOperationSubPreOrder = transformer.transformNodeSpecificPreOrder.bind(transformer);

/**
 * Similar to {@link mapOperation}, but only visiting instead of copying and transforming explicitly.
 * e.g.:
 * ```ts
 * visitOperation({
 *   type: Algebra.Types.DISTINCT,
 *   input: {
 *     type: Algebra.Types.PROJECT,
 *     input: { type: Algebra.Types.DISTINCT },
 *   },
 * }, {
 *   [Algebra.Types.DISTINCT]: { visitor: () => console.log('1') },
 *   [Algebra.Types.PROJECT]: {
 *     preVisitor: () => ({ continue: false }),
 *     visitor: () => console.log('2'),
 *   },
 * });
 * ```
 * Will first call the preVisitor on the project and notice it should not iterate on its descendants.
 * It then visits the project, and the outermost distinct, printing '21'.
 * The pre-visitor visits starting from the root, going deeper, while the actual visitor goes in reverse.
 * @param startObject the object from which we will start visiting,
 *   potentially visiting its descendants along the way.
 * @param nodeCallBacks a dictionary mapping the various operation types to objects optionally
 *    containing preVisitor and visitor.
 *    The preVisitor allows you to provide {@link VisitContext} for the current object,
 *    altering how it will be visited.
 *    The visitor allows you to visit the object from deepest to the outermost object.
 *    This is useful if you for example want to manipulate the objects you visit during your visits,
 *    similar to {@link mapOperation}.
 */
export const visitOperation = transformer.visitNode.bind(transformer);

/**
 * Visits an object and it's descendants, similar to {@link visitOperation},
 * but also allowing you to target subTypes. e.g.:
 * e.g.:
 * ```ts
 * visitOperationSub({
 *   type: Algebra.Types.DISTINCT,
 *   input: {
 *     type: Algebra.Types.DISTINCT,
 *     subType: 'special',
 *   },
 * }, {
 *   [Algebra.Types.DISTINCT]: {
 *     visitor: () => console.log('1'),
 *     preVisitor: () => {
 *       console.log('2');
 *       return {};
 *     },
 *   },
 * }, {
 *   [Algebra.Types.DISTINCT]: { special: {
 *     visitor: () => console.log('3'),
 *   }},
 * });
 * ```
 * Will call the preVisitor on the outer distinct, then the visitor of the special distinct,
 * followed by the visiting the outer distinct, printing '231'.
 * The pre-visitor visits starting from the root, going deeper, while the actual visitor goes in reverse.
 * @param startObject the object from which we will start visiting,
 *   potentially visiting its descendants along the way.
 * @param nodeCallBacks a dictionary mapping the various operation types to objects optionally
 *    containing preVisitor and visitor.
 *    The preVisitor allows you to provide {@link VisitContext} for the current object,
 *    altering how it will be visited.
 *    The visitor allows you to visit the object from deepest to the outermost object.
 *    This is useful if you for example want to manipulate the objects you visit during your visits,
 *    similar to {@link mapOperation}.
 * @param nodeSpecificCallBacks Same as nodeCallBacks but using an additional level of indirection to
 *     indicate the subType.
 */
export const visitOperationSub = transformer.visitNodeSpecific.bind(transformer);

/**
 * Resolves an IRI against a base path in accordance to the [Syntax for IRIs](https://www.w3.org/TR/sparql11-query/#QSynIRI)
 */
export function resolveIRI(iri: string, base: string | undefined): string {
  // Return absolute IRIs unmodified
  if (/^[a-z][\d+.a-z-]*:/iu.test(iri)) {
    return iri;
  }
  if (!base) {
    throw new Error(`Cannot resolve relative IRI ${iri} because no base IRI was set.`);
  }
  switch (iri[0]) {
    // An empty relative IRI indicates the base IRI
    case undefined:
      return base;
      // Resolve relative fragment IRIs against the base IRI
    case '#':
      return base + iri;
      // Resolve relative query string IRIs by replacing the query string
    case '?':
      return base.replace(/(?:\?.*)?$/u, iri);
      // Resolve root relative IRIs at the root of the base IRI
    case '/': {
      // Since the empty string natches, this always matches something.
      const baseRoot = /^(?:[a-z]+:\/*)?[^/]*/u.exec(base)![0];
      return baseRoot + iri;
    }
    // Resolve all other IRIs at the base IRI's path
    default: {
      // Const lastSemi = base.lastIndexOf(':');
      // const lastSlash = base.lastIndexOf('/');
      // let basePath;
      // if (lastSlash === -1 && lastSemi === -1) {
      //   basePath = '';
      // } else if (lastSlash > lastSemi) {
      //   basePath = base.slice(0, lastSlash);
      // } else {
      //   basePath = base.slice(0, lastSemi);
      // }
      const basePath = base.replace(/[^/:]*$/u, '');
      return basePath + iri;
    }
  }
}

// TODO: find a cleaner way
/**
 * Outputs a JSON object corresponding to the input algebra-like.
 */
export function objectify(algebra: any): any {
  if (algebra.termType) {
    if (algebra.termType === 'Quad') {
      return {
        type: 'pattern',
        termType: 'Quad',
        subject: objectify(algebra.subject),
        predicate: objectify(algebra.predicate),
        object: objectify(algebra.object),
        graph: objectify(algebra.graph),
      };
    }
    const result: any = { termType: algebra.termType, value: algebra.value };
    if (algebra.language) {
      result.language = algebra.language;
    }
    if (algebra.datatype) {
      result.datatype = objectify(algebra.datatype);
    }
    return result;
  }
  if (Array.isArray(algebra)) {
    return algebra.map(e => objectify(e));
  }
  if (algebra === Object(algebra)) {
    const result: any = {};
    for (const key of Object.keys(algebra)) {
      result[key] = objectify(algebra[key]);
    }
    return result;
  }
  return algebra;
}

/**
 * Detects all in-scope variables.
 * In practice this means iterating through the entire algebra tree, finding all variables,
 * and stopping when a project function is found.
 * @param {Operation} op - Input algebra tree.
 * @param visitor the visitor to be used to traverse the various nodes.
 * Allows you to provide a visitor with different default preVisitor cotexts.
 * @returns {RDF.Variable[]} - List of unique in-scope variables.
 */
export function inScopeVariables(
  op: A.BaseOperation,
  visitor: typeof visitOperation = visitOperation,
): RDF.Variable[] {
  const variables: Record<string, RDF.Variable> = {};

  function addVariable(v: RDF.Variable): void {
    variables[v.value] = v;
  }

  function recurseTerm(quad: RDF.BaseQuad): void {
    // Subject
    if (quad.subject.termType === 'Variable') {
      addVariable(quad.subject);
    } else if (quad.subject.termType === 'Quad') {
      recurseTerm(quad.subject);
    }
    // Predicate
    if (quad.predicate.termType === 'Variable') {
      addVariable(quad.predicate);
    } else if (quad.predicate.termType === 'Quad') {
      recurseTerm(quad.predicate);
    }
    // Object
    if (quad.object.termType === 'Variable') {
      addVariable(quad.object);
    } else if (quad.object.termType === 'Quad') {
      recurseTerm(quad.object);
    }

    // Graph
    if (quad.graph.termType === 'Variable') {
      addVariable(quad.graph);
    }
    if (quad.graph.termType === 'Quad') {
      recurseTerm(quad.graph);
    }
  }

  function visitingRecursion(curOp: A.BaseOperation): void {
    // https://www.w3.org/TR/sparql11-query/#variableScope
    visitor(curOp, {
      [Types.EXPRESSION]: { visitor: (op: A.Expression & { variable?: RDF.Variable }) => {
        if (op.subType === ExpressionTypes.AGGREGATE && (op).variable) {
          addVariable((op).variable);
        }
      } },
      [Types.EXTEND]: { visitor: op =>
        addVariable(op.variable),
      },
      [Types.GRAPH]: { visitor: (op) => {
        if (op.name.termType === 'Variable') {
          addVariable(op.name);
        }
      } },
      [Types.GROUP]: { visitor: (op) => {
        for (const v of op.variables) {
          addVariable(v);
        }
      } },
      [Types.PATH]: { visitor: (op) => {
        // Subject
        if (op.subject.termType === 'Variable') {
          addVariable(op.subject);
        } else if (op.subject.termType === 'Quad') {
          recurseTerm(op.subject);
        }
        // Predicate
        if (op.object.termType === 'Variable') {
          addVariable(op.object);
        } else if (op.object.termType === 'Quad') {
          recurseTerm(op.object);
        }
        // Object
        if (op.graph.termType === 'Variable') {
          addVariable(op.graph);
        } else if (op.graph.termType === 'Quad') {
          recurseTerm(op.graph);
        }
      } },
      [Types.PATTERN]: { visitor: op => recurseTerm(op) },
      [Types.PROJECT]: {
        preVisitor: () => ({ continue: false }),
        visitor: (op) => {
          for (const v of op.variables) {
            addVariable(v);
          }
        },
      },
      [Types.SERVICE]: { visitor: (op) => {
        if (op.name.termType === 'Variable') {
          addVariable(op.name);
        }
      } },
      [Types.VALUES]: { visitor: (op) => {
        for (const v of op.variables) {
          addVariable(v);
        }
      } },
      [Types.MINUS]: {
        preVisitor: () => ({ continue: false }),
        visitor: (op) => {
          // Cannot fully visit, only the left hand side is scoped
          visitingRecursion(op.input[0]);
        },
      },
    });
  }
  visitingRecursion(op);

  return Object.values(variables);
}
