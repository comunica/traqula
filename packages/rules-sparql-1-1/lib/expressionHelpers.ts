import { unCapitalize } from '@traqula/core';
import type { TokenType } from 'chevrotain';
import { expression, expressionList } from './grammar/expression';
import { var_ } from './grammar/general';
import { groupGraphPattern } from './grammar/whereClause';
import * as l from './lexer';
import type { Expression, OperationExpression, Pattern, SparqlGrammarRule, VariableTerm } from './Sparql11types';
import { deGroupSingle } from './utils';
import { Wildcard } from './Wildcard';

export interface IExpressionFunctionX<U extends Expression[] | [Pattern]> extends OperationExpression {
  type: 'operation';
  operator: string;
  args: U;
}

export type RuleDefExpressionFunctionX<T extends string, U extends Expression[] | [Pattern]>
  = SparqlGrammarRule<T, IExpressionFunctionX<U>>;

function formatOperator(operator: string): string {
  return operator.toLowerCase().replaceAll(' ', '');
}

export function funcExpr1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ SUBRULE, CONSUME }) => () => {
      const operator = CONSUME(func);
      CONSUME(l.symbols.LParen);
      const arg = SUBRULE(expression, undefined);
      CONSUME(l.symbols.RParen);
      return {
        type: 'operation',
        operator: formatOperator(operator.image),
        args: [ arg ],
      };
    },
  };
}

export function funcExpr2<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression, Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ SUBRULE1, SUBRULE2, CONSUME }) => () => {
      const operator = CONSUME(func);
      CONSUME(l.symbols.LParen);
      const arg1 = SUBRULE1(expression, undefined);
      CONSUME(l.symbols.comma);
      const arg2 = SUBRULE2(expression, undefined);
      CONSUME(l.symbols.RParen);
      return {
        type: 'operation',
        operator: formatOperator(operator.image),
        args: [ arg1, arg2 ],
      };
    },
  };
}

export function funcExpr3<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression, Expression, Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ SUBRULE1, SUBRULE2, SUBRULE3, CONSUME, CONSUME1, CONSUME2 }) => () => {
      const operator = CONSUME(func);
      CONSUME(l.symbols.LParen);
      const arg1 = SUBRULE1(expression, undefined);
      CONSUME1(l.symbols.comma);
      const arg2 = SUBRULE2(expression, undefined);
      CONSUME2(l.symbols.comma);
      const arg3 = SUBRULE3(expression, undefined);
      CONSUME(l.symbols.RParen);
      return {
        type: 'operation',
        operator: formatOperator(operator.image),
        args: [ arg1, arg2, arg3 ],
      };
    },
  };
}

export function funcVar1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [VariableTerm]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ SUBRULE, CONSUME }) => () => {
      const operator = CONSUME(func);
      CONSUME(l.symbols.LParen);
      const arg = SUBRULE(var_, undefined);
      CONSUME(l.symbols.RParen);
      return {
        type: 'operation',
        operator: formatOperator(operator.image),
        args: [ arg ],
      };
    },
  };
}

export function funcExprOrNil1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [] | [Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, OR, SUBRULE }) => () => {
      const operator = CONSUME(func);
      const args = OR<[] | [Expression]>([
        {
          ALT: () => {
            CONSUME(l.symbols.LParen);
            const arg = SUBRULE(expression, undefined);
            CONSUME(l.symbols.RParen);
            return [ arg ];
          },
        },
        {
          ALT: () => {
            CONSUME(l.terminals.nil);
            return [];
          },
        },
      ]);
      return {
        type: 'operation',
        operator: formatOperator(operator.image),
        args,
      };
    },
  };
}

export function funcNil1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, []> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME }) => () => {
      const operator = CONSUME(func);
      CONSUME(l.terminals.nil);
      return {
        type: 'operation',
        operator: formatOperator(operator.image),
        args: [],
      };
    },
  };
}

export function funcExprList1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, Expression[]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, SUBRULE }) => () => {
      const operator = CONSUME(func);
      const args = SUBRULE(expressionList, undefined);
      return {
        type: 'operation',
        operator: formatOperator(operator.image),
        args,
      };
    },
  };
}

export function funcExpr2or3<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression, Expression] | [Expression, Expression, Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, CONSUME1, OPTION, CONSUME2 }) => () => {
      const operator = CONSUME(func);
      CONSUME(l.symbols.LParen);
      const arg1 = SUBRULE1(expression, undefined);
      CONSUME1(l.symbols.comma);
      const arg2 = SUBRULE2(expression, undefined);
      const arg3 = OPTION(() => {
        CONSUME2(l.symbols.comma);
        return SUBRULE3(expression, undefined);
      });
      CONSUME(l.symbols.RParen);
      return {
        type: 'operation',
        operator: formatOperator(operator.image),
        args: arg3 ? [ arg1, arg2, arg3 ] : [ arg1, arg2 ],
      };
    },
  };
}

export function funcExpr3or4<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<
  Uncapitalize<T>,
    [Expression, Expression, Expression] | [Expression, Expression, Expression, Expression]
> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, CONSUME1, OPTION, CONSUME2, SUBRULE4, CONSUME3 }) => () => {
      const operator = CONSUME(func);
      CONSUME(l.symbols.LParen);
      const arg1 = SUBRULE1(expression, undefined);
      CONSUME1(l.symbols.comma);
      const arg2 = SUBRULE2(expression, undefined);
      CONSUME2(l.symbols.comma);
      const arg3 = SUBRULE3(expression, undefined);
      const arg4 = OPTION(() => {
        CONSUME3(l.symbols.comma);
        return SUBRULE4(expression, undefined);
      });
      CONSUME(l.symbols.RParen);
      return {
        type: 'operation',
        operator: formatOperator(operator.image),
        args: arg4 ? [ arg1, arg2, arg3, arg4 ] : [ arg1, arg2, arg3 ],
      };
    },
  };
}

export function funcGroupGraphPattern<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<
  Uncapitalize<T>,
  [ Pattern ]
> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, SUBRULE, CONSUME }) => () => {
      const operator = CONSUME(func);
      const group = SUBRULE(groupGraphPattern, undefined);
      return ACTION(() => ({
        type: 'operation',
        operator: formatOperator(operator.image),
        args: [ deGroupSingle(group) ],
      }));
    },
  };
}

export interface IExpressionAggregator {
  type: 'aggregate';
  distinct: boolean;
  expression: Expression | Wildcard;
  aggregation: string;
  separator?: string;
}

export type RuleDefExpressionAggregatorX<T extends string> = SparqlGrammarRule<T, IExpressionAggregator>;

export function baseAggregateFunc<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionAggregatorX<Uncapitalize<T>> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, SUBRULE, OPTION, OR }) => () => {
      const operator = CONSUME(func);
      CONSUME(l.symbols.LParen);
      const distinct = OPTION(() => CONSUME(l.distinct));
      const expressionVal = OR<Expression | Wildcard>([
        {
          ALT: () => {
            CONSUME(l.symbols.star);
            return new Wildcard();
          },
        },
        { ALT: () => SUBRULE(expression, undefined) },
      ]);
      CONSUME(l.symbols.RParen);
      return {
        type: 'aggregate',
        aggregation: operator.image.toLowerCase(),
        expression: expressionVal,
        distinct: Boolean(distinct),
      };
    },
  };
}
