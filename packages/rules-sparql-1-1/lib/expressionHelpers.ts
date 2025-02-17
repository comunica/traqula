import { unCapitalize } from '@traqula/core';
import type { TokenType } from 'chevrotain';
import { expression, expressionList } from './grammar/expression';
import { blank, var_ } from './grammar/general';
import { groupGraphPattern } from './grammar/whereClause';
import * as l from './lexer';
import type { ExpressionAggregateDefault } from './RoundTripTypes';
import type { Expression, OperationExpression, Pattern, SparqlGrammarRule, VariableTerm } from './Sparql11types';
import type { ITOS } from './TypeHelpersRTT';
import { deGroupSingle } from './utils';

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

export type RuleDefExpressionAggregatorX<T extends string> = SparqlGrammarRule<T, ExpressionAggregateDefault>;

export function baseAggregateFunc<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionAggregatorX<Uncapitalize<T>> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, SUBRULE, OPTION, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4 }) => ({ factory: F }) => {
      const i0 = SUBRULE1(blank, undefined);
      const img1 = CONSUME(func).image;
      const i1 = SUBRULE2(blank, undefined);
      CONSUME(l.symbols.LParen);
      let i2: ITOS | undefined;
      let img2: string | undefined;
      OPTION(() => {
        i2 = SUBRULE3(blank, undefined);
        img2 = CONSUME(l.distinct).image;
      });
      const expr1 = SUBRULE(expression, undefined);
      const i3 = SUBRULE4(blank, undefined);
      CONSUME(l.symbols.RParen);

      return F.aggregate(i0, i1, i2, i3, img1, img2, [ expr1 ]);
    },
  };
}
