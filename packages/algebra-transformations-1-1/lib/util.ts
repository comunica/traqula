import type * as RDF from '@rdfjs/types';
import { TransformerType } from '@traqula/core';
import { someTermsNested } from 'rdf-terms';
import type * as A from './algebra.js';
import { KnownExpressionTypes, KnownTypes } from './algebra.js';
import { AlgebraFactory } from './algebraFactory.js';

/**
 * Flattens an array of arrays to an array.
 * @param arr - Array of arrays
 */
export function flatten<T>(arr: (T[] | T)[]): T[] {
  return (<T[][]>arr).flat().filter(Boolean);
}

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
      const baseMatch = /^(?:[a-z]+:\/*)?[^/]*/u.exec(base);
      if (!baseMatch) {
        throw new Error(`Could not determine relative IRI using base: ${base}`);
      }
      const baseRoot = baseMatch[0];
      return baseRoot + iri;
    }
    // Resolve all other IRIs at the base IRI's path
    default: {
      const basePath = base.replace(/[^/:]*$/u, '');
      return basePath + iri;
    }
  }
}

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
 * @returns {Variable[]} - List of unique in-scope variables.
 */
export function inScopeVariables(op: A.Operation): RDF.Variable[] {
  const variables: Record<string, RDF.Variable> = {};

  function addVariable(v: RDF.Variable): void {
    variables[v.value] = v;
  }

  function recurseTerm(quad: RDF.BaseQuad): void {
    if (quad.subject.termType === 'Variable') {
      addVariable(quad.subject);
    }
    if (quad.predicate.termType === 'Variable') {
      addVariable(quad.predicate);
    }
    if (quad.object.termType === 'Variable') {
      addVariable(quad.object);
    }
    if (quad.graph.termType === 'Variable') {
      addVariable(quad.graph);
    }
    if (quad.subject.termType === 'Quad') {
      recurseTerm(quad.subject);
    }
    if (quad.predicate.termType === 'Quad') {
      recurseTerm(quad.predicate);
    }
    if (quad.object.termType === 'Quad') {
      recurseTerm(quad.object);
    }
    if (quad.graph.termType === 'Quad') {
      recurseTerm(quad.graph);
    }
  }

  // https://www.w3.org/TR/sparql11-query/#variableScope
  recurseOperation(op, {
    [KnownTypes.EXPRESSION]: (op) => {
      if (op.expressionType === KnownExpressionTypes.AGGREGATE && (<any> op).variable) {
        addVariable((<any> op).variable);
      }
      return true;
    },
    [KnownTypes.EXTEND]: (op) => {
      addVariable(op.variable);
      return true;
    },
    [KnownTypes.GRAPH]: (op) => {
      if (op.name.termType === 'Variable') {
        addVariable(op.name);
      }
      return true;
    },
    [KnownTypes.GROUP]: (op) => {
      for (const v of op.variables) {
        addVariable(v);
      }
      return true;
    },
    [KnownTypes.PATH]: (op) => {
      if (op.subject.termType === 'Variable') {
        addVariable(op.subject);
      }
      if (op.object.termType === 'Variable') {
        addVariable(op.object);
      }
      if (op.graph.termType === 'Variable') {
        addVariable(op.graph);
      }
      if (op.subject.termType === 'Quad') {
        recurseTerm(op.subject);
      }
      if (op.object.termType === 'Quad') {
        recurseTerm(op.object);
      }
      if (op.graph.termType === 'Quad') {
        recurseTerm(op.graph);
      }
      return true;
    },
    [KnownTypes.PATTERN]: (op) => {
      recurseTerm(op);
      return true;
    },
    [KnownTypes.PROJECT]: (op) => {
      for (const v of op.variables) {
        addVariable(v);
      }
      return false;
    },
    [KnownTypes.SERVICE]: (op) => {
      if (op.name.termType === 'Variable') {
        addVariable(op.name);
      }
      return true;
    },
    [KnownTypes.VALUES]: (op) => {
      for (const v of op.variables) {
        addVariable(v);
      }
      return true;
    },
  });

  return Object.values(variables);
}

// TODO: can this replace recurseOperation?
export class AlgebraTransformer extends TransformerType<A.Operation> {}

