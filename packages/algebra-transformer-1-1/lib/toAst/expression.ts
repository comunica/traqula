import type {
  ExpressionAggregate,
  ExpressionFunctionCall,
  ExpressionOperation,
  ExpressionPatternOperation,
  Ordering,
  Pattern,
  PatternGroup,
  Wildcard,
} from '@traqula/rules-sparql-1-1';
import type { Algebra } from '../index';
import Util from '../util';
import type { AstContext } from './core';
import { translateTerm } from './general';
import { translateExpression, translateOperation } from './pattern';

export function translateAggregateExpression(c: AstContext, expr: Algebra.AggregateExpression): ExpressionAggregate {
  const F = c.astFactory;
  return F.aggregate(
    expr.aggregator,
    expr.distinct,
    translateExpression(c, expr.expression),
    expr.separator,
    F.gen(),
  );
}

export function translateExistenceExpression(
  c: AstContext,
  expr: Algebra.ExistenceExpression,
): ExpressionPatternOperation {
  const F = c.astFactory;
  return F.expressionPatternOperation(
    expr.not ? 'notexists' : 'exists',
    F.patternGroup(Util.flatten([ translateOperation(c, expr.input) ]), F.gen()),
    F.gen(),
  );
}

export function translateNamedExpression(c: AstContext, expr: Algebra.NamedExpression): ExpressionFunctionCall {
  const F = c.astFactory;
  return F.expressionFunctionCall(
    translateTerm(c, expr.name),
    expr.args.map(x => translateExpression(c, x)),
    false,
    F.gen(),
  );
}

export function translateOperatorExpression(
  c: AstContext,
  expr: Algebra.OperatorExpression,
): Ordering | ExpressionOperation {
  const F = c.astFactory;
  if (expr.operator === 'desc') {
    return { expression: translateExpression(c, expr.args[0]), descending: true, loc: F.gen() };
  }

  return F.expressionOperation(
    expr.operator,
    expr.args.map(x => translateExpression(c, x)),
    F.gen(),
  );
}

// eslint-disable-next-line unused-imports/no-unused-vars
export function translateWildcardExpression(c: AstContext, expr: Algebra.WildcardExpression): Wildcard {
  const F = c.astFactory;
  return F.wildcard(F.gen());
}

export function arrayToPattern(c: AstContext, input: Pattern[]): PatternGroup {
  const F = c.astFactory;
  if (!Array.isArray(input)) {
    return F.patternGroup([ input ], F.gen());
  }
  return F.patternGroup(input, F.gen());
}
