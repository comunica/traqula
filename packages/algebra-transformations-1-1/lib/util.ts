import type * as RDF from '@rdfjs/types';
import type { TransformContext, VisitContext } from '@traqula/core';
import { TransformerSubTyped } from '@traqula/core';
import type * as A from './algebra.js';
import { ExpressionTypes, Types } from './algebra.js';

const transformer = new TransformerSubTyped<A.Operation>({}, {
  // Optimization that causes search tree pruning -- do not step into RDF.Term objects, they are outside the algebra.
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
 * Transform a single operation pre-order, the dual of {@link mapOperation}: an operation is mapped
 * _before_ its descendants, and we iterate into the result of that mapping.
 * This is what you want for an operation that has to travel deeper into the tree,
 * like a filter pushdown: the callback only describes how the filter swaps places with the operation right
 * below it, and the filters it sank into are mapped in turn.
 * e.g. sinking a filter into every branch of the unions below it:
 * ```ts
 * mapOperationPreOrder({
 *   type: Algebra.Types.FILTER,
 *   expression,
 *   input: {
 *     type: Algebra.Types.UNION,
 *     input: [{ type: Algebra.Types.BGP }, { type: Algebra.Types.BGP }],
 *   },
 * }, {
 *   [Algebra.Types.FILTER]: (filter) => {
 *     if (filter.input.type === Algebra.Types.UNION) {
 *       return { newValue: algebraFactory.createUnion(
 *         filter.input.input.map(branch => algebraFactory.createFilter(branch, filter.expression)),
 *         false,
 *       ) };
 *     }
 *     // Any other operation is a barrier for this filter
 *     return { newValue: filter };
 *   },
 * });
 * const returns = {
 *   type: Algebra.Types.UNION,
 *   input: [
 *     { type: Algebra.Types.FILTER, expression, input: { type: Algebra.Types.BGP }},
 *     { type: Algebra.Types.FILTER, expression, input: { type: Algebra.Types.BGP }},
 *   ],
 * };
 * ```
 * Contrary to {@link mapOperation}, a callback returns the value taking the place of the operation together
 * with the {@link TransformContext} of that value, so there is no separate preVisitor. The descendants of
 * the operation it is called on are not mapped yet either - they are the operations of the input tree
 * itself - so changing the properties _of a descendant_ writes straight into that tree.
 * Both are documented in detail on {@link TransformerTyped.transformNodePreOrder}.
 * @param startObject the object from which we will start the transformation,
 *   potentially visiting and transforming its descendants along the way.
 * @param nodeCallBacks a dictionary mapping the various operation types to a mapper.
 *    The mapper allows you to manipulate the copy of the current operation, and expects you to return the
 *    value that should take the current operations place, together with the context of that value.
 *    That context steers how we iterate into the returned value.
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
 * Transform a single operation pre-order, similar to {@link mapOperationPreOrder},
 * but also allowing you to target subTypes - it is to {@link mapOperationSub} what
 * {@link mapOperationPreOrder} is to {@link mapOperation}.
 * e.g. replacing every aggregate expression, and iterating into the operator expression it becomes:
 * ```ts
 * mapOperationSubPreOrder(
 *   algebraFactory.createAggregateExpression('count', inner, false),
 *   {},
 *   { [Algebra.Types.EXPRESSION]: { [Algebra.ExpressionTypes.AGGREGATE]: copy =>
 *     ({ newValue: algebraFactory.createOperatorExpression('!', [ copy.expression ]) }),
 *   }},
 * );
 * ```
 * Just like {@link mapOperationSub}, a callback registered for the subType of an operation takes
 * precedence over the one registered for its type.
 * The same caveats as on {@link mapOperationPreOrder} apply: the callback returns the value taking the
 * place of the operation together with the {@link TransformContext} of that value, and the descendants
 * it is handed are those of the input tree.
 * They are documented in detail on {@link TransformerSubTyped.transformNodeSpecificPreOrder}.
 * @param startObject the object from which we will start the transformation,
 *   potentially visiting and transforming its descendants along the way.
 * @param nodeCallBacks a dictionary mapping the various operation types to a mapper.
 *    The mapper allows you to manipulate the copy of the current operation, and expects you to return the
 *    value that should take the current operations place, together with the context of that value.
 *    That context steers how we iterate into the returned value.
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
 * Detects all [in-scope variables](https://www.w3.org/TR/sparql12-query/#variableScope).
 * In practice this means iterating through the entire algebra tree, finding all variables,
 * and stopping at every operation that hides the variables of its input:
 * - PROJECT only exposes the variables it projects.
 * - GROUP only exposes its keys and the variables its aggregates are bound to.
 * - The right-hand side of a MINUS is not in scope, only the left-hand side is.
 * - The pattern of an `(NOT) EXISTS` is not in scope
 *   ("use of a variable in FILTER or in MINUS does not cause the variable to be in-scope
 *   outside of those forms").
 * - The templates of a CONSTRUCT or a DELETE/INSERT consume solution mappings,
 *   they do not produce them, so their variables are not in scope either.
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
      [Types.CONSTRUCT]: {
        // The variables of the template are consumed, they are not in scope.
        preVisitor: () => ({ ignoreKeys: new Set([ 'template' ]) }),
      },
      [Types.DELETE_INSERT]: {
        // The variables of the templates are consumed, they are not in scope.
        preVisitor: () => ({ ignoreKeys: new Set([ 'delete', 'insert' ]) }),
      },
      [Types.EXPRESSION]: {
        // Variables only used within an expression are not in scope,
        // this includes the pattern of an (NOT) EXISTS.
        preVisitor: (op: A.Expression) =>
          op.subType === ExpressionTypes.EXISTENCE ? { continue: false } : {},
        visitor: (op: A.Expression & { variable?: RDF.Variable }) => {
          if (op.subType === ExpressionTypes.AGGREGATE && op.variable) {
            addVariable(op.variable);
          }
        },
      },
      [Types.EXTEND]: { visitor: op =>
        addVariable(op.variable),
      },
      [Types.GRAPH]: { visitor: (op) => {
        if (op.name.termType === 'Variable') {
          addVariable(op.name);
        }
      } },
      [Types.GROUP]: {
        // A group only outputs its keys and the variables its aggregates are bound to,
        // the variables of its input are not visible above it.
        preVisitor: () => ({ ignoreKeys: new Set([ 'variables', 'input' ]) }),
        visitor: (op) => {
          for (const v of op.variables) {
            addVariable(v);
          }
        },
      },
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

/**
 * Options controlling how {@link certainlyBoundVariables} decides whether a variable is certainly
 * bound.
 */
export interface BoundVariablesOptions {
  /**
   * When `true`, an EXTEND (BIND) is treated as binding its target variable, but only when the bound
   * expression is a plain term whose own variables are all certainly bound.
   *
   * This is sound: a constant term never raises an evaluation error, and a bare variable reference
   * never raises one either (it simply leaves the target unbound when its source is unbound).
   * Triple-term (quoted-triple) constructions are deliberately excluded: building one can raise an
   * evaluation error (e.g. a literal in the subject or predicate position is not a well-formed RDF
   * triple per SPARQL 1.2), so its target cannot be assumed to be bound. BINDs of arbitrary
   * (possibly erroring) expressions are always ignored.
   *
   * When `false` (the default), EXTEND is ignored entirely - matching the classic `safeVars`
   * definition of Schmidt et al. (https://arxiv.org/pdf/0812.3788, Definition 5), where a BIND may
   * raise an evaluation error and therefore leave its variable unbound.
   *
   * @defaultValue false
   */
  extendBinds?: boolean;
}

/**
 * Computes a sound under-approximation of the variables that are *certainly bound* (a.k.a. "must be
 * bound") after evaluating `op` on any dataset - i.e. the variables guaranteed to have a value in
 * every produced solution.
 *
 * This differs from {@link inScopeVariables}, which computes the (over-approximating) set of
 * *in-scope* variables that *may* be bound. Any variable that cannot be proven to be certainly
 * bound is left out, keeping the result a safe under-approximation. This is the notion required to
 * soundly push a FILTER onto a JOIN operand (SJPush of Schmidt et al.) or to rewrite a single-row
 * VALUES join into an equality FILTER.
 *
 * @param op - The operation whose certainly-bound variables are computed
 * @param options - Options tuning the approximation (see {@link BoundVariablesOptions})
 * @returns The set of certainly-bound variable names
 */
export function certainlyBoundVariables(op: A.Operation, options: BoundVariablesOptions = {}): Set<string> {
  switch (op.type) {
    case Types.BGP:
      return unionSets(op.patterns.map(pattern => patternVars(pattern)));
    case Types.PATTERN:
      return patternVars(op);
    case Types.PATH:
      return unionSets([ termVars(op.subject), termVars(op.object) ]);
    case Types.JOIN:
      return unionSets(op.input.map(input => certainlyBoundVariables(input, options)));
    case Types.UNION:
      return intersectSets(op.input.map(input => certainlyBoundVariables(input, options)));
    case Types.MINUS:
    case Types.LEFT_JOIN:
      // MINUS / OPTIONAL only certainly bind whatever their left-hand (required) side binds.
      return certainlyBoundVariables(op.input[0], options);
    case Types.PROJECT: {
      const projected = new Set(op.variables.map(variable => variable.value));
      return intersectSets([ certainlyBoundVariables(op.input, options), projected ]);
    }
    case Types.GROUP:
      return new Set(op.variables.map(variable => variable.value));
    case Types.VALUES:
      // A VALUES variable is certainly bound only if every row provides a value for it.
      return new Set(op.variables
        .filter(variable => op.bindings.every(binding => binding[variable.value] !== undefined))
        .map(variable => variable.value));
    case Types.EXTEND: {
      const inputBound = certainlyBoundVariables(op.input, options);
      if (options.extendBinds &&
        op.expression.subType === ExpressionTypes.TERM &&
        // A triple-term construction may raise an evaluation error, so it is not certainly bound.
        op.expression.term.termType !== 'Quad' &&
        isSubsetOf(termVars(op.expression.term), inputBound)) {
        inputBound.add(op.variable.value);
      }
      return inputBound;
    }
    case Types.GRAPH:
    case Types.FILTER:
    case Types.SERVICE:
    case Types.DISTINCT:
    case Types.REDUCED:
    case Types.SLICE:
    case Types.ORDER_BY:
    case Types.FROM:
      return certainlyBoundVariables((<A.Single> op).input, options);
    default:
      return new Set<string>();
  }
}

/**
 * Decides whether a single variable is *certainly bound* after evaluating `op`.
 *
 * @param op - The operation to inspect
 * @param variable - The variable (or its name) to test
 * @param options - Options tuning the approximation (see {@link BoundVariablesOptions})
 * @returns `true` when the variable is guaranteed to be bound in every produced solution
 */
export function isVariableCertainlyBound(
  op: A.Operation,
  variable: string | RDF.Variable,
  options: BoundVariablesOptions = {},
): boolean {
  const name = typeof variable === 'string' ? variable : variable.value;
  return certainlyBoundVariables(op, options).has(name);
}

/**
 * Collects the variables appearing in a single triple/quad pattern (including nested quoted triples).
 */
function patternVars(pattern: A.Pattern): Set<string> {
  return unionSets([
    termVars(pattern.subject),
    termVars(pattern.predicate),
    termVars(pattern.object),
    termVars(pattern.graph),
  ]);
}

/**
 * Collects the variables in an RDF term, recursing into quoted triples.
 */
function termVars(term: RDF.Term): Set<string> {
  if (term.termType === 'Variable') {
    return new Set([ term.value ]);
  }
  if (term.termType === 'Quad') {
    return unionSets([ termVars(term.subject), termVars(term.predicate), termVars(term.object) ]);
  }
  return new Set<string>();
}

/**
 * Tests whether every element of `subset` is contained in `superset`.
 */
function isSubsetOf(subset: Set<string>, superset: Set<string>): boolean {
  for (const value of subset) {
    if (!superset.has(value)) {
      return false;
    }
  }
  return true;
}

function unionSets(sets: Set<string>[]): Set<string> {
  const result = new Set<string>();
  for (const set of sets) {
    for (const value of set) {
      result.add(value);
    }
  }
  return result;
}

function intersectSets(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) {
    return new Set<string>();
  }
  return sets.reduce((acc, set) => new Set([ ...acc ].filter(value => set.has(value))));
}
