import type * as RDF from '@rdfjs/types';
import { TransformerSubType } from '@traqula/core';
import { someTermsNested } from 'rdf-terms';
import type * as A from './algebra.js';
import { ExpressionTypes, PropertyPathSymbolTypes, Types, UpdateTypes } from './algebra.js';
import { AlgebraFactory } from './algebraFactory.js';
import type * as OpenAlgebra from './openAlgebra.js';
import { asKnown } from './openAlgebra.js';

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
export function inScopeVariables(op: OpenAlgebra.Operation): RDF.Variable[] {
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
    [Types.EXPRESSION]: (op) => {
      if (op.subType === ExpressionTypes.AGGREGATE && (<any> op).variable) {
        addVariable((<any> op).variable);
      }
      return true;
    },
    [Types.EXTEND]: (op) => {
      addVariable(op.variable);
      return true;
    },
    [Types.GRAPH]: (op) => {
      if (op.name.termType === 'Variable') {
        addVariable(op.name);
      }
      return true;
    },
    [Types.GROUP]: (op) => {
      for (const v of op.variables) {
        addVariable(v);
      }
      return true;
    },
    [Types.PATH]: (op) => {
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
    [Types.PATTERN]: (op) => {
      recurseTerm(op);
      return true;
    },
    [Types.PROJECT]: (op) => {
      for (const v of op.variables) {
        addVariable(v);
      }
      return false;
    },
    [Types.SERVICE]: (op) => {
      if (op.name.termType === 'Variable') {
        addVariable(op.name);
      }
      return true;
    },
    [Types.VALUES]: (op) => {
      for (const v of op.variables) {
        addVariable(v);
      }
      return true;
    },
  });

  return Object.values(variables);
}

// TODO: can this replace recurseOperation?
export class KnownAlgebraTransformer extends TransformerSubType<A.Operation> {}
export class AlgebraTransformer extends TransformerSubType<OpenAlgebra.SemiOperation> {}

/**
 * Recurses through the given algebra tree
 * A map of callback functions can be provided for individual Operation types to gather data.
 * The return value of those callbacks should indicate whether recursion should be applied or not.
 * Making modifications will change the original input object.
 * @param {Operation} op - The Operation to recurse on.
 * @param { [type: string]: (op: Operation) => boolean } callbacks - A map of required callback Operations.
 */
