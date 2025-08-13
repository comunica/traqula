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
  arrayToPattern,
  translateAggregateExpression,
  translateExistenceExpression,
  translateNamedExpression,
  translateOperatorExpression,
  translateWildcardExpression,
} from './expression';
import {
  translateDatasetClauses,
  translateExtend,
  translateOrderBy,
  translatePath,
  translatePattern,
  translateReduced,
  translateTerm,
} from './general';
import { translateConstruct, translateDistinct, translateProject } from './queryUnit';
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
  const patterns = op.patterns.map(x => translatePattern(c, x));
  if (patterns.length === 0) {
    return null;
  }
  return F.patternBgp(patterns, F.gen());
}

/**
 * Input of from is for example a project
 */
export function translateFrom(c: AstContext, op: Algebra.From): PatternGroup {
  const F = c.astFactory;
  const result: QueryBase | PatternGroup = translateOperation(c, op.input);
  let query: QueryBase;
  if (F.isPatternGroup(result)) {
    query = <QueryBase> <unknown> result.patterns[0];
  } else {
    query = result;
  }
  query.datasets = translateDatasetClauses(c, op.default, op.named);
  return <PatternGroup> result;
}

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
    Util.flatten([ translateOperation(c, op.input) ]),
    F.gen(),
  );
}

export function translateGroup(c: AstContext, op: Algebra.Group): PatternGroup {
  const input = translateOperation(c, op.input);
  const aggs = op.aggregates.map(x => translateBoundAggregate(c, x));
  c.aggregates.push(...aggs);
  // TODO: apply possible extends
  c.group.push(...op.variables);

  return input;
}

export function translateJoin(c: AstContext, op: Algebra.Join): Pattern[] {
  const arr: any[] = Util.flatten(op.input.map(x => translateOperation(c, x)));

  // Merge bgps
  // This is possible if one side was a path and the other a bgp for example
  return arr.reduce((result, val) => {
    if (val.type !== 'bgp' || result.length === 0 || result.at(-1).type !== 'bgp') {
      result.push(val);
    } else {
      result.at(-1).triples.push(...val.triples);
    }
    return result;
  }, []);
}

export function translateLeftJoin(c: AstContext, op: Algebra.LeftJoin): Pattern[] {
  const F = c.astFactory;
  const leftJoin = F.patternOptional(
    arrayToPattern(c, translateOperation(c, op.input[1])).patterns,
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
  let patterns = translateOperation(c, op.input[1]);
  if (patterns.type === 'group') {
    patterns = patterns.patterns;
  }
  if (!Array.isArray(patterns)) {
    patterns = [ patterns ];
  }
  return Util.flatten([
    translateOperation(c, op.input[0]),
    F.patternMinus(patterns, F.gen()),
  ]);
}

export function translateService(c: AstContext, op: Algebra.Service): PatternService {
  const F = c.astFactory;
  let patterns: Pattern | Pattern[] = <Pattern> translateOperation(c, op.input);
  if (F.isPatternGroup(patterns)) {
    patterns = patterns.patterns;
  }
  if (!Array.isArray(patterns)) {
    patterns = [ patterns ];
  }
  return F.patternService(
    translateTerm(c, op.name),
    patterns,
    op.silent,
    F.gen(),
  );
}

export function translateSlice(c: AstContext, op: Algebra.Slice): Pattern {
  const F = c.astFactory;
  const result = <Pattern> translateOperation(c, op.input);
  // Results can be nested in a group object
  let castedRes = <any> result;
  if (F.isPatternGroup(result)) {
    castedRes = result.patterns[0];
  }
  if (op.start !== 0) {
    const query = <QueryBase> castedRes;
    query.solutionModifiers.limitOffset = query.solutionModifiers.limitOffset ??
      F.solutionModifierLimitOffset(undefined, op.start, F.gen());
    query.solutionModifiers.limitOffset.offset = op.start;
  }
  if (op.length !== undefined) {
    const query = <QueryBase> castedRes;
    query.solutionModifiers.limitOffset = query.solutionModifiers.limitOffset ??
      F.solutionModifierLimitOffset(op.length, undefined, F.gen());
    query.solutionModifiers.limitOffset.limit = op.length;
  }
  return result;
}

export function translateUnion(c: AstContext, op: Algebra.Union): PatternUnion {
  const F = c.astFactory;
  return F.patternUnion(
    op.input.map(x => translateOperation(c, x)).map(x => arrayToPattern(c, x)),
    F.gen(),
  );
}

export function translateValues(c: AstContext, op: Algebra.Values): PatternValues {
  // TODO: check if handled correctly when outside of select block
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