/**
 * Recurses through the given algebra tree
 * A map of callback functions can be provided for individual Operation types to gather data.
 * The return value of those callbacks should indicate whether recursion should be applied or not.
 * Making modifications will change the original input object.
 * @param {Operation} op - The Operation to recurse on.
 * @param { [type: string]: (op: Operation) => boolean } callbacks - A map of required callback Operations.
 */
export function recurseOperation(
  op: A.Operation,
  callbacks: {[T in A.KnownTypes]?: (op: A.KnownTypedOperation<T>,) => boolean },
): void {
  const result: A.Operation = op;
  let doRecursion = true;

  const callback = callbacks[op.type];
  if (callback) {
    // Not sure how to get typing correct for op here
    doRecursion = callback(<any> op);
  }

  if (!doRecursion) {
    return;
  }

  const recurseOp = (op: A.Operation): void => recurseOperation(op, callbacks);

  switch (result.type) {
    case KnownTypes.ALT:
      result.input.map(recurseOp);
      break;
    case KnownTypes.ASK:
      recurseOp(result.input);
      break;
    case KnownTypes.BGP:
      for (const op1 of result.patterns) {
        recurseOp(op1);
      }
      break;
    case KnownTypes.CONSTRUCT:
      recurseOp(result.input);
      result.template.map(recurseOp);
      break;
    case KnownTypes.DESCRIBE:
      recurseOp(result.input);
      break;
    case KnownTypes.DISTINCT:
      recurseOp(result.input);
      break;
    case KnownTypes.EXPRESSION:
      if (result.expressionType === KnownExpressionTypes.EXISTENCE) {
        recurseOp(result.input);
      }
      break;
    case KnownTypes.EXTEND:
      recurseOp(result.input);
      recurseOp(result.expression);
      break;
    case KnownTypes.FILTER:
      recurseOp(result.input);
      recurseOp(result.expression);
      break;
    case KnownTypes.FROM:
      recurseOp(result.input);
      break;
    case KnownTypes.GRAPH:
      recurseOp(result.input);
      break;
    case KnownTypes.GROUP:
      recurseOp(result.input);
      for (const op1 of result.aggregates) {
        recurseOp(op1);
      }
      break;
    case KnownTypes.INV:
      recurseOp(result.path);
      break;
    case KnownTypes.JOIN:
      result.input.map(recurseOp);
      break;
    case KnownTypes.LEFT_JOIN:
      result.input.map(recurseOp);
      if (result.expression) {
        recurseOp(result.expression);
      }
      break;
    case KnownTypes.LINK:
      break;
    case KnownTypes.MINUS:
      result.input.map(recurseOp);
      break;
    case KnownTypes.NOP:
      break;
    case KnownTypes.NPS:
      break;
    case KnownTypes.ONE_OR_MORE_PATH:
      recurseOp(result.path);
      break;
    case KnownTypes.ORDER_BY:
      recurseOp(result.input);
      for (const op1 of result.expressions) {
        recurseOp(op1);
      }
      break;
    case KnownTypes.PATH:
      recurseOp(result.predicate);
      break;
    case KnownTypes.PATTERN:
      break;
    case KnownTypes.PROJECT:
      recurseOp(result.input);
      break;
    case KnownTypes.REDUCED:
      recurseOp(result.input);
      break;
    case KnownTypes.SEQ:
      result.input.map(recurseOp);
      break;
    case KnownTypes.SERVICE:
      recurseOp(result.input);
      break;
    case KnownTypes.SLICE:
      recurseOp(result.input);
      break;
    case KnownTypes.UNION:
      result.input.map(recurseOp);
      break;
    case KnownTypes.VALUES:
      break;
    case KnownTypes.ZERO_OR_MORE_PATH:
      recurseOp(result.path);
      break;
    case KnownTypes.ZERO_OR_ONE_PATH:
      recurseOp(result.path);
      break;
      // UPDATE operations
    case KnownTypes.COMPOSITE_UPDATE:
      for (const update of result.updates) {
        recurseOp(update);
      }
      break;
    case KnownTypes.DELETE_INSERT:
      if (result.delete) {
        for (const pattern of result.delete) {
          recurseOp(pattern);
        }
      }
      if (result.insert) {
        for (const pattern of result.insert) {
          recurseOp(pattern);
        }
      }
      if (result.where) {
        recurseOp(result.where);
      }
      break;
      // All of these only have graph IDs as values
    case KnownTypes.LOAD: break;
    case KnownTypes.CLEAR: break;
    case KnownTypes.CREATE: break;
    case KnownTypes.DROP: break;
    case KnownTypes.ADD: break;
    case KnownTypes.MOVE: break;
    case KnownTypes.COPY: break;
    default: throw new Error(`Unknown Operation type ${(<any> result).type}`);
  }
}

