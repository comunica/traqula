import { unCapitalize } from '@traqula/core';
import type { TokenType } from 'chevrotain';
import { expression, expressionList } from './grammar/expression';
import { blank, var_ } from './grammar/general';
import { groupGraphPattern } from './grammar/whereClause';
import * as l from './lexer';
import type {
  Expression,
  ExpressionAggregateDefault,
  ExpressionOperation,
  ExpressionPatternOperation,
  TermVariable,
} from './RoundTripTypes';
import type { SparqlGrammarRule } from './Sparql11types';
import type { ITOS } from './TypeHelpersRTT';

export type ExpressionFunctionX<U extends Expression[]> = ExpressionOperation & {
  args: U;
};

export type RuleDefExpressionFunctionX<T extends string, U extends Expression[]>
  = SparqlGrammarRule<T, ExpressionFunctionX<U>>;

export function funcExpr1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3 }) => (C) => {
      const operator = CONSUME(func).image;
      const i0 = SUBRULE1(blank, undefined);
      CONSUME(l.symbols.LParen);
      const i1 = SUBRULE2(blank, undefined);
      const arg = SUBRULE(expression, undefined);
      CONSUME(l.symbols.RParen);
      const i2 = SUBRULE3(blank, undefined);
      return ACTION(() =>
        C.factory.expressionOperation({ args: [ arg ], img1: operator, ignored: [ i0, i1, i2 ]}));
    },
  };
}

export function funcExpr2<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression, Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4 }) => (C) => {
      const operator = CONSUME(func).image;
      const i0 = SUBRULE1(blank, undefined);
      CONSUME(l.symbols.LParen);
      const i1 = SUBRULE2(blank, undefined);
      const arg1 = SUBRULE1(expression, undefined);
      CONSUME(l.symbols.comma);
      const i2 = SUBRULE3(blank, undefined);
      const arg2 = SUBRULE2(expression, undefined);
      CONSUME(l.symbols.RParen);
      const i3 = SUBRULE4(blank, undefined);
      return ACTION(() =>
        C.factory.expressionOperation({ args: [ arg1, arg2 ], img1: operator, ignored: [ i0, i1, i2, i3 ]}));
    },
  };
}

export function funcExpr3<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression, Expression, Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, CONSUME, CONSUME1, CONSUME2, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, SUBRULE5 }) => (C) => {
      const operator = CONSUME(func).image;
      const i0 = SUBRULE1(blank, undefined);
      CONSUME(l.symbols.LParen);
      const i1 = SUBRULE2(blank, undefined);
      const arg1 = SUBRULE1(expression, undefined);
      CONSUME1(l.symbols.comma);
      const i2 = SUBRULE3(blank, undefined);
      const arg2 = SUBRULE2(expression, undefined);
      CONSUME2(l.symbols.comma);
      const i3 = SUBRULE4(blank, undefined);
      const arg3 = SUBRULE3(expression, undefined);
      CONSUME(l.symbols.RParen);
      const i4 = SUBRULE5(blank, undefined);

      return ACTION(() =>
        C.factory.expressionOperation({ args: [ arg1, arg2, arg3 ], img1: operator, ignored: [ i0, i1, i2, i3, i4 ]}));
    },
  };
}

export function funcVar1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [TermVariable]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3 }) => (C) => {
      const operator = CONSUME(func).image;
      const i0 = SUBRULE1(blank, undefined);
      CONSUME(l.symbols.LParen);
      const i1 = SUBRULE2(blank, undefined);
      const arg = SUBRULE(var_, undefined);
      CONSUME(l.symbols.RParen);
      const i2 = SUBRULE3(blank, undefined);
      return ACTION(() =>
        C.factory.expressionOperation({ args: [ arg ], img1: operator, ignored: [ i0, i1, i2 ]}));
    },
  };
}

export function funcExprOrNil1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [] | [Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, CONSUME, OR, SUBRULE, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4 }) => (C) => {
      const operator = CONSUME(func).image;
      const i0 = SUBRULE1(blank, undefined);
      return OR<ExpressionFunctionX<[] | [Expression]>>([
        { ALT: () => {
          CONSUME(l.symbols.LParen);
          const i1 = SUBRULE2(blank, undefined);
          const arg = SUBRULE(expression, undefined);
          CONSUME(l.symbols.RParen);
          const i2 = SUBRULE3(blank, undefined);
          return ACTION(() =>
            C.factory.expressionOperation({ args: [ arg ], img1: operator, ignored: [ i0, i1, i2 ]}));
        } },
        { ALT: () => {
          const nil = CONSUME(l.terminals.nil).image.slice(1, -1);
          const i1 = SUBRULE4(blank, undefined);
          return ACTION(() => C.factory.expressionOperation({
            args: [],
            img1: operator,
            ignored: [ i0, [ C.factory.blankSpace(nil) ], i1 ],
          }));
        } },
      ]);
    },
  };
}

