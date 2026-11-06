import type {
  Pattern,
  PatternBgp,
  PatternGraph,
  PatternGroup,
  PatternService,
  PatternUnion,
  PatternValues,
  QueryBase,
  ValuePatternRow,
} from '@traqula/rules-sparql-1-1';
import type * as Algebra from '../algebra.js';
import { defaultAlgebraTransformer, types } from '../toAlgebra/index.js';
import { inScopeVariables } from '../util.js';
import type { AstIndir } from './core.js';
import { findAlgGroupBelow, registerProjection, splitAlgValuesJoin } from './core.js';
import { translateAlgPureExpression } from './expression.js';
import type {
  RdfTermToAst,
} from './general.js';
import {
  translateAlgDatasetClauses,
  translateAlgDistinct,
  translateAlgExtend,
  translateAlgOrderBy,
  translateAlgPattern,
  translateAlgReduced,
  translateAlgTerm,
} from './general.js';
import { translateAlgPathComponent } from './path.js';
import { translateAlgConstruct, translateAlgProject } from './queryUnit.js';

export const translateAlgPatternIntoGroup: AstIndir<'translatePatternIntoGroup', PatternGroup, [Algebra.Operation]> = {
  name: 'translatePatternIntoGroup',
  fun: ({ SUBRULE }) => (_, op) => {
    switch (op.type) {
      case types.ASK: return SUBRULE(translateAlgProject, op, types.ASK);
      case types.PROJECT: return SUBRULE(translateAlgProject, op, types.PROJECT);
      case types.CONSTRUCT: return SUBRULE(translateAlgConstruct, op);
      case types.DESCRIBE: return SUBRULE(translateAlgProject, op, types.DESCRIBE);
      case types.DISTINCT: return SUBRULE(translateAlgDistinct, op);
      case types.FROM: return SUBRULE(translateAlgFrom, op);
      case types.FILTER: return SUBRULE(translateAlgFilter, op);
      case types.REDUCED: return SUBRULE(translateAlgReduced, op);
      case types.SLICE: return SUBRULE(translateAlgSlice, op);
      default:
        throw new Error(`Unknown Operation type ${op.type}`);
    }
  },
};

/**
 * Translates the operation as a SELECT subquery projecting all its in-scope variables.
 * @param op - the operation to evaluate in its own scope.
 * @return the group holding the subquery.
 */
export const translateAlgInOwnSubquery: AstIndir<'translateInOwnSubquery', PatternGroup, [Algebra.Operation]> = {
  name: 'translateInOwnSubquery',
  fun: ({ SUBRULE }) => ({ algebraFactory, algebraTransformer = defaultAlgebraTransformer }, op) =>
    SUBRULE(translateAlgPatternIntoGroup, algebraFactory.createProject(
      op,
      inScopeVariables(op, (operation, callbacks) => algebraTransformer.visitNode(operation, callbacks)),
    )),
};

/**
 * The operations a single query consists of, numbered in the order SPARQL applies them:
 * the query form, then DISTINCT or REDUCED, then the slice, and FROM to the whole query.
 * Larger number takes smaller number as input
 */
const queryOperationOrder = <const> {
  [types.ASK]: 0,
  [types.PROJECT]: 0,
  [types.CONSTRUCT]: 0,
  [types.DESCRIBE]: 0,
  [types.DISTINCT]: 1,
  [types.REDUCED]: 1,
  [types.SLICE]: 2,
  [types.FROM]: 3,
};

/**
 * The types of the operations a single query consists of.
 */
export type AlgQueryOperationType = keyof typeof queryOperationOrder;

/**
 * Translates the input of an operation that modifies the query its input translates into, or the root operation.
 * The input stays in that query when SPARQL applies it before the modifying operation,
 * otherwise it is translated in a subquery of its own.
 * @param op - the input of the modifying operation, or the root operation.
 * @param modifierType - the type of the modifying operation, undefined for the root operation.
 * @return the group holding the query.
 */