/**
 * Creates a deep copy of the given Operation.
 * Creates shallow copies of the non-Operation values.
 * A map of callback functions can be provided for individual Operation types
 * to specifically modify the given objects before triggering recursion.
 * The return value of those callbacks should indicate whether recursion should
 *   be applied to this returned object or not.
 * @param {Operation} op - The Operation to recurse on.
 * @param callbacks - A map of required callback Operations.
 * @param {AlgebraFactory} factory - Factory used to create new Operations.
 *   Will use default factory if none is provided.
 * @returns {Operation} - The copied result.
 */
export function mapOperation(
  op: A.Operation,
  callbacks: {[T in A.KnownTypes]?: (op: A.KnownTypedOperation<T>, factory: AlgebraFactory) => RecurseResult }
        & {[T in A.KnownExpressionTypes]?: (expr: A.KnownTypedExpression<T>, factory: AlgebraFactory) =>
        ExpressionRecurseResult },
  factory?: AlgebraFactory,
): A.Operation {
  let result: A.Operation = op;
  let doRecursion = true;
  let copyMetadata = true;

  factory = factory ?? new AlgebraFactory();

  const callback = callbacks[op.type];
  if (callback) {
    // Not sure how to get typing correct for op here
    const recurseResult = callback(<any> op, factory);
    result = recurseResult.result;
    doRecursion = recurseResult.recurse;
    copyMetadata = recurseResult.copyMetadata !== false;
  }

  let toCopyMetadata;
  if (copyMetadata && (result.metadata ?? op.metadata)) {
    toCopyMetadata = { ...result.metadata, ...op.metadata };
  }

  if (!doRecursion) {
    // Inherit metadata
    if (toCopyMetadata) {
      result.metadata = toCopyMetadata;
    }

    return result;
  }

  const mapOp = (op: A.Operation): A.Operation => mapOperation(op, callbacks, factory);

  // Several casts here might be wrong though depending on the callbacks output
  switch (result.type) {
    case KnownTypes.ALT:
      result = factory.createAlt(<A.PropertyPathSymbol[]> result.input.map(mapOp));
      break;
    case KnownTypes.ASK:
      result = factory.createAsk(mapOp(result.input));
      break;
    case KnownTypes.BGP:
      result = factory.createBgp(<A.Pattern[]> result.patterns.map(mapOp));
      break;
    case KnownTypes.CONSTRUCT:
      result = factory.createConstruct(mapOp(result.input), <A.Pattern[]> result.template.map(mapOp));
      break;
    case KnownTypes.DESCRIBE:
      result = factory.createDescribe(mapOp(result.input), result.terms);
      break;
    case KnownTypes.DISTINCT:
      result = factory.createDistinct(mapOp(result.input));
      break;
    case KnownTypes.EXPRESSION:
      result = mapExpression(result, callbacks, factory);
      break;
    case KnownTypes.EXTEND:
      result = factory.createExtend(mapOp(result.input), result.variable, <A.Expression> mapOp(result.expression));
      break;
    case KnownTypes.FILTER:
      result = factory.createFilter(mapOp(result.input), <A.Expression> mapOp(result.expression));
      break;
    case KnownTypes.FROM:
      result = factory.createFrom(mapOp(result.input), [ ...result.default ], [ ...result.named ]);
      break;
    case KnownTypes.GRAPH:
      result = factory.createGraph(mapOp(result.input), result.name);
      break;
    case KnownTypes.GROUP:
      result = factory.createGroup(
        mapOp(result.input),
        [ ...result.variables ],
          <A.BoundAggregate[]> result.aggregates.map(mapOp),
      );
      break;
    case KnownTypes.INV:
      result = factory.createInv(<A.PropertyPathSymbol> mapOp(result.path));
      break;
    case KnownTypes.JOIN:
      result = factory.createJoin(result.input.map(mapOp));
      break;
    case KnownTypes.LEFT_JOIN:
      result = factory.createLeftJoin(
        mapOp(result.input[0]),
        mapOp(result.input[1]),
        result.expression ? <A.Expression> mapOp(result.expression) : undefined,
      );
      break;
    case KnownTypes.LINK:
      result = factory.createLink(result.iri);
      break;
    case KnownTypes.MINUS:
      result = factory.createMinus(mapOp(result.input[0]), mapOp(result.input[1]));
      break;
    case KnownTypes.NOP:
      result = factory.createNop();
      break;
    case KnownTypes.NPS:
      result = factory.createNps([ ...result.iris ]);
      break;
    case KnownTypes.ONE_OR_MORE_PATH:
      result = factory.createOneOrMorePath(<A.PropertyPathSymbol> mapOp(result.path));
      break;
    case KnownTypes.ORDER_BY:
      result = factory.createOrderBy(mapOp(result.input), <A.Expression[]> result.expressions.map(mapOp));
      break;
    case KnownTypes.PATH:
      result = factory.createPath(
        result.subject,
<A.PropertyPathSymbol> mapOp(result.predicate),
result.object,
result.graph,
      );
      break;
    case KnownTypes.PATTERN:
      result = factory.createPattern(result.subject, result.predicate, result.object, result.graph);
      break;
    case KnownTypes.PROJECT:
      result = factory.createProject(mapOp(result.input), [ ...result.variables ]);
      break;
    case KnownTypes.REDUCED:
      result = factory.createReduced(mapOp(result.input));
      break;
    case KnownTypes.SEQ:
      result = factory.createSeq(<A.PropertyPathSymbol[]> result.input.map(mapOp));
      break;
    case KnownTypes.SERVICE:
      result = factory.createService(mapOp(result.input), result.name, result.silent);
      break;
    case KnownTypes.SLICE:
      result = factory.createSlice(mapOp(result.input), result.start, result.length);
      break;
    case KnownTypes.UNION:
      result = factory.createUnion(result.input.map(mapOp));
      break;
    case KnownTypes.VALUES:
      result = factory.createValues([ ...result.variables ], result.bindings.map(b => ({ ...b })));
      break;
    case KnownTypes.ZERO_OR_MORE_PATH:
      result = factory.createZeroOrMorePath(<A.PropertyPathSymbol> mapOp(result.path));
      break;
    case KnownTypes.ZERO_OR_ONE_PATH:
      result = factory.createZeroOrOnePath(<A.PropertyPathSymbol> mapOp(result.path));
      break;
      // UPDATE operations
    case KnownTypes.COMPOSITE_UPDATE:
      result = factory.createCompositeUpdate(<A.Update[]> result.updates.map(mapOp));
      break;
    case KnownTypes.DELETE_INSERT:
      result = factory.createDeleteInsert(
        result.delete ? <A.Pattern[]> result.delete.map(mapOp) : undefined,
        result.insert ? <A.Pattern[]> result.insert.map(mapOp) : undefined,
        result.where ? mapOp(result.where) : undefined,
      );
      break;
    case KnownTypes.LOAD:
      result = factory.createLoad(result.source, result.destination, result.silent);
      break;
    case KnownTypes.CLEAR:
      result = factory.createClear(result.source, result.silent);
      break;
    case KnownTypes.CREATE:
      result = factory.createCreate(result.source, result.silent);
      break;
    case KnownTypes.DROP:
      result = factory.createDrop(result.source, result.silent);
      break;
    case KnownTypes.ADD:
      result = factory.createAdd(result.source, result.destination);
      break;
    case KnownTypes.MOVE:
      result = factory.createMove(result.source, result.destination);
      break;
    case KnownTypes.COPY:
      result = factory.createCopy(result.source, result.destination);
      break;
    default: throw new Error(`Unknown Operation type ${(<any> result).type}`);
  }

  // Inherit metadata
  if (toCopyMetadata) {
    result.metadata = toCopyMetadata;
  }

  return result;
}

