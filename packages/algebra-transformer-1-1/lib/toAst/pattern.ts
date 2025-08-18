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
import type * as Algebra from '../algebra';
import { types } from '../toAlgebra/core';
import Util from '../util';
import type { AstIndir } from './core';
import { registerProjection } from './core';
import { translatePureExpression } from './expression';
import type {
  RdfTermToAst,
} from './general';
import {
  translateDatasetClauses,
  translateDistinct,
  translateExtend,
  translateOrderBy,
  translatePattern,
  translateReduced,
  translateTerm,
} from './general';
import { translatePathComponent } from './path';
import { translateConstruct, translateProject } from './queryUnit';

export const translatePatternIntoGroup: AstIndir<'translatePatternIntoGroup', PatternGroup, [Algebra.Operation]> = {
  name: 'translatePatternIntoGroup',
  fun: ({ SUBRULE }) => (_, op) => {
    switch (op.type) {
      case types.ASK: return SUBRULE(translateProject, op, types.ASK);
      case types.PROJECT: return SUBRULE(translateProject, op, types.PROJECT);
      case types.CONSTRUCT: return SUBRULE(translateConstruct, op);
      case types.DESCRIBE: return SUBRULE(translateProject, op, types.DESCRIBE);
      case types.DISTINCT: return SUBRULE(translateDistinct, op);
      case types.FROM: return SUBRULE(translateFrom, op);
      case types.FILTER: return SUBRULE(translateFilter, op);
      case types.REDUCED: return SUBRULE(translateReduced, op);
      case types.SLICE: return SUBRULE(translateSlice, op);
      default:
        throw new Error(`Unknown Operation type ${op.type}`);
    }
  },
};

export const translateSinglePattern: AstIndir<'translateSinglePattern', Pattern, [Algebra.Operation]> = {
  name: 'translateSinglePattern',
  fun: ({ SUBRULE }) => (_, op) => {
    SUBRULE(registerProjection, op);
    switch (op.type) {
      case types.PATH: return SUBRULE(translatePath, op);
      case types.BGP: return SUBRULE(translateBgp, op);
      case types.GRAPH: return SUBRULE(translateGraph, op);
      case types.SERVICE: return SUBRULE(translateService, op);
      case types.UNION: return SUBRULE(translateUnion, op);
      case types.VALUES: return SUBRULE(translateValues, op);
      default:
        return SUBRULE(translatePatternIntoGroup, op);
    }
  },
};

export const translatePatternNew: AstIndir<'translatePatternNew', Pattern | Pattern[], [Algebra.Operation]> = {
  name: 'translatePatternNew',
  fun: ({ SUBRULE }) => (_, op) => {
    SUBRULE(registerProjection, op);
    switch (op.type) {
      case types.ORDER_BY: return SUBRULE(translateOrderBy, op);
      case types.GROUP: return SUBRULE(translateGroup, op);
      case types.EXTEND: return SUBRULE(translateExtend, op);
      case types.JOIN: return SUBRULE(translateJoin, op);
      case types.LEFT_JOIN: return SUBRULE(translateLeftJoin, op);
      case types.MINUS: return SUBRULE(translateMinus, op);
      default:
        return SUBRULE(translateSinglePattern, op);
    }
  },
};

/**
 * These get translated in the project function
 */
export const translateBoundAggregate:
AstIndir<'translateBoundAggregate', Algebra.BoundAggregate, [Algebra.BoundAggregate]> = {
  name: 'translateBoundAggregate',
  fun: () => (_, op) => op,
};

export const translateBgp: AstIndir<'translateBgp', PatternBgp, [Algebra.Bgp]> = {
  name: 'translateBgp',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => {
    const patterns = op.patterns.map(triple => SUBRULE(translatePattern, triple));
    return F.patternBgp(patterns, F.gen());
  },
};

export const translatePath: AstIndir<'translatePath', PatternBgp, [Algebra.Path]> = {
  name: 'translatePath',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => F.patternBgp([
    F.triple(
      SUBRULE(translateTerm, op.subject),
      SUBRULE(translatePathComponent, op.predicate),
      SUBRULE(translateTerm, op.object),
    ),
  ], F.gen()),
};

/**
 * A from needs to be registered to the solutionModifiers.
 * Similar to {@link translateDistinct}
 */
export const translateFrom: AstIndir<'translateFrom', PatternGroup, [Algebra.From]> = {
  name: 'translateFrom',
  fun: ({ SUBRULE }) => (_, op) => {
    const result = SUBRULE(translatePatternIntoGroup, op.input);
    const query = <QueryBase> result.patterns[0];
    query.datasets = SUBRULE(translateDatasetClauses, op.default, op.named);
    return result;
  },
};

/**
 * A patternFilter closes the group
 */