export const translateAlgModifiedQuery:
AstIndir<'translateModifiedQuery', PatternGroup, [Algebra.Operation, AlgQueryOperationType?]> = {
  name: 'translateModifiedQuery',
  fun: ({ SUBRULE }) => (_, op, modifierType) => {
    // FROM only sets the dataset, so it commutes with the operation modifying the query
    if (op.type === types.FROM && modifierType !== undefined) {
      return SUBRULE(translateAlgFrom, op, modifierType);
    }
    const position: number | undefined = (<Record<string, number>> queryOperationOrder)[op.type];
    const isAppliedBefore = position !== undefined &&
      (modifierType === undefined || position < queryOperationOrder[modifierType]);
    return isAppliedBefore ?
      SUBRULE(translateAlgPatternIntoGroup, op) :
      SUBRULE(translateAlgInOwnSubquery, op);
  },
};

export const translateAlgSinglePattern: AstIndir<'translateSinglePattern', Pattern, [Algebra.Operation]> = {
  name: 'translateSinglePattern',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => {
    SUBRULE(registerProjection, op);
    switch (op.type) {
      case types.PATH: return SUBRULE(translateAlgPath, op);
      case types.BGP: return SUBRULE(translateAlgBgp, op);
      case types.GRAPH: return SUBRULE(translateAlgGraph, op);
      case types.SERVICE: return SUBRULE(translateAlgService, op);
      case types.UNION: return SUBRULE(translateAlgUnion, op);
      case types.VALUES: return SUBRULE(translateAlgValues, op);
      case types.PATTERN: return F.patternBgp([ SUBRULE(translateAlgPattern, op) ], F.gen());
      default:
        return SUBRULE(translateAlgPatternIntoGroup, op);
    }
  },
};

/**
 * The solution modifiers of a group belong to the query of that group.
 * An operation over any other group is thus translated in a subquery of its own.
 */
export const translateAlgPatternNew: AstIndir<'translatePatternNew', Pattern | Pattern[], [Algebra.Operation]> = {
  name: 'translatePatternNew',
  fun: ({ SUBRULE }) => ({ queryGroup }, op) => {
    const group = SUBRULE(findAlgGroupBelow, op, 'projection');
    if (group && group !== queryGroup) {
      return SUBRULE(translateAlgInOwnSubquery, op);
    }
    SUBRULE(registerProjection, op);
    switch (op.type) {
      case types.ORDER_BY: return SUBRULE(translateAlgOrderBy, op);
      case types.GROUP: return SUBRULE(translateAlgGroup, op);
      case types.EXTEND: return SUBRULE(translateAlgExtend, op);
      case types.JOIN: return SUBRULE(translateAlgJoin, op);
      case types.LEFT_JOIN: return SUBRULE(translateAlgLeftJoin, op);
      case types.MINUS: return SUBRULE(translateAlgMinus, op);
      default:
        return SUBRULE(translateAlgSinglePattern, op);
    }
  },
};

/**
 * These get translated in the project function
 */
export const translateAlgBoundAggregate:
AstIndir<'translateBoundAggregate', Algebra.BoundAggregate, [Algebra.BoundAggregate]> = {
  name: 'translateBoundAggregate',
  fun: () => (_, op) => op,
};

export const translateAlgBgp: AstIndir<'translateBgp', PatternBgp, [Algebra.Bgp]> = {
  name: 'translateBgp',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => {
    const patterns = op.patterns.map(triple => SUBRULE(translateAlgPattern, triple));
    return F.patternBgp(patterns, F.gen());
  },
};

export const translateAlgPath: AstIndir<'translatePath', PatternBgp, [Algebra.Path]> = {
  name: 'translatePath',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => F.patternBgp([
    F.triple(
      SUBRULE(translateAlgTerm, op.subject),
      SUBRULE(translateAlgPathComponent, op.predicate),
      SUBRULE(translateAlgTerm, op.object),
    ),
  ], F.gen()),
};

/**
 * Sets the dataset clauses of the query its input translates into.
 * @param op - the FROM operation.
 * @param modifierType - the type of the operation modifying the query, if any.
 * @return the group holding the query.
 */
export const translateAlgFrom: AstIndir<'translateFrom', PatternGroup, [Algebra.From, AlgQueryOperationType?]> = {
  name: 'translateFrom',
  fun: ({ SUBRULE }) => (_, op, modifierType) => {
    const result = SUBRULE(translateAlgModifiedQuery, op.input, modifierType);
    const query = <QueryBase> result.patterns[0];
    query.datasets = SUBRULE(translateAlgDatasetClauses, op.default, op.named);
    return result;
  },
};