export function recurseOperation(
  op: OpenAlgebra.Operation,
  callbacks: {[T in A.Types]?: T extends A.Types ? (op: OpenAlgebra.TypedOperation<T>) => boolean :
      (op: OpenAlgebra.BaseOperation) => boolean },
): void {
  const result = asKnown(op);
  let doRecursion = true;

  const callback = callbacks[result.type];
  if (callback) {
    // Not sure how to get typing correct for op here
    doRecursion = callback(<any> op);
  }

  if (!doRecursion) {
    return;
  }

  const recurseOp = (op: OpenAlgebra.Operation): void => recurseOperation(op, callbacks);

  switch (result.type) {
    case Types.ASK:
      recurseOp(result.input);
      break;
    case Types.BGP:
      for (const op1 of result.patterns) {
        recurseOp(op1);
      }
      break;
    case Types.CONSTRUCT:
      recurseOp(result.input);
      result.template.map(recurseOp);
      break;
    case Types.DESCRIBE:
      recurseOp(result.input);
      break;
    case Types.DISTINCT:
      recurseOp(result.input);
      break;
    case Types.EXPRESSION:
      if (result.subType === ExpressionTypes.EXISTENCE) {
        recurseOp(result.input);
      }
      break;
    case Types.EXTEND:
      recurseOp(result.input);
      recurseOp(result.expression);
      break;
    case Types.FILTER:
      recurseOp(result.input);
      recurseOp(result.expression);
      break;
    case Types.FROM:
      recurseOp(result.input);
      break;
    case Types.GRAPH:
      recurseOp(result.input);
      break;
    case Types.GROUP:
      recurseOp(result.input);
      for (const op1 of result.aggregates) {
        recurseOp(op1);
      }
      break;
    case Types.PROPERTY_PATH_SYMBOL: {
      switch (result.subType) {
        case PropertyPathSymbolTypes.ALT:
          result.input.map(recurseOp);
          break;
        case PropertyPathSymbolTypes.INV:
          recurseOp(result.path);
          break;
        case PropertyPathSymbolTypes.LINK:
          break;
        case PropertyPathSymbolTypes.NPS:
          break;
        case PropertyPathSymbolTypes.ONE_OR_MORE_PATH:
          recurseOp(result.path);
          break;
        case PropertyPathSymbolTypes.SEQ:
          result.input.map(recurseOp);
          break;
        case PropertyPathSymbolTypes.ZERO_OR_MORE_PATH:
          recurseOp(result.path);
          break;
        case PropertyPathSymbolTypes.ZERO_OR_ONE_PATH:
          recurseOp(result.path);
          break;
      }
      break;
    }
    case Types.JOIN:
      result.input.map(recurseOp);
      break;
    case Types.LEFT_JOIN:
      result.input.map(recurseOp);
      if (result.expression) {
        recurseOp(result.expression);
      }
      break;
    case Types.MINUS:
      result.input.map(recurseOp);
      break;
    case Types.NOP:
      break;
    case Types.ORDER_BY:
      recurseOp(result.input);
      for (const op1 of result.expressions) {
        recurseOp(op1);
      }
      break;
    case Types.PATH:
      recurseOp(result.predicate);
      break;
    case Types.PATTERN:
      break;
    case Types.PROJECT:
      recurseOp(result.input);
      break;
    case Types.REDUCED:
      recurseOp(result.input);
      break;
    case Types.SERVICE:
      recurseOp(result.input);
      break;
    case Types.SLICE:
      recurseOp(result.input);
      break;
    case Types.UNION:
      result.input.map(recurseOp);
      break;
    case Types.VALUES:
      break;
      // UPDATE operations
    case Types.COMPOSITE_UPDATE:
      for (const update of result.updates) {
        recurseOp(update);
      }
      break;
    case Types.UPDATE: {
      switch (result.subType) {
        case UpdateTypes.DELETE_INSERT:
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
        case UpdateTypes.LOAD: break;
        case UpdateTypes.CLEAR: break;
        case UpdateTypes.CREATE: break;
        case UpdateTypes.DROP: break;
        case UpdateTypes.ADD: break;
        case UpdateTypes.MOVE: break;
        case UpdateTypes.COPY: break;
      }
      break;
    }
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
  op: OpenAlgebra.Operation,
  callbacks: {[T in A.Types]?: (op: OpenAlgebra.TypedOperation<T>, factory: AlgebraFactory) => RecurseResult }
        & {[T in A.ExpressionTypes]?: (expr: OpenAlgebra.TypedExpression<T>, factory: AlgebraFactory) =>
        ExpressionRecurseResult },
  factory?: AlgebraFactory,
): OpenAlgebra.Operation {
  const known = asKnown(op);
  let result = op;
  let doRecursion = true;
  let copyMetadata = true;

  factory = factory ?? new AlgebraFactory();

  const callback = callbacks[known.type];
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

  const mapOp = (op: OpenAlgebra.Operation): A.Operation => asKnown(mapOperation(op, callbacks, factory));

  const knownResult = asKnown(result);
  // Several casts here might be wrong though depending on the callbacks output
  switch (knownResult.type) {
    case Types.ASK:
      result = factory.createAsk(mapOp(knownResult.input));
      break;
    case Types.BGP:
      result = factory.createBgp(<A.Pattern[]> knownResult.patterns.map(mapOp));
      break;
    case Types.CONSTRUCT:
      result = factory.createConstruct(mapOp(knownResult.input), <A.Pattern[]> knownResult.template.map(mapOp));
      break;
    case Types.DESCRIBE:
      result = factory.createDescribe(mapOp(knownResult.input), knownResult.terms);
      break;
    case Types.DISTINCT:
      result = factory.createDistinct(mapOp(knownResult.input));
      break;
    case Types.EXPRESSION:
      result = mapExpression(knownResult, callbacks, factory);
      break;
    case Types.EXTEND:
      result = factory.createExtend(
        mapOp(knownResult.input),
        knownResult.variable,
<A.Expression> mapOp(knownResult.expression),
      );
      break;
    case Types.FILTER:
      result = factory.createFilter(mapOp(knownResult.input), <A.Expression> mapOp(knownResult.expression));
      break;
    case Types.FROM:
      result = factory.createFrom(mapOp(knownResult.input), [ ...knownResult.default ], [ ...knownResult.named ]);
      break;
    case Types.GRAPH:
      result = factory.createGraph(mapOp(knownResult.input), knownResult.name);
      break;
    case Types.GROUP:
      result = factory.createGroup(
        mapOp(knownResult.input),
        [ ...knownResult.variables ],
          <A.BoundAggregate[]> knownResult.aggregates.map(mapOp),
      );
      break;
    case Types.PROPERTY_PATH_SYMBOL: {
      switch (knownResult.subType) {
        case PropertyPathSymbolTypes.ALT:
          result = factory.createAlt(<A.PropertyPathSymbol[]> knownResult.input.map(mapOp));
          break;
        case PropertyPathSymbolTypes.INV:
          result = factory.createInv(<A.PropertyPathSymbol> mapOp(knownResult.path));
          break;
        case PropertyPathSymbolTypes.LINK:
          result = factory.createLink(knownResult.iri);
          break;
        case PropertyPathSymbolTypes.NPS:
          result = factory.createNps([ ...knownResult.iris ]);
          break;
        case PropertyPathSymbolTypes.ONE_OR_MORE_PATH:
          result = factory.createOneOrMorePath(<A.PropertyPathSymbol> mapOp(knownResult.path));
          break;
        case PropertyPathSymbolTypes.SEQ:
          result = factory.createSeq(<A.PropertyPathSymbol[]> knownResult.input.map(mapOp));
          break;
        case PropertyPathSymbolTypes.ZERO_OR_MORE_PATH:
          result = factory.createZeroOrMorePath(<A.PropertyPathSymbol> mapOp(knownResult.path));
          break;
        case PropertyPathSymbolTypes.ZERO_OR_ONE_PATH:
          result = factory.createZeroOrOnePath(<A.PropertyPathSymbol> mapOp(knownResult.path));
          break;
      }
      break;
    }
    case Types.JOIN:
      result = factory.createJoin(knownResult.input.map(mapOp));
      break;
    case Types.LEFT_JOIN:
      result = factory.createLeftJoin(
        mapOp(knownResult.input[0]),
        mapOp(knownResult.input[1]),
        knownResult.expression ? <A.Expression> mapOp(knownResult.expression) : undefined,
      );
      break;

    case Types.MINUS:
      result = factory.createMinus(mapOp(knownResult.input[0]), mapOp(knownResult.input[1]));
      break;
    case Types.NOP:
      result = factory.createNop();
      break;

    case Types.ORDER_BY:
      result = factory.createOrderBy(mapOp(knownResult.input), <A.Expression[]> knownResult.expressions.map(mapOp));
      break;
    case Types.PATH:
      result = factory.createPath(
        knownResult.subject,
<A.PropertyPathSymbol> mapOp(knownResult.predicate),
knownResult.object,
knownResult.graph,
      );
      break;
    case Types.PATTERN:
      result = factory.createPattern(knownResult.subject, knownResult.predicate, knownResult.object, knownResult.graph);
      break;
    case Types.PROJECT:
      result = factory.createProject(mapOp(knownResult.input), [ ...knownResult.variables ]);
      break;
    case Types.REDUCED:
      result = factory.createReduced(mapOp(knownResult.input));
      break;
    case Types.SERVICE:
      result = factory.createService(mapOp(knownResult.input), knownResult.name, knownResult.silent);
      break;
    case Types.SLICE:
      result = factory.createSlice(mapOp(knownResult.input), knownResult.start, knownResult.length);
      break;
    case Types.UNION:
      result = factory.createUnion(knownResult.input.map(mapOp));
      break;
    case Types.VALUES:
      result = factory.createValues([ ...knownResult.variables ], knownResult.bindings.map(b => ({ ...b })));
      break;
    // UPDATE operations
    case Types.COMPOSITE_UPDATE:
      result = factory.createCompositeUpdate(<A.Update[]> knownResult.updates.map(mapOp));
      break;
    case Types.UPDATE: {
      switch (knownResult.subType) {
        case UpdateTypes.DELETE_INSERT:
          result = factory.createDeleteInsert(
            knownResult.delete ? <A.Pattern[]> knownResult.delete.map(mapOp) : undefined,
            knownResult.insert ? <A.Pattern[]> knownResult.insert.map(mapOp) : undefined,
            knownResult.where ? mapOp(knownResult.where) : undefined,
          );
          break;
        case UpdateTypes.LOAD:
          result = factory.createLoad(knownResult.source, knownResult.destination, knownResult.silent);
          break;
        case UpdateTypes.CLEAR:
          result = factory.createClear(knownResult.source, knownResult.silent);
          break;
        case UpdateTypes.CREATE:
          result = factory.createCreate(knownResult.source, knownResult.silent);
          break;
        case UpdateTypes.DROP:
          result = factory.createDrop(knownResult.source, knownResult.silent);
          break;
        case UpdateTypes.ADD:
          result = factory.createAdd(knownResult.source, knownResult.destination);
          break;
        case UpdateTypes.MOVE:
          result = factory.createMove(knownResult.source, knownResult.destination);
          break;
        case UpdateTypes.COPY:
          result = factory.createCopy(knownResult.source, knownResult.destination);
          break;
      }
      break;
    }
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
  expr: OpenAlgebra.Expression,
  callbacks: {[T in A.Types]?: (op: OpenAlgebra.TypedOperation<T>, factory: AlgebraFactory) => RecurseResult }
        & {[T in A.ExpressionTypes]?: (expr: OpenAlgebra.TypedExpression<T>, factory: AlgebraFactory) =>
        ExpressionRecurseResult },
  factory?: AlgebraFactory,
): OpenAlgebra.Expression {
  const known = asKnown(expr);
  let result: OpenAlgebra.Expression = expr;
  let doRecursion = true;

  factory = factory ?? new AlgebraFactory();

  const callback = callbacks[known.subType];
  if (callback) {
    ({ result, recurse: doRecursion } = callback(<any> expr, factory));
  }

  if (!doRecursion) {
    return result;
  }

  const mapOp = (op: OpenAlgebra.Operation): A.Operation => asKnown(mapOperation(op, callbacks, factory));

  switch (known.subType) {
    case ExpressionTypes.AGGREGATE:
      if ((<any> known).variable) {
        return factory.createBoundAggregate(
          (<any> known).variable,
          known.aggregator,
<A.Expression> mapOp(known.expression),
known.distinct,
known.separator,
        );
      }
      return factory.createAggregateExpression(
        known.aggregator,
<A.Expression> mapOp(known.expression),
known.distinct,
known.separator,
      );
    case ExpressionTypes.EXISTENCE:
      return factory.createExistenceExpression(known.not, mapOp(known.input));
    case ExpressionTypes.NAMED:
      return factory.createNamedExpression(known.name, <A.Expression[]> known.args.map(mapOp));
    case ExpressionTypes.OPERATOR:
      return factory.createOperatorExpression(known.operator, <A.Expression[]> known.args.map(mapOp));
    case ExpressionTypes.TERM:
      return factory.createTermExpression(known.term);
    case ExpressionTypes.WILDCARD:
      return factory.createWildcardExpression();
    default: throw new Error(`Unknown Expression type ${(<any> known).expressionType}`);
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
  result: OpenAlgebra.Operation;
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
  result: OpenAlgebra.Expression;
  recurse: boolean;
  copyMetadata?: boolean;
}
