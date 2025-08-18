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
import type { AstIndir } from './core';
import { eTypes } from './core';
import { type RdfTermToAst, translateTerm } from './general';
import { translatePatternNew } from './pattern';

export const translatePureExpression: AstIndir<'translatePureExpression', Expression, [Algebra.Expression]> = {
  name: 'translatePureExpression',
  fun: ({ SUBRULE }) => (_, expr) => {
    switch (expr.expressionType) {
      case eTypes.AGGREGATE:
        return SUBRULE(translateAggregateExpression, expr);
      case eTypes.EXISTENCE:
        return SUBRULE(translateExistenceExpression, expr);
      case eTypes.NAMED:
        return SUBRULE(translateNamedExpression, expr);
      case eTypes.OPERATOR:
        return SUBRULE(translatePureOperatorExpression, expr);
      case eTypes.TERM:
        return <Expression> SUBRULE(translateTerm, expr.term);
      default:
        throw new Error(`Unknown Expression Operation type ${expr.expressionType}`);
    }
  },
};

export const translateExpressionOrWild:
AstIndir<'translateExpressionOrWild', Expression | Wildcard, [Algebra.Expression]> = {
  name: 'translateExpressionOrWild',
  fun: ({ SUBRULE }) => (_, expr) => expr.expressionType === eTypes.WILDCARD ?
    SUBRULE(translateWildcardExpression, expr) :
    SUBRULE(translatePureExpression, expr),
};

export const translateExpressionOrOrdering:
AstIndir<'translateExpressionOrOrdering', Expression | Ordering, [Algebra.Expression]> = {
  name: 'translateExpressionOrOrdering',
  fun: ({ SUBRULE }) => (_, expr) =>
    expr.expressionType === eTypes.OPERATOR ?
      SUBRULE(translateOperatorExpression, expr) :
      SUBRULE(translatePureExpression, expr),
};

export const translateAnyExpression:
AstIndir<'translateAnyExpression', Expression | Ordering | Wildcard, [Algebra.Expression]> = {
  name: 'translateAnyExpression',
  fun: ({ SUBRULE }) => (_, expr) => expr.expressionType === eTypes.OPERATOR ?
    SUBRULE(translateOperatorExpression, expr) :
    SUBRULE(translateExpressionOrWild, expr),
};

export const translateAggregateExpression:
AstIndir<'translateAggregateExpression', ExpressionAggregate, [Algebra.AggregateExpression]> = {
  name: 'translateAggregateExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) =>
    F.aggregate(
      expr.aggregator,
      expr.distinct,
      SUBRULE(translateExpressionOrWild, expr.expression),
      expr.separator,
      F.gen(),
    ),
};

export const translateExistenceExpression:
AstIndir<'translateExistenceExpression', ExpressionPatternOperation, [Algebra.ExistenceExpression]> = {
  name: 'translateExistenceExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) =>
    F.expressionPatternOperation(
      expr.not ? 'notexists' : 'exists',
      // TranslateOperation can give an array
      F.patternGroup(Util.flatten([ SUBRULE(translatePatternNew, expr.input) ]), F.gen()),
      F.gen(),
    ),
};

export const translateNamedExpression:
AstIndir<'translateNamedExpression', ExpressionFunctionCall, [Algebra.NamedExpression]> = {
  name: 'translateNamedExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) =>
    F.expressionFunctionCall(
      <RdfTermToAst<typeof expr.name>> SUBRULE(translateTerm, expr.name),
      expr.args.map(x => SUBRULE(translatePureExpression, x)),
      false,
      F.gen(),
    ),
};

export const translatePureOperatorExpression:
AstIndir<'translatePureOperatorExpression', ExpressionOperation, [Algebra.OperatorExpression]> = {
  name: 'translatePureOperatorExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) =>
    F.expressionOperation(
      expr.operator,
      expr.args.map(x => SUBRULE(translatePureExpression, x)),
      F.gen(),
    ),
};

export const translateOperatorExpression:
AstIndir<'translateOperatorExpression', Ordering | ExpressionOperation, [Algebra.OperatorExpression]> = {
  name: 'translateOperatorExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) => {
    if (expr.operator === 'desc') {
      return { expression: SUBRULE(translatePureExpression, expr.args[0]), descending: true, loc: F.gen() };
    }
    return SUBRULE(translatePureOperatorExpression, expr);
  },
};

export const translateWildcardExpression:
AstIndir<'translateWildcardExpression', Wildcard, [ Algebra.WildcardExpression ]> = {
  name: 'translateWildcardExpression',
  fun: () => ({ astFactory: F }, _) =>
    F.wildcard(F.gen()),
};