/**
 * A patternFilter closes the group.
 * A filter on top of a group (possibly through other such filters) is a HAVING condition,
 * it needs to be handled by {@link translateAlgProject}
 */
export const translateAlgFilter: AstIndir<'translateFilter', PatternGroup, [Algebra.Filter]> = {
  name: 'translateFilter',
  fun: ({ SUBRULE }) => ({ astFactory: F, having }, op) => {
    const input = SUBRULE(translateAlgPatternNew, op.input);
    const expression = SUBRULE(translateAlgPureExpression, op.expression);
    if (SUBRULE(findAlgGroupBelow, op.input, 'having')) {
      having.push(expression);
      // Stacked HAVING conditions should not introduce nested groups
      return F.isPatternGroup(input) ? input : F.patternGroup([ input ].flat(), F.gen());
    }
    return F.patternGroup([ input, F.patternFilter(expression, F.gen()) ].flat(), F.gen());
  },
};

export const translateAlgGraph: AstIndir<'translateGraph', PatternGraph, [Algebra.Graph]> = {
  name: 'translateGraph',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.patternGraph(
      <RdfTermToAst<typeof op.name>>SUBRULE(translateAlgTerm, op.name),
      [ SUBRULE(translateAlgPatternNew, op.input) ].flat(),
      F.gen(),
    ),
};

/**
 * A group needs to be handled by {@link translateAlgProject}.
 * `GROUP BY (expr AS ?v)` translates to extends directly below the group, binding group variables.
 * Those extends are registered, so they become `(expr AS ?v)` group conditions instead of BINDs in the WHERE clause.
 */
export const translateAlgGroup: AstIndir<'translateGroup', Pattern | Pattern[], [Algebra.Group]> = {
  name: 'translateGroup',
  fun: ({ SUBRULE }) => ({ aggregates, group, extend }, op) => {
    const groupVariables = op.variables.map(variable => variable.value);
    let input = op.input;
    // Group conditions are evaluated in order: the extends (top to bottom) must bind group variables in reverse order
    let lastIndex = groupVariables.length;
    while (input.type === types.EXTEND) {
      const index = groupVariables.indexOf(input.variable.value);
      if (index < 0 || index >= lastIndex) {
        break;
      }
      extend.push(input);
      lastIndex = index;
      input = input.input;
    }
    const pattern = SUBRULE(translateAlgPatternNew, input);
    const aggs = op.aggregates.map(x => SUBRULE(translateAlgBoundAggregate, x));
    aggregates.push(...aggs);
    group.push(...op.variables);
    return pattern;
  },
};

export const translateAlgJoin: AstIndir<'translateJoin', Pattern[], [Algebra.Join]> = {
  name: 'translateJoin',
  fun: ({ SUBRULE }) => (c, op) => {
    const F = c.astFactory;
    // A VALUES joined on top of a group (possibly through HAVING filters) is the query's trailing VALUES clause.
    // It needs to be handled by translateAlgProject, inside the WHERE clause it would be joined before the grouping.
    const valuesJoin = splitAlgValuesJoin(op);
    if (valuesJoin && SUBRULE(findAlgGroupBelow, op, 'values')) {
      c.values = SUBRULE(translateAlgValues, valuesJoin.values);
      return SUBRULE(operationAlgInputAsPatternList, valuesJoin.other);
    }

    // An OPTIONAL or MINUS applies to everything preceding it in its group.
    // Operands other than the first must thus be scoped by their own group when they contain one,
    // and thus get rewrapped ina  group, otherwise Join(A, Minus(B, C)) would be read back as Minus(Join(A, B), C).
    const arr = op.input.flatMap((x, index) => {
      const patterns = SUBRULE(operationAlgInputAsPatternList, x);
      if (index > 0 && patterns.some(pattern => F.isPatternOptional(pattern) || F.isPatternMinus(pattern))) {
        return [ F.patternGroup(patterns, F.gen()) ];
      }
      return patterns;
    });

    // Merge bgps
    // This is possible if one side was a path and the other a bgp for example
    const result: Pattern[] = [];
    for (const val of arr) {
      const lastResult = result.at(-1);
      if (!F.isPatternBgp(val) || result.length === 0 || !F.isPatternBgp(lastResult!)) {
        result.push(val);
      } else {
        lastResult.triples.push(...val.triples);
      }
    }
    return result;
  },
};