/**
 * Similar to the {@link mapOperation} function but specifically for expressions.
 * Both functions call each other while copying.
 * Should not be called directly since it does not execute the callbacks, these happen in {@link mapOperation}.
 * @param {Expression} expr - The Operation to recurse on.
 * @param callbacks - A map of required callback Operations.
 * @param {AlgebraFactory} factory -
 *   Factory used to create new Operations. Will use default factory if none is provided.
 * @returns {Operation} - The copied result.
 */
export function mapExpression(
  expr: A.Expression,
  callbacks: {[T in A.KnownTypes]?: (op: A.KnownTypedOperation<T>, factory: AlgebraFactory) => RecurseResult }
        & {[T in A.KnownExpressionTypes]?: (expr: A.KnownTypedExpression<T>, factory: AlgebraFactory) =>
        ExpressionRecurseResult },
  factory?: AlgebraFactory,
): A.Expression {
  let result: A.Expression = expr;
  let doRecursion = true;

  factory = factory ?? new AlgebraFactory();

  const callback = callbacks[expr.expressionType];
  if (callback) {
    ({ result, recurse: doRecursion } = callback(<any> expr, factory));
  }

  if (!doRecursion) {
    return result;
  }

  const mapOp = (op: A.Operation): A.Operation => mapOperation(op, callbacks, factory);

  switch (expr.expressionType) {
    case KnownExpressionTypes.AGGREGATE:
      if ((<any> expr).variable) {
        return factory.createBoundAggregate(
          (<any> expr).variable,
          expr.aggregator,
<A.Expression> mapOp(expr.expression),
expr.distinct,
expr.separator,
        );
      }
      return factory.createAggregateExpression(
        expr.aggregator,
<A.Expression> mapOp(expr.expression),
expr.distinct,
expr.separator,
      );
    case KnownExpressionTypes.EXISTENCE:
      return factory.createExistenceExpression(expr.not, mapOp(expr.input));
    case KnownExpressionTypes.NAMED:
      return factory.createNamedExpression(expr.name, <A.Expression[]> expr.args.map(mapOp));
    case KnownExpressionTypes.OPERATOR:
      return factory.createOperatorExpression(expr.operator, <A.Expression[]> expr.args.map(mapOp));
    case KnownExpressionTypes.TERM:
      return factory.createTermExpression(expr.term);
    case KnownExpressionTypes.WILDCARD:
      return factory.createWildcardExpression();
    default: throw new Error(`Unknown Expression type ${(<any> expr).expressionType}`);
  }
}

