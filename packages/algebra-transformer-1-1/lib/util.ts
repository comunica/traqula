import type * as RDF from '@rdfjs/types';
import { someTermsNested } from 'rdf-terms';
import type * as A from './algebra';
import { expressionTypes, Types } from './algebra';
import Factory from './factory';

// eslint-disable-next-line ts/no-extraneous-class
export default class Util {
  /**
   * Flattens an array of arrays to an array.
   * @param arr - Array of arrays
   */
  public static flatten<T>(arr: T[][]): T[] {
    return arr.flat().filter(Boolean);
  }

  /**
   * Resolves an IRI against a base path in accordance to the [Syntax for IRIs](https://www.w3.org/TR/sparql11-query/#QSynIRI)
   */
  public static resolveIRI(iri: string, base: string | undefined): string {
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
  public static objectify(algebra: any): any {
    if (algebra.termType) {
      if (algebra.termType === 'Quad') {
        return {
          type: 'pattern',
          termType: 'Quad',
          subject: Util.objectify(algebra.subject),
          predicate: Util.objectify(algebra.predicate),
          object: Util.objectify(algebra.object),
          graph: Util.objectify(algebra.graph),
        };
      }
      const result: any = { termType: algebra.termType, value: algebra.value };
      if (algebra.language) {
        result.language = algebra.language;
      }
      if (algebra.datatype) {
        result.datatype = Util.objectify(algebra.datatype);
      }
      return result;
    }
    if (Array.isArray(algebra)) {
      return algebra.map(e => Util.objectify(e));
    }
    if (algebra === Object(algebra)) {
      const result: any = {};
      for (const key of Object.keys(algebra)) {
        result[key] = Util.objectify(algebra[key]);
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
  public static inScopeVariables(op: A.Operation): RDF.Variable[] {
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
    Util.recurseOperation(op, {
      [Types.EXPRESSION]: (op) => {
        if (op.expressionType === expressionTypes.AGGREGATE && op.variable) {
          addVariable(op.variable);
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

  /**
   * Recurses through the given algebra tree
   * A map of callback functions can be provided for individual Operation types to gather data.
   * The return value of those callbacks should indicate whether recursion should be applied or not.
   * Making modifications will change the original input object.
   * @param {Operation} op - The Operation to recurse on.
   * @param { [type: string]: (op: Operation) => boolean } callbacks - A map of required callback Operations.
   */
  public static recurseOperation(
    op: A.Operation,
    callbacks: {[T in A.Types]?: (op: A.TypedOperation<T>,) => boolean },
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

    const recurseOp = (op: A.Operation): void => Util.recurseOperation(op, callbacks);

    switch (result.type) {
      case Types.ALT:
        result.input.map(recurseOp);
        break;
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
        if (result.expressionType === expressionTypes.EXISTENCE) {
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
      case Types.INV:
        recurseOp(result.path);
        break;
      case Types.JOIN:
        result.input.map(recurseOp);
        break;
      case Types.LEFT_JOIN:
        result.input.map(recurseOp);
        if (result.expression) {
          recurseOp(result.expression);
        }
        break;
      case Types.LINK:
        break;
      case Types.MINUS:
        result.input.map(recurseOp);
        break;
      case Types.NOP:
        break;
      case Types.NPS:
        break;
      case Types.ONE_OR_MORE_PATH:
        recurseOp(result.path);
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
      case Types.SEQ:
        result.input.map(recurseOp);
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
      case Types.ZERO_OR_MORE_PATH:
        recurseOp(result.path);
        break;
      case Types.ZERO_OR_ONE_PATH:
        recurseOp(result.path);
        break;
        // UPDATE operations
      case Types.COMPOSITE_UPDATE:
        for (const update of result.updates) {
          recurseOp(update);
        }
        break;
      case Types.DELETE_INSERT:
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
      case Types.LOAD: break;
      case Types.CLEAR: break;
      case Types.CREATE: break;
      case Types.DROP: break;
      case Types.ADD: break;
      case Types.MOVE: break;
      case Types.COPY: break;
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
   * @param {Factory} factory - Factory used to create new Operations. Will use default factory if none is provided.
   * @returns {Operation} - The copied result.
   */
  public static mapOperation(
    op: A.Operation,
    callbacks: {[T in A.Types]?: (op: A.TypedOperation<T>, factory: Factory) => RecurseResult }
        & {[T in A.expressionTypes]?: (expr: A.TypedExpression<T>, factory: Factory) => ExpressionRecurseResult },
    factory?: Factory,
  ): A.Operation {
    let result: A.Operation = op;
    let doRecursion = true;
    let copyMetadata = true;

    factory = factory ?? new Factory();

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

    const mapOp = (op: A.Operation): A.Operation => Util.mapOperation(op, callbacks, factory);

    // Several casts here might be wrong though depending on the callbacks output
    switch (result.type) {
      case Types.ALT:
        result = factory.createAlt(<A.PropertyPathSymbol[]> result.input.map(mapOp));
        break;
      case Types.ASK:
        result = factory.createAsk(mapOp(result.input));
        break;
      case Types.BGP:
        result = factory.createBgp(<A.Pattern[]> result.patterns.map(mapOp));
        break;
      case Types.CONSTRUCT:
        result = factory.createConstruct(mapOp(result.input), <A.Pattern[]> result.template.map(mapOp));
        break;
      case Types.DESCRIBE:
        result = factory.createDescribe(mapOp(result.input), result.terms);
        break;
      case Types.DISTINCT:
        result = factory.createDistinct(mapOp(result.input));
        break;
      case Types.EXPRESSION:
        result = Util.mapExpression(result, callbacks, factory);
        break;
      case Types.EXTEND:
        result = factory.createExtend(mapOp(result.input), result.variable, <A.Expression> mapOp(result.expression));
        break;
      case Types.FILTER:
        result = factory.createFilter(mapOp(result.input), <A.Expression> mapOp(result.expression));
        break;
      case Types.FROM:
        result = factory.createFrom(mapOp(result.input), [ ...result.default ], [ ...result.named ]);
        break;
      case Types.GRAPH:
        result = factory.createGraph(mapOp(result.input), result.name);
        break;
      case Types.GROUP:
        result = factory.createGroup(
          mapOp(result.input),
          [ ...result.variables ],
          <A.BoundAggregate[]> result.aggregates.map(mapOp),
        );
        break;
      case Types.INV:
        result = factory.createInv(<A.PropertyPathSymbol> mapOp(result.path));
        break;
      case Types.JOIN:
        result = factory.createJoin(result.input.map(mapOp));
        break;
      case Types.LEFT_JOIN:
        result = factory.createLeftJoin(
          mapOp(result.input[0]),
          mapOp(result.input[1]),
          result.expression ? <A.Expression> mapOp(result.expression) : undefined,
        );
        break;
      case Types.LINK:
        result = factory.createLink(result.iri);
        break;
      case Types.MINUS:
        result = factory.createMinus(mapOp(result.input[0]), mapOp(result.input[1]));
        break;
      case Types.NOP:
        result = factory.createNop();
        break;
      case Types.NPS:
        result = factory.createNps([ ...result.iris ]);
        break;
      case Types.ONE_OR_MORE_PATH:
        result = factory.createOneOrMorePath(<A.PropertyPathSymbol> mapOp(result.path));
        break;
      case Types.ORDER_BY:
        result = factory.createOrderBy(mapOp(result.input), <A.Expression[]> result.expressions.map(mapOp));
        break;
      case Types.PATH:
        result = factory.createPath(
          result.subject,
<A.PropertyPathSymbol> mapOp(result.predicate),
result.object,
result.graph,
        );
        break;
      case Types.PATTERN:
        result = factory.createPattern(result.subject, result.predicate, result.object, result.graph);
        break;
      case Types.PROJECT:
        result = factory.createProject(mapOp(result.input), [ ...result.variables ]);
        break;
      case Types.REDUCED:
        result = factory.createReduced(mapOp(result.input));
        break;
      case Types.SEQ:
        result = factory.createSeq(<A.PropertyPathSymbol[]> result.input.map(mapOp));
        break;
      case Types.SERVICE:
        result = factory.createService(mapOp(result.input), result.name, result.silent);
        break;
      case Types.SLICE:
        result = factory.createSlice(mapOp(result.input), result.start, result.length);
        break;
      case Types.UNION:
        result = factory.createUnion(result.input.map(mapOp));
        break;
      case Types.VALUES:
        result = factory.createValues([ ...result.variables ], result.bindings.map(b => ({ ...b })));
        break;
      case Types.ZERO_OR_MORE_PATH:
        result = factory.createZeroOrMorePath(<A.PropertyPathSymbol> mapOp(result.path));
        break;
      case Types.ZERO_OR_ONE_PATH:
        result = factory.createZeroOrOnePath(<A.PropertyPathSymbol> mapOp(result.path));
        break;
        // UPDATE operations
      case Types.COMPOSITE_UPDATE:
        result = factory.createCompositeUpdate(<A.Update[]> result.updates.map(mapOp));
        break;
      case Types.DELETE_INSERT:
        result = factory.createDeleteInsert(
          result.delete ? <A.Pattern[]> result.delete.map(mapOp) : undefined,
          result.insert ? <A.Pattern[]> result.insert.map(mapOp) : undefined,
          result.where ? mapOp(result.where) : undefined,
        );
        break;
      case Types.LOAD:
        result = factory.createLoad(result.source, result.destination, result.silent);
        break;
      case Types.CLEAR:
        result = factory.createClear(result.source, result.silent);
        break;
      case Types.CREATE:
        result = factory.createCreate(result.source, result.silent);
        break;
      case Types.DROP:
        result = factory.createDrop(result.source, result.silent);
        break;
      case Types.ADD:
        result = factory.createAdd(result.source, result.destination);
        break;
      case Types.MOVE:
        result = factory.createMove(result.source, result.destination);
        break;
      case Types.COPY:
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
   * @param {Factory} factory - Factory used to create new Operations. Will use default factory if none is provided.
   * @returns {Operation} - The copied result.
   */
  public static mapExpression(
    expr: A.Expression,
    callbacks: {[T in A.Types]?: (op: A.TypedOperation<T>, factory: Factory) => RecurseResult }
        & {[T in A.expressionTypes]?: (expr: A.TypedExpression<T>, factory: Factory) => ExpressionRecurseResult },
    factory?: Factory,
  ): A.Expression {
    let result: A.Expression = expr;
    let doRecursion = true;

    factory = factory ?? new Factory();

    const callback = callbacks[expr.expressionType];
    if (callback) {
      ({ result, recurse: doRecursion } = callback(<any> expr, factory));
    }

    if (!doRecursion) {
      return result;
    }

    const mapOp = (op: A.Operation): A.Operation => Util.mapOperation(op, callbacks, factory);

    switch (expr.expressionType) {
      case expressionTypes.AGGREGATE:
        if (expr.variable) {
          return factory.createBoundAggregate(
            expr.variable,
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
      case expressionTypes.EXISTENCE:
        return factory.createExistenceExpression(expr.not, mapOp(expr.input));
      case expressionTypes.NAMED:
        return factory.createNamedExpression(expr.name, <A.Expression[]> expr.args.map(mapOp));
      case expressionTypes.OPERATOR:
        return factory.createOperatorExpression(expr.operator, <A.Expression[]> expr.args.map(mapOp));
      case expressionTypes.TERM:
        return factory.createTermExpression(expr.term);
      case expressionTypes.WILDCARD:
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
  public static cloneOperation(op: A.Operation): A.Operation {
    return Util.mapOperation(op, {});
  }

  /**
   * Creates a deep clone of the expression.
   * This is syntactic sugar for calling {@link mapExpression} without callbacks.
   * @param {Expression} expr - The operation to copy.
   * @returns {Expression} - The deep copy.
   */
  public static cloneExpression(expr: A.Expression): A.Expression {
    return Util.mapExpression(expr, {});
  }

  public static createUniqueVariable(
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
  public static isSimpleTerm(term: any): term is RDF.Term {
    return term.termType !== undefined && term.termType !== 'Quad' && term.termType !== 'Wildcard';
  }

  public static isQuad(term: any): term is RDF.Quad {
    return term.termType === 'Quad';
  }

  public static hasQuadVariables(quad: RDF.Quad): boolean {
    return someTermsNested(quad, term => term.termType === 'Variable');
  }
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