export const translateFilter: AstIndir<'translateFilter', PatternGroup, [Algebra.Filter]> = {
  name: 'translateFilter',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.patternGroup(
      Util.flatten([
        SUBRULE(translatePatternNew, op.input),
        F.patternFilter(SUBRULE(translatePureExpression, op.expression), F.gen()),
      ]),
      F.gen(),
    ),
};

export const translateGraph: AstIndir<'translateGraph', PatternGraph, [Algebra.Graph]> = {
  name: 'translateGraph',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.patternGraph(
      <RdfTermToAst<typeof op.name>>SUBRULE(translateTerm, op.name),
      Util.flatten([ SUBRULE(translatePatternNew, op.input) ]),
      F.gen(),
    ),
};

/**
 * A group needs to be handled by {@link translateProject}
 */
export const translateGroup: AstIndir<'translateGroup', Pattern | Pattern[], [Algebra.Group]> = {
  name: 'translateGroup',
  fun: ({ SUBRULE }) => ({ aggregates, group }, op) => {
    const input = SUBRULE(translatePatternNew, op.input);
    const aggs = op.aggregates.map(x => SUBRULE(translateBoundAggregate, x));
    aggregates.push(...aggs);
    // TODO: apply possible extends
    group.push(...op.variables);
    return input;
  },
};

export const translateJoin: AstIndir<'translateJoin', Pattern[], [Algebra.Join]> = {
  name: 'translateJoin',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => {
    const arr = Util.flatten(op.input.map(x => SUBRULE(translatePatternNew, x)));

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

export const translateLeftJoin: AstIndir<'translateLeftJoin', Pattern[], [Algebra.LeftJoin]> = {
  name: 'translateLeftJoin',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => {
    const leftJoin = F.patternOptional(
      SUBRULE(operationInputAsPatternList, op.input[1]),
      F.gen(),
    );

    if (op.expression) {
      leftJoin.patterns.push(
        F.patternFilter(SUBRULE(translatePureExpression, op.expression), F.gen()),
      );
    }
    leftJoin.patterns = leftJoin.patterns.filter(Boolean);

    return Util.flatten([
      SUBRULE(translatePatternNew, op.input[0]),
      leftJoin,
    ]);
  },
};

export const translateMinus: AstIndir<'translateMinus', Pattern[], [Algebra.Minus]> = {
  name: 'translateMinus',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    Util.flatten([
      SUBRULE(translatePatternNew, op.input[0]),
      F.patternMinus(SUBRULE(operationInputAsPatternList, op.input[1]), F.gen()),
    ]),
};

export const translateService: AstIndir<'translateService', PatternService, [Algebra.Service]> = {
  name: 'translateService',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.patternService(
      <RdfTermToAst<typeof op.name>> SUBRULE(translateTerm, op.name),
      SUBRULE(operationInputAsPatternList, op.input),
      op.silent,
      F.gen(),
    ),
};

/**
 * Unwrap single group patterns, create array if it was not yet.
 */
export const operationInputAsPatternList: AstIndir<'operationInputAsPatternList', Pattern[], [Algebra.Operation]> = {
  name: 'operationInputAsPatternList',
  fun: ({ SUBRULE }) => (_, input) => {
    const result = SUBRULE(translatePatternNew, input);
    // If (result && F.isPatternGroup(result)) {
    //   return result.patterns;
    // }
    return result ? (Array.isArray(result) ? result : [ result ]) : [];
  },
};

/**
 * A limit offset needs to be registered to the solutionModifiers.
 * Similar to {@link translateDistinct}
 */
export const translateSlice: AstIndir<'translateSlice', PatternGroup, [Algebra.Slice]> = {
  name: 'translateSlice',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => {
    const result = SUBRULE(translatePatternIntoGroup, op.input);
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

export const wrapInPatternGroup: AstIndir<'wrapInPatternGroup', PatternGroup, [Pattern[] | Pattern]> = {
  name: 'wrapInPatternGroup',
  fun: () => ({ astFactory: F }, input) => {
    if (!Array.isArray(input)) {
      return F.patternGroup([ input ], F.gen());
    }
    return F.patternGroup(input, F.gen());
  },
};

export const translateUnion: AstIndir<'translateUnion', PatternUnion, [Algebra.Union]> = {
  name: 'translateUnion',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.patternUnion(
      op.input.map(operation => SUBRULE(wrapInPatternGroup, SUBRULE(operationInputAsPatternList, operation))),
      F.gen(),
    ),
};

export const translateValues: AstIndir<'translateValues', PatternValues, [Algebra.Values]> = {
  name: 'translateValues',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.patternValues(
      op.bindings.map((binding) => {
        const result: ValuePatternRow = {};
        for (const v of op.variables) {
          const s = v.value;
          if (binding[s]) {
            result[s] = <RdfTermToAst<typeof binding[typeof s]>> SUBRULE(translateTerm, binding[s]);
          } else {
            result[s] = undefined;
          }
        }
        return result;
      }),
      F.gen(),
    ),
};
