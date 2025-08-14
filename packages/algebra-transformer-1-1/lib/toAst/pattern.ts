import type {
  Pattern,
  PatternBgp,
  PatternGraph,
  PatternGroup,
  PatternService,
  PatternUnion,
  PatternValues,
  QueryBase,
  Update,
  UpdateOperation,
  ValuePatternRow,
} from '@traqula/rules-sparql-1-1';
import type { Algebra } from '../index';
import { types } from '../toAlgebra/core';
import Util from '../util';
import type { AstContext } from './core';
import { registerProjection } from './core';
import { translateAnyExpression, translatePureExpression } from './expression';
import {
  translateDatasetClauses,
  translateDistinct,
  translateExtend,
  translateOrderBy,
  translatePattern,
  translateReduced,
  translateTerm,
} from './general';
import { translatePath } from './path';
import { translateConstruct, translateProject } from './queryUnit';
import { translateCompositeUpdate, translateUpdateOperation } from './updateUnit';

export type TranslationType = Pattern | Pattern[] | Record<never, never> | Update | UpdateOperation;

export function translateOperation(c: AstContext, op: Algebra.Operation):
TranslationType {
  registerProjection(c, op);
  switch (op.type) {
    case types.EXPRESSION: return translateAnyExpression(c, op);
    case types.NOP: return {};
    case types.ORDER_BY:
    case types.PATH:
    case types.ASK:
    case types.BGP:
    case types.CONSTRUCT:
    case types.DESCRIBE:
    case types.DISTINCT:
    case types.EXTEND:
    case types.FROM:
    case types.FILTER:
    case types.GRAPH:
    case types.GROUP:
    case types.JOIN:
    case types.LEFT_JOIN:
    case types.MINUS:
    case types.PROJECT:
    case types.REDUCED:
    case types.SERVICE:
    case types.SLICE:
    case types.UNION:
    case types.VALUES: return translatePatternNew(c, op);
    case types.PATTERN: return translatePattern(c, op);
    // UPDATE operations
    case types.COMPOSITE_UPDATE: return translateCompositeUpdate(c, op);
    case types.DELETE_INSERT:
    case types.LOAD:
    case types.CLEAR:
    case types.CREATE:
    case types.DROP:
    case types.ADD:
    case types.MOVE:
    case types.COPY: return translateUpdateOperation(c, op);
    default:
      throw new Error(`Unknown Operation type ${op.type}`);
  }
}

export function translateSinglePattern(c: AstContext, op: Algebra.Operation): Pattern {
  switch (op.type) {
    case types.ASK:
    case types.PROJECT:
    case types.CONSTRUCT:
    case types.DESCRIBE:
    case types.DISTINCT:
    case types.FROM:
    case types.FILTER:
    case types.SLICE:
    case types.REDUCED: return translatePatternIntoGroup(c, op);
    case types.PATH: return translatePath(c, op);
    case types.BGP: return translateBgp(c, op);
    case types.GRAPH: return translateGraph(c, op);
    case types.SERVICE: return translateService(c, op);
    case types.UNION: return translateUnion(c, op);
    case types.VALUES: return translateValues(c, op);
    default:
      throw new Error(`Unknown Operation type ${op.type}`);
  }
}

export function translatePatternIntoGroup(c: AstContext, op: Algebra.Operation): PatternGroup {
  switch (op.type) {
    case types.ASK: return translateProject(c, op, types.ASK);
    case types.PROJECT: return translateProject(c, op, types.PROJECT);
    case types.CONSTRUCT: return translateConstruct(c, op);
    case types.DESCRIBE: return translateProject(c, op, types.DESCRIBE);
    case types.DISTINCT: return translateDistinct(c, op);
    case types.FROM: return translateFrom(c, op);
    case types.FILTER: return translateFilter(c, op);
    case types.REDUCED: return translateReduced(c, op);
    case types.SLICE: return translateSlice(c, op);
    default:
      throw new Error(`Unknown Operation type ${op.type}`);
  }
}

export function translatePatternNew(c: AstContext, op: Algebra.Operation): Pattern | Pattern[] {
  registerProjection(c, op);
  switch (op.type) {
    case types.ASK:
    case types.PROJECT:
    case types.CONSTRUCT:
    case types.DESCRIBE:
    case types.BGP:
    case types.DISTINCT:
    case types.PATH:
    case types.FROM:
    case types.FILTER:
    case types.GRAPH:
    case types.REDUCED:
    case types.SERVICE:
    case types.SLICE:
    case types.UNION:
    case types.VALUES: return translateSinglePattern(c, op);
    case types.ORDER_BY: return translateOrderBy(c, op);
    case types.GROUP: return translateGroup(c, op);
    case types.EXTEND: return translateExtend(c, op);
    case types.JOIN: return translateJoin(c, op);
    case types.LEFT_JOIN: return translateLeftJoin(c, op);
    case types.MINUS: return translateMinus(c, op);
    default:
      throw new Error(`Unknown Operation type ${op.type}`);
  }
}

/**
 * These get translated in the project function
 */