/**
 * Creates a deep clone of the operation.
 * This is syntactic sugar for calling {@link mapOperation} without callbacks.
 * @param {Operation} op - The operation to copy.
 * @returns {Operation} - The deep copy.
 */
export function cloneOperation<T extends A.Operation>(op: T): T {
  return <T> mapOperation(op, {});
}

/**
 * Creates a deep clone of the expression.
 * This is syntactic sugar for calling {@link mapExpression} without callbacks.
 * @param {Expression} expr - The operation to copy.
 * @returns {Expression} - The deep copy.
 */
export function cloneExpression<T extends A.Expression>(expr: T): T {
  return <T> mapExpression(expr, {});
}

export function createUniqueVariable(
  label: string,
  variables: Set<string>,
  dataFactory: RDF.DataFactory<RDF.BaseQuad, RDF.BaseQuad>,
): RDF.Variable {
  let counter = 0;
  let labelLoop = label;
  while (variables.has(labelLoop)) {
    labelLoop = `${label}${counter++}`;
  }
  return dataFactory.variable!(labelLoop);
}

// Separate terms from wildcard since we handle them differently
export function isSimpleTerm(term: any): term is RDF.Term {
  return term.termType !== undefined && term.termType !== 'Quad' && term.termType !== 'wildcard' &&
    term.termType !== 'Wildcard';
}

export function isQuad(term: any): term is RDF.Quad {
  return term.termType === 'Quad';
}

export function hasQuadVariables(quad: RDF.Quad): boolean {
  return someTermsNested(quad, term => term.termType === 'Variable');
}

/**
 * @interface RecurseResult
 * @property {Operation} result - The resulting A.Operation.
 * @property {boolean} recurse - Whether to continue with recursion.
 * @property {boolean} copyMetadata - If the metadata object should be copied. Defaults to true.
 */
export interface RecurseResult {
  result: A.Operation;
  recurse: boolean;
  copyMetadata?: boolean;
}

/**
 * @interface ExpressionRecurseResult
 * @property {Expression} result - The resulting A.Expression.
 * @property {boolean} recurse - Whether to continue with recursion.
 * @property {boolean} copyMetadata - If the metadata object should be copied. Defaults to true.
 */
export interface ExpressionRecurseResult {
  result: A.Expression;
  recurse: boolean;
  copyMetadata?: boolean;
}
