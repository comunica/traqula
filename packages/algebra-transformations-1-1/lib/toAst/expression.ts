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
import * as util from '../util';
import type { AstIndir } from './core';
import { eTypes } from './core';
import { type RdfTermToAst, translateAlgTerm } from './general';
import { translateAlgPatternNew } from './pattern';

export const translateAlgPureExpression: AstIndir<'translatePureExpression', Expression, [Algebra.Expression]> = {
  name: 'translatePureExpression',
  fun: ({ SUBRULE }) => (_, expr) => {
    switch (expr.expressionType) {
      case eTypes.AGGREGATE:
        return SUBRULE(translateAlgAggregateExpression, expr);
      case eTypes.EXISTENCE:
        return SUBRULE(translateAlgExistenceExpression, expr);
      case eTypes.NAMED:
        return SUBRULE(translateAlgNamedExpression, expr);
      case eTypes.OPERATOR:
        return SUBRULE(translateAlgPureOperatorExpression, expr);
      case eTypes.TERM:
        return <Expression> SUBRULE(translateAlgTerm, expr.term);
      default:
        throw new Error(`Unknown Expression Operation type ${expr.expressionType}`);
    }
  },
};

export const translateAlgExpressionOrWild:
AstIndir<'translateExpressionOrWild', Expression | Wildcard, [Algebra.Expression]> = {
  name: 'translateExpressionOrWild',
  fun: ({ SUBRULE }) => (_, expr) => expr.expressionType === eTypes.WILDCARD ?
    SUBRULE(translateAlgWildcardExpression, expr) :
    SUBRULE(translateAlgPureExpression, expr),
};

export const translateAlgExpressionOrOrdering:
AstIndir<'translateExpressionOrOrdering', Expression | Ordering, [Algebra.Expression]> = {
  name: 'translateExpressionOrOrdering',
  fun: ({ SUBRULE }) => (_, expr) =>
    expr.expressionType === eTypes.OPERATOR ?
      SUBRULE(translateAlgOperatorExpression, expr) :
      SUBRULE(translateAlgPureExpression, expr),
};

export const translateAlgAnyExpression:
AstIndir<'translateAnyExpression', Expression | Ordering | Wildcard, [Algebra.Expression]> = {
  name: 'translateAnyExpression',
  fun: ({ SUBRULE }) => (_, expr) => expr.expressionType === eTypes.OPERATOR ?
    SUBRULE(translateAlgOperatorExpression, expr) :
    SUBRULE(translateAlgExpressionOrWild, expr),
};

export const translateAlgAggregateExpression:
AstIndir<'translateAggregateExpression', ExpressionAggregate, [Algebra.AggregateExpression]> = {
  name: 'translateAggregateExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) =>
    F.aggregate(
      expr.aggregator,
      expr.distinct,
      SUBRULE(translateAlgExpressionOrWild, expr.expression),
      expr.separator,
      F.gen(),
    ),
};

export const translateAlgExistenceExpression:
AstIndir<'translateExistenceExpression', ExpressionPatternOperation, [Algebra.ExistenceExpression]> = {
  name: 'translateExistenceExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) =>
    F.expressionPatternOperation(
      expr.not ? 'notexists' : 'exists',
      // TranslateOperation can give an array
      F.patternGroup(util.flatten([ SUBRULE(translateAlgPatternNew, expr.input) ]), F.gen()),
      F.gen(),
    ),
};

export const translateAlgNamedExpression:
AstIndir<'translateNamedExpression', ExpressionFunctionCall, [Algebra.NamedExpression]> = {
  name: 'translateNamedExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) =>
    F.expressionFunctionCall(
      <RdfTermToAst<typeof expr.name>> SUBRULE(translateAlgTerm, expr.name),
      expr.args.map(x => SUBRULE(translateAlgPureExpression, x)),
      false,
      F.gen(),
    ),
};

export const translateAlgPureOperatorExpression:
AstIndir<'translatePureOperatorExpression', ExpressionOperation, [Algebra.OperatorExpression]> = {
  name: 'translatePureOperatorExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) =>
    F.expressionOperation(
      expr.operator,
      expr.args.map(x => SUBRULE(translateAlgPureExpression, x)),
      F.gen(),
    ),
};

export const translateAlgOperatorExpression:
AstIndir<'translateOperatorExpression', Ordering | ExpressionOperation, [Algebra.OperatorExpression]> = {
  name: 'translateOperatorExpression',
  fun: ({ SUBRULE }) => ({ astFactory: F }, expr) => {
    if (expr.operator === 'desc') {
      return { expression: SUBRULE(translateAlgPureExpression, expr.args[0]), descending: true, loc: F.gen() };
    }
    return SUBRULE(translateAlgPureOperatorExpression, expr);
  },
};

export const translateAlgWildcardExpression:
AstIndir<'translateWildcardExpression', Wildcard, [ Algebra.WildcardExpression ]> = {
  name: 'translateWildcardExpression',
  fun: () => ({ astFactory: F }, _) =>
    F.wildcard(F.gen()),
};