export function funcNil1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, []> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2 }) => (C) => {
      const operator = CONSUME(func).image;
      const i0 = SUBRULE1(blank, undefined);
      const nil = CONSUME(l.terminals.nil).image.slice(1, -1);
      const i1 = SUBRULE2(blank, undefined);
      return ACTION(() => C.factory.expressionOperation({
        args: [ ],
        img1: operator,
        ignored: [ i0, i1, [ C.factory.blankSpace(nil) ]],
      }));
    },
  };
}

export function funcExprList1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, Expression[]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, CONSUME, SUBRULE }) => (C) => {
      const operator = CONSUME(func).image;
      const i0 = SUBRULE(blank, undefined);
      const args = SUBRULE(expressionList, undefined);
      return ACTION(() =>
        C.factory.expressionOperation({ args: args.val, img1: operator, ignored: [ i0, ...args.ignored ]}));
    },
  };
}

export function funcExpr2or3<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression, Expression] | [Expression, Expression, Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, SUBRULE5, CONSUME1, OPTION, CONSUME2 }) =>
      (C) => {
        const operator = CONSUME(func).image;
        const i0 = SUBRULE1(blank, undefined);
        CONSUME(l.symbols.LParen);
        const i1 = SUBRULE2(blank, undefined);
        const arg1 = SUBRULE1(expression, undefined);
        CONSUME1(l.symbols.comma);
        const i2 = SUBRULE3(blank, undefined);
        const arg2 = SUBRULE2(expression, undefined);
        const arg3 = OPTION(() => {
          CONSUME2(l.symbols.comma);
          const i3 = SUBRULE4(blank, undefined);
          const arg3 = SUBRULE3(expression, undefined);
          return { i3, arg3 };
        });
        CONSUME(l.symbols.RParen);
        const i4 = SUBRULE5(blank, undefined);
        return ACTION(() => C.factory.expressionOperation({
          args: arg3 ? [ arg1, arg2, arg3.arg3 ] : [ arg1, arg2 ],
          img1: operator,
          ignored: arg3 ? [ i0, i1, i2, arg3.i3, i4 ] : [ i0, i1, i2, i4 ],
        }));
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
    impl: ({
      ACTION,
      CONSUME,
      SUBRULE1,
      SUBRULE2,
      SUBRULE3,
      SUBRULE4,
      SUBRULE5,
      SUBRULE6,
      CONSUME1,
      OPTION,
      CONSUME2,
      CONSUME3,
    }) =>
      (C) => {
        const operator = CONSUME(func).image;
        const i0 = SUBRULE1(blank, undefined);
        CONSUME(l.symbols.LParen);
        const i1 = SUBRULE2(blank, undefined);
        const arg1 = SUBRULE1(expression, undefined);
        CONSUME1(l.symbols.comma);
        const i2 = SUBRULE3(blank, undefined);
        const arg2 = SUBRULE2(expression, undefined);
        CONSUME2(l.symbols.comma);
        const i3 = SUBRULE4(blank, undefined);
        const arg3 = SUBRULE3(expression, undefined);
        const arg4 = OPTION(() => {
          CONSUME3(l.symbols.comma);
          const i4 = SUBRULE5(blank, undefined);
          const arg4 = SUBRULE4(expression, undefined);
          return { arg4, i4 };
        });
        CONSUME(l.symbols.RParen);
        const i5 = SUBRULE6(blank, undefined);
        return ACTION(() => C.factory.expressionOperation({
          args: arg4 ? [ arg1, arg2, arg3, arg4.arg4 ] : [ arg1, arg2, arg3 ],
          img1: operator,
          ignored: arg4 ? [ i0, i1, i2, i3, arg4.i4, i5 ] : [ i0, i1, i2, i3, i5 ],
        }));
      },
  };
}

export function funcGroupGraphPattern<T extends string>(func: TokenType & { name: T }):
SparqlGrammarRule<Uncapitalize<T>, ExpressionPatternOperation> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
      const operator = CONSUME(func).image;
      const i0 = SUBRULE(blank, undefined);
      const group = SUBRULE(groupGraphPattern, undefined);
      return ACTION(() => C.factory.expressionPatternOperation({
        i0,
        img1: operator,
        args: [ C.factory.deGroupSingle(group)(undefined) ],
      }));
    },
  };
}

export type RuleDefExpressionAggregatorX<T extends string> = SparqlGrammarRule<T, ExpressionAggregateDefault>;

export function baseAggregateFunc<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionAggregatorX<Uncapitalize<T>> {
  return {
    name: unCapitalize(func.name),
    impl: ({ ACTION, CONSUME, SUBRULE, OPTION, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4 }) => (C) => {
      const img1 = CONSUME(func).image;
      const i0 = SUBRULE1(blank, undefined);
      CONSUME(l.symbols.LParen);
      const i1 = SUBRULE2(blank, undefined);
      let i2: ITOS | undefined;
      let img2: string | undefined;
      OPTION(() => {
        img2 = CONSUME(l.distinct).image;
        i2 = SUBRULE3(blank, undefined);
      });
      const expr1 = SUBRULE(expression, undefined);
      CONSUME(l.symbols.RParen);
      const i3 = SUBRULE4(blank, undefined);

      return ACTION(() => C.factory.aggregate(i0, i1, i2, i3, img1, img2, expr1));
    },
  };
}
