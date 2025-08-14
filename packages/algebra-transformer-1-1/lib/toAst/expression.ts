import type {
  Expression,
  ExpressionAggregate,
  ExpressionFunctionCall,
  ExpressionOperation,
  ExpressionPatternOperation,
  Ordering,
  Wildcard,
} from '@traqula/rules-sparql-1-1';
import type { Algebra } from '../index';
import Util from '../util';
import type { AstContext } from './core';
import { eTypes } from './core';
import { translateTerm } from './general';
import { translatePatternNew } from './pattern';

export function translatePureExpression(c: AstContext, expr: Algebra.Expression): Expression {
  switch (expr.expressionType) {
    case eTypes.AGGREGATE:
      return translateAggregateExpression(c, expr);
    case eTypes.EXISTENCE:
      return translateExistenceExpression(c, expr);
    case eTypes.NAMED:
      return translateNamedExpression(c, expr);
    case eTypes.OPERATOR:
      return translatePureOperatorExpression(c, expr);
    case eTypes.TERM:
      return <Expression>translateTerm(c, expr.term);
    default:
      throw new Error(`Unknown Expression Operation type ${expr.expressionType}`);
  }
}

export function translateExpressionOrWild(c: AstContext, expr: Algebra.Expression): Expression | Wildcard {
  switch (expr.expressionType) {
    case eTypes.WILDCARD:
      return translateWildcardExpression(c, expr);
    default:
      return translatePureExpression(c, expr);
  }
}

export function translateExpressionOrOrdering(c: AstContext, expr: Algebra.Expression): Expression | Ordering {
  switch (expr.expressionType) {
    case eTypes.OPERATOR:
      return translateOperatorExpression(c, expr);
    default:
      return translatePureExpression(c, expr);
  }
}

export function translateAnyExpression(c: AstContext, expr: Algebra.Expression): Expression | Ordering | Wildcard {
  switch (expr.expressionType) {
    case eTypes.OPERATOR:
      return translateOperatorExpression(c, expr);
    default:
      return translateExpressionOrWild(c, expr);
  }
}

function translateAggregateExpression(c: AstContext, expr: Algebra.AggregateExpression): ExpressionAggregate {
  const F = c.astFactory;
  return F.aggregate(
    expr.aggregator,
    expr.distinct,
    translateExpressionOrWild(c, expr.expression),
    expr.separator,
    F.gen(),
  );
}

function translateExistenceExpression(
  c: AstContext,
  expr: Algebra.ExistenceExpression,
): ExpressionPatternOperation {
  const F = c.astFactory;
  return F.expressionPatternOperation(
    expr.not ? 'notexists' : 'exists',
    // TranslateOperation can give an array
    F.patternGroup(Util.flatten([ translatePatternNew(c, expr.input) ]), F.gen()),
    F.gen(),
  );
}

function translateNamedExpression(c: AstContext, expr: Algebra.NamedExpression): ExpressionFunctionCall {
  const F = c.astFactory;
  return F.expressionFunctionCall(
    translateTerm(c, expr.name),
    expr.args.map(x => translatePureExpression(c, x)),
    false,
    F.gen(),
  );
}

export function translatePureOperatorExpression(
  c: AstContext,
  expr: Algebra.OperatorExpression,
): ExpressionOperation {
  const F = c.astFactory;
  return F.expressionOperation(
    expr.operator,
    expr.args.map(x => translatePureExpression(c, x)),
    F.gen(),
  );
}

export function translateOperatorExpression(
  c: AstContext,
  expr: Algebra.OperatorExpression,
): Ordering | ExpressionOperation {
  const F = c.astFactory;
  if (expr.operator === 'desc') {
    return { expression: translatePureExpression(c, expr.args[0]), descending: true, loc: F.gen() };
  }
  return translatePureOperatorExpression(c, expr);
}

function translateWildcardExpression(c: AstContext, _expr: Algebra.WildcardExpression): Wildcard {
  const F = c.astFactory;
  return F.wildcard(F.gen());
}
