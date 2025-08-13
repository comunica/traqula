import type {
  Expression,
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
import type { Algebra } from '../index';
import { types } from '../toAlgebra/core';
import Util from '../util';
import type { AstContext } from './core';
import { eTypes } from './core';
import {
  wrapInPatternGroup,
  translateAggregateExpression,
  translateExistenceExpression,
  translateNamedExpression,
  translateOperatorExpression,
  translateWildcardExpression,
} from './expression';
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
import {
  translateAdd,
  translateClear,
  translateCompositeUpdate,
  translateCopy,
  translateCreate,
  translateDeleteInsert,
  translateDrop,
  translateLoad,
  translateMove,
} from './updateUnit';

export function translateOperation(c: AstContext, op: Algebra.Operation): any {
  // This allows us to differentiate between BIND and SELECT when translating EXTEND
  // GRAPH was added because the way graphs get added back here is not the same as how they get added in the future
  // ^ seems fine but might have to be changed if problems get detected in the future
  if (op.type !== types.EXTEND && op.type !== types.ORDER_BY && op.type !== types.GRAPH) {
    c.project = false;
  }

  switch (op.type) {
    case types.EXPRESSION: return translateExpression(c, op);
    case types.ASK: return translateProject(c, op, types.ASK);
    case types.BGP: return translateBgp(c, op);
    case types.CONSTRUCT: return translateConstruct(c, op);
    case types.DESCRIBE: return translateProject(c, op, types.DESCRIBE);
    case types.DISTINCT: return translateDistinct(c, op);
    case types.EXTEND: return translateExtend(c, op);
    case types.FROM: return translateFrom(c, op);
    case types.FILTER: return translateFilter(c, op);
    case types.GRAPH: return translateGraph(c, op);
    case types.GROUP: return translateGroup(c, op);
    case types.JOIN: return translateJoin(c, op);
    case types.LEFT_JOIN: return translateLeftJoin(c, op);
    case types.MINUS: return translateMinus(c, op);
    case types.NOP: return {};
    case types.ORDER_BY: return translateOrderBy(c, op);
    case types.PATH: return translatePath(c, op);
    case types.PATTERN: return translatePattern(c, op);
    case types.PROJECT: return translateProject(c, op, types.PROJECT);
    case types.REDUCED: return translateReduced(c, op);
    case types.SERVICE: return translateService(c, op);
    case types.SLICE: return translateSlice(c, op);
    case types.UNION: return translateUnion(c, op);
    case types.VALUES: return translateValues(c, op);
    // UPDATE operations
    case types.COMPOSITE_UPDATE: return translateCompositeUpdate(c, op);
    case types.DELETE_INSERT: return translateDeleteInsert(c, op);
    case types.LOAD: return translateLoad(c, op);
    case types.CLEAR: return translateClear(c, op);
    case types.CREATE: return translateCreate(c, op);
    case types.DROP: return translateDrop(c, op);
    case types.ADD: return translateAdd(c, op);
    case types.MOVE: return translateMove(c, op);
    case types.COPY: return translateCopy(c, op);
    default:
      throw new Error(`Unknown Operation type ${op.type}`);
  }
}

export function translateExpression(c: AstContext, expr: Algebra.Expression): Expression {
  switch (expr.expressionType) {
    case eTypes.AGGREGATE: return translateAggregateExpression(c, expr);
    case eTypes.EXISTENCE: return translateExistenceExpression(c, expr);
    case eTypes.NAMED: return translateNamedExpression(c, expr);
    case eTypes.OPERATOR: return <any> translateOperatorExpression(c, expr);
    case eTypes.TERM: return <Expression> translateTerm(c, expr.term);
    case eTypes.WILDCARD: return <any> translateWildcardExpression(c, expr);
  }

  throw new Error(`Unknown Expression Operation type ${(<Expression> expr).subType}`);
}

/**
 * These get translated in the project function
 */
export function translateBoundAggregate(c: AstContext, op: Algebra.BoundAggregate): Algebra.BoundAggregate {
  return op;
}

export function translateBgp(c: AstContext, op: Algebra.Bgp): PatternBgp | null {
  const F = c.astFactory;
  const patterns = op.patterns.map(triple => translatePattern(c, triple));
  if (patterns.length === 0) {
    return null;
  }
  return F.patternBgp(patterns, F.gen());
}

/**
 * A from needs to be registered to the solutionModifiers.
 * Similar to {@link translateDistinct}
 */
export function translateFrom(c: AstContext, op: Algebra.From): PatternGroup {
  const result: PatternGroup = translateOperation(c, op.input);
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
    Util.flatten ([
      translateOperation(c, op.input),
      F.patternFilter(translateExpression(c, op.expression), F.gen()),
    ]),
    F.gen(),
  );
}

export function translateGraph(c: AstContext, op: Algebra.Graph): PatternGraph {
  const F = c.astFactory;
  return F.patternGraph(
    translateTerm(c, op.name),
    Util.flatten<Pattern>([ translateOperation(c, op.input) ]),
    F.gen(),
  );
}

/**
 * A group needs to be handled by {@link translateProject}
 */
export function translateGroup(c: AstContext, op: Algebra.Group): PatternGroup {
  const input: PatternGroup = translateOperation(c, op.input);
  const aggs = op.aggregates.map(x => translateBoundAggregate(c, x));
  c.aggregates.push(...aggs);
  // TODO: apply possible extends
  c.group.push(...op.variables);
  return input;
}

export function translateJoin(c: AstContext, op: Algebra.Join): Pattern[] {
  const F = c.astFactory;
  const arr: Pattern[] = Util.flatten(op.input.map(x => translateOperation(c, x)));

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
      F.patternFilter(translateExpression(c, op.expression), F.gen()),
    );
  }
  leftJoin.patterns = leftJoin.patterns.filter(Boolean);

  return Util.flatten([
    translateOperation(c, op.input[0]),
    leftJoin,
  ]);
}

export function translateMinus(c: AstContext, op: Algebra.Minus): Pattern[] {
  const F = c.astFactory;
  return Util.flatten([
    translateOperation(c, op.input[0]),
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
  const result = <Pattern[] | Pattern | null> translateOperation(c, input);
  // If (result && F.isPatternGroup(result)) {
  //   return result.patterns;
  // }
  return result ? (Array.isArray(result) ? result : [ result ]) : [];
}

/**
 * A limit offset needs to be registered to the solutionModifiers.
 * Similar to {@link translateDistinct}
 */
export function translateSlice(c: AstContext, op: Algebra.Slice): Pattern {
  const F = c.astFactory;
  const result: PatternGroup = translateOperation(c, op.input);
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
  return <Pattern> result;
}

export function translateUnion(c: AstContext, op: Algebra.Union): PatternUnion {
  const F = c.astFactory;
  return F.patternUnion(
    op.input
      .map(operation => <Pattern | Pattern[]>translateOperation(c, operation))
      .map(pattern => wrapInPatternGroup(c, pattern)),
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