export const translateAlgLeftJoin: AstIndir<'translateLeftJoin', Pattern[], [Algebra.LeftJoin]> = {
  name: 'translateLeftJoin',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => {
    const leftJoin = F.patternOptional(
      SUBRULE(operationAlgInputAsPatternList, op.input[1]),
      F.gen(),
    );

    if (op.expression) {
      leftJoin.patterns.push(
        F.patternFilter(SUBRULE(translateAlgPureExpression, op.expression), F.gen()),
      );
    }
    leftJoin.patterns = leftJoin.patterns.filter(Boolean);

    return [
      SUBRULE(translateAlgPatternNew, op.input[0]),
      leftJoin,
    ].flat();
  },
};

export const translateAlgMinus: AstIndir<'translateMinus', Pattern[], [Algebra.Minus]> = {
  name: 'translateMinus',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    [
      SUBRULE(translateAlgPatternNew, op.input[0]),
      F.patternMinus(SUBRULE(operationAlgInputAsPatternList, op.input[1]), F.gen()),
    ].flat(),
};

export const translateAlgService: AstIndir<'translateService', PatternService, [Algebra.Service]> = {
  name: 'translateService',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.patternService(
      <RdfTermToAst<typeof op.name>> SUBRULE(translateAlgTerm, op.name),
      SUBRULE(operationAlgInputAsPatternList, op.input),
      op.silent,
      F.gen(),
    ),
};

/**
 * Unwrap single group patterns, create array if it was not yet.
 */
export const operationAlgInputAsPatternList: AstIndir<'operationInputAsPatternList', Pattern[], [Algebra.Operation]> = {
  name: 'operationInputAsPatternList',
  fun: ({ SUBRULE }) => (_, input) => {
    const result = SUBRULE(translateAlgPatternNew, input);
    return Array.isArray(result) ? result : [ result ];
  },
};

/**
 * Sets the LIMIT and OFFSET of the query its input translates into.
 */
export const translateAlgSlice: AstIndir<'translateSlice', PatternGroup, [Algebra.Slice]> = {
  name: 'translateSlice',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => {
    const result = SUBRULE(translateAlgModifiedQuery, op.input, types.SLICE);
    const query = <QueryBase>result.patterns[0];
    if (op.start !== 0) {
      query.solutionModifiers.limitOffset = query.solutionModifiers.limitOffset ??
        F.solutionModifierLimitOffset(undefined, op.start, F.gen());
      query.solutionModifiers.limitOffset.offset = op.start;
    }
    if (op.length !== undefined) {
      query.solutionModifiers.limitOffset = query.solutionModifiers.limitOffset ??
        F.solutionModifierLimitOffset(op.length, undefined, F.gen());
      query.solutionModifiers.limitOffset.limit = op.length;
    }
    return result;
  },
};

export const algWrapInPatternGroup: AstIndir<'wrapInPatternGroup', PatternGroup, [Pattern[] | Pattern]> = {
  name: 'wrapInPatternGroup',
  fun: () => ({ astFactory: F }, input) => {
    if (Array.isArray(input)) {
      return F.patternGroup(input, F.gen());
    }
    if (F.isPatternGroup(input)) {
      return input;
    }
    return F.patternGroup([ input ], F.gen());
  },
};

export const translateAlgUnion: AstIndir<'translateUnion', PatternUnion, [Algebra.Union]> = {
  name: 'translateUnion',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.patternUnion(
      op.input.map(operation => SUBRULE(algWrapInPatternGroup, SUBRULE(translateAlgPatternNew, operation))),
      F.gen(),
    ),
};

export const translateAlgValues: AstIndir<'translateValues', PatternValues, [Algebra.Values]> = {
  name: 'translateValues',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.patternValues(
      op.variables.map(variable => F.termVariable(variable.value, F.gen())),
      op.bindings.map((binding) => {
        const result: ValuePatternRow = Object.create(null);
        for (const v of op.variables) {
          const s = v.value;
          if (Object.hasOwn(binding, s) && binding[s]) {
            result[s] = <RdfTermToAst<typeof binding[typeof s]>> SUBRULE(translateAlgTerm, binding[s]);
          } else {
            result[s] = undefined;
          }
        }
        return result;
      }),
      F.gen(),
    ),
};