export function translateBoundAggregate(c: AstContext, op: Algebra.BoundAggregate): Algebra.BoundAggregate {
  return op;
}

export function translateBgp(c: AstContext, op: Algebra.Bgp): PatternBgp {
  const F = c.astFactory;
  const patterns = op.patterns.map(triple => translatePattern(c, triple));
  return F.patternBgp(patterns, F.gen());
}

/**
 * A from needs to be registered to the solutionModifiers.
 * Similar to {@link translateDistinct}
 */
export function translateFrom(c: AstContext, op: Algebra.From): PatternGroup {
  const result = translatePatternIntoGroup(c, op.input);
  const query = <QueryBase> result.patterns[0];
  query.datasets = translateDatasetClauses(c, op.default, op.named);
  return result;
}

/**
 * A patternFilter closes the group
 */
export function translateFilter(c: AstContext, op: Algebra.Filter): PatternGroup {
  const F = c.astFactory;
  return F.patternGroup(
    Util.flatten([
      translatePatternNew(c, op.input),
      F.patternFilter(translatePureExpression(c, op.expression), F.gen()),
    ]),
    F.gen(),
  );
}

export function translateGraph(c: AstContext, op: Algebra.Graph): PatternGraph {
  const F = c.astFactory;
  return F.patternGraph(
    translateTerm(c, op.name),
    Util.flatten([ translatePatternNew(c, op.input) ]),
    F.gen(),
  );
}

/**
 * A group needs to be handled by {@link translateProject}
 */
export function translateGroup(c: AstContext, op: Algebra.Group): Pattern | Pattern[] {
  const input = translatePatternNew(c, op.input);
  const aggs = op.aggregates.map(x => translateBoundAggregate(c, x));
  c.aggregates.push(...aggs);
  // TODO: apply possible extends
  c.group.push(...op.variables);
  return input;
}

export function translateJoin(c: AstContext, op: Algebra.Join): Pattern[] {
  const F = c.astFactory;
  const arr = Util.flatten(op.input.map(x => translatePatternNew(c, x)));

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
}

export function translateLeftJoin(c: AstContext, op: Algebra.LeftJoin): Pattern[] {
  const F = c.astFactory;
  const leftJoin = F.patternOptional(
    operationInputAsPatternList(c, op.input[1]),
    F.gen(),
  );

  if (op.expression) {
    leftJoin.patterns.push(
      F.patternFilter(translatePureExpression(c, op.expression), F.gen()),
    );
  }
  leftJoin.patterns = leftJoin.patterns.filter(Boolean);

  return Util.flatten([
    translatePatternNew(c, op.input[0]),
    leftJoin,
  ]);
}

export function translateMinus(c: AstContext, op: Algebra.Minus): Pattern[] {
  const F = c.astFactory;
  return Util.flatten([
    translatePatternNew(c, op.input[0]),
    F.patternMinus(operationInputAsPatternList(c, op.input[1]), F.gen()),
  ]);
}

export function translateService(c: AstContext, op: Algebra.Service): PatternService {
  const F = c.astFactory;
  return F.patternService(
    translateTerm(c, op.name),
    operationInputAsPatternList(c, op.input),
    op.silent,
    F.gen(),
  );
}

/**
 * Unwrap single group patterns, create array if it was not yet.
 */
function operationInputAsPatternList(c: AstContext, input: Algebra.Operation): Pattern[] {
  const result = translatePatternNew(c, input);
  // If (result && F.isPatternGroup(result)) {
  //   return result.patterns;
  // }
  return result ? (Array.isArray(result) ? result : [ result ]) : [];
}

/**
 * A limit offset needs to be registered to the solutionModifiers.
 * Similar to {@link translateDistinct}
 */
export function translateSlice(c: AstContext, op: Algebra.Slice): PatternGroup {
  const F = c.astFactory;
  const result = translatePatternIntoGroup(c, op.input);
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
}

export function wrapInPatternGroup(c: AstContext, input: Pattern[] | Pattern): PatternGroup {
  const F = c.astFactory;
  if (!Array.isArray(input)) {
    return F.patternGroup([ input ], F.gen());
  }
  return F.patternGroup(input, F.gen());
}

export function translateUnion(c: AstContext, op: Algebra.Union): PatternUnion {
  const F = c.astFactory;
  return F.patternUnion(
    op.input.map(operation => wrapInPatternGroup(c, operationInputAsPatternList(c, operation))),
    F.gen(),
  );
}

export function translateValues(c: AstContext, op: Algebra.Values): PatternValues {
  // TODO: check if handled correctly when outside of select block - the answer is no
  //  - we always bring it within the group, but does it matter?
  const F = c.astFactory;
  return F.patternValues(
    op.bindings.map((binding) => {
      const result: ValuePatternRow = {};
      for (const v of op.variables) {
        const s = v.value;
        if (binding[s]) {
          result[s] = translateTerm(c, binding[s]);
        } else {
          result[s] = undefined;
        }
      }
      return result;
    }),
    F.gen(),
  );
}
