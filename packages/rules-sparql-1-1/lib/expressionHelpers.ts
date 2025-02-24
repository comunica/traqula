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

function formatOperator(operator: string): string {
  return operator.toLowerCase().replaceAll(' ', '');
}

export function funcExpr1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ SUBRULE, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3 }) => () => {
      const i0 = SUBRULE1(blank, undefined);
      const operator = CONSUME(func).image;
      const i1 = SUBRULE2(blank, undefined);
      CONSUME(l.symbols.LParen);
      const arg = SUBRULE(expression, undefined);
      const i2 = SUBRULE3(blank, undefined);
      CONSUME(l.symbols.RParen);

      return {
        type: 'expression',
        expressionType: 'operation',
        operator: formatOperator(operator),
        args: [ arg ],
        RTT: {
          img1: operator,
          ignored: [ i0, i1, i2 ],
        },
      };
    },
  };
}

export function funcExpr2<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression, Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4 }) => () => {
      const i0 = SUBRULE1(blank, undefined);
      const operator = CONSUME(func).image;
      const i1 = SUBRULE2(blank, undefined);
      CONSUME(l.symbols.LParen);
      const arg1 = SUBRULE1(expression, undefined);
      const i2 = SUBRULE3(blank, undefined);
      CONSUME(l.symbols.comma);
      const arg2 = SUBRULE2(expression, undefined);
      const i3 = SUBRULE4(blank, undefined);
      CONSUME(l.symbols.RParen);
      return {
        type: 'expression',
        expressionType: 'operation',
        operator: formatOperator(operator),
        args: [ arg1, arg2 ],
        RTT: {
          img1: operator,
          ignored: [ i0, i1, i2, i3 ],
        },
      };
    },
  };
}

export function funcExpr3<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression, Expression, Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, CONSUME1, CONSUME2, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, SUBRULE5 }) => () => {
      const i0 = SUBRULE1(blank, undefined);
      const operator = CONSUME(func).image;
      const i1 = SUBRULE2(blank, undefined);
      CONSUME(l.symbols.LParen);
      const arg1 = SUBRULE1(expression, undefined);
      const i2 = SUBRULE3(blank, undefined);
      CONSUME1(l.symbols.comma);
      const arg2 = SUBRULE2(expression, undefined);
      const i3 = SUBRULE4(blank, undefined);
      CONSUME2(l.symbols.comma);
      const arg3 = SUBRULE3(expression, undefined);
      const i4 = SUBRULE5(blank, undefined);
      CONSUME(l.symbols.RParen);

      return {
        type: 'expression',
        expressionType: 'operation',
        operator: formatOperator(operator),
        args: [ arg1, arg2, arg3 ],
        RTT: {
          img1: operator,
          ignored: [ i0, i1, i2, i3, i4 ],
        },
      };
    },
  };
}

export function funcVar1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [TermVariable]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ SUBRULE, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3 }) => () => {
      const i0 = SUBRULE1(blank, undefined);
      const operator = CONSUME(func).image;
      const i1 = SUBRULE2(blank, undefined);
      CONSUME(l.symbols.LParen);
      const arg = SUBRULE(var_, undefined);
      const i2 = SUBRULE3(blank, undefined);
      CONSUME(l.symbols.RParen);
      return {
        type: 'expression',
        expressionType: 'operation',
        operator: formatOperator(operator),
        args: [ arg ],
        RTT: {
          img1: operator,
          ignored: [ i0, i1, i2 ],
        },
      };
    },
  };
}

export function funcExprOrNil1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [] | [Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, OR, SUBRULE, SUBRULE1, SUBRULE2, SUBRULE3 }) => ({ factory: F }) => {
      const i0 = SUBRULE1(blank, undefined);
      const operator = CONSUME(func).image;
      const i1 = SUBRULE2(blank, undefined);
      const base = <const> {
        type: 'expression',
        expressionType: 'operation',
        operator: formatOperator(operator),
      };
      return OR<ExpressionFunctionX<[] | [Expression]>>([
        { ALT: () => {
          CONSUME(l.symbols.LParen);
          const arg = SUBRULE(expression, undefined);
          const i2 = SUBRULE3(blank, undefined);
          CONSUME(l.symbols.RParen);
          return {
            ...base,
            args: [ arg ],
            RTT: {
              img1: operator,
              ignored: [ i0, i1, i2 ],
            },
          };
        } },
        { ALT: () => {
          const nil = CONSUME(l.terminals.nil).image.slice(1, -1);
          const i2: ITOS = [ F.blankSpace(nil) ];
          return {
            ...base,
            args: [],
            RTT: {
              img1: operator,
              ignored: [ i0, i1, i2 ],
            },
          };
        },
        },
      ]);
    },
  };
}

export function funcNil1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, []> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, SUBRULE1, SUBRULE2 }) => ({ factory: F }) => {
      const i0 = SUBRULE1(blank, undefined);
      const operator = CONSUME(func).image;
      const i1 = SUBRULE2(blank, undefined);
      const nil = CONSUME(l.terminals.nil).image.slice(1, -1);
      const i2: ITOS = [ F.blankSpace(nil) ];
      return {
        type: 'expression',
        expressionType: 'operation',
        operator: formatOperator(operator),
        args: [],
        RTT: {
          img1: operator,
          ignored: [ i0, i1, i2 ],
        },
      };
    },
  };
}

export function funcExprList1<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, Expression[]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, SUBRULE }) => () => {
      const i0 = SUBRULE(blank, undefined);
      const operator = CONSUME(func).image;
      const args = SUBRULE(expressionList, undefined);
      return {
        type: 'expression',
        expressionType: 'operation',
        operator: formatOperator(operator),
        args: args.val,
        RTT: {
          img1: operator,
          ignored: [ i0, ...args.ignored ],
        },
      };
    },
  };
}

export function funcExpr2or3<T extends string>(func: TokenType & { name: T }):
RuleDefExpressionFunctionX<Uncapitalize<T>, [Expression, Expression] | [Expression, Expression, Expression]> {
  return {
    name: unCapitalize(func.name),
    impl: ({ CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, CONSUME1, OPTION, CONSUME2 }) => ({ factory: F }) => {
      const i0 = SUBRULE1(blank, undefined);
      const operator = CONSUME(func).image;
      const i1 = SUBRULE2(blank, undefined);
      CONSUME(l.symbols.LParen);
      const arg1 = SUBRULE1(expression, undefined);
      const i2 = SUBRULE3(blank, undefined);
      CONSUME1(l.symbols.comma);
      const arg2 = SUBRULE2(expression, undefined);
      const arg3 = OPTION(() => {
        const i3 = SUBRULE3(blank, undefined);
        CONSUME2(l.symbols.comma);
        const arg3 = SUBRULE3(expression, undefined);
        return { i3, arg3 };
      });
      const i4 = SUBRULE3(blank, undefined);
      CONSUME(l.symbols.RParen);
      return {
        type: 'expression',
        expressionType: 'operation',
        operator: formatOperator(operator),
        args: arg3 ? [ arg1, arg2, arg3.arg3 ] : [ arg1, arg2 ],
        RTT: {
          img1: operator,
          ignored: arg3 ? [ i0, i1, i2, arg3.i3, i4 ] : [ i0, i1, i2, i4 ],
        },
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
      const i0 = SUBRULE1(blank, undefined);
      const operator = CONSUME(func).image;
      const i1 = SUBRULE2(blank, undefined);
      CONSUME(l.symbols.LParen);
      const arg1 = SUBRULE1(expression, undefined);
      const i2 = SUBRULE3(blank, undefined);
      CONSUME1(l.symbols.comma);
      const arg2 = SUBRULE2(expression, undefined);
      const i3 = SUBRULE4(blank, undefined);
      CONSUME2(l.symbols.comma);
      const arg3 = SUBRULE3(expression, undefined);
      const arg4 = OPTION(() => {
        const i4 = SUBRULE3(blank, undefined);
        CONSUME3(l.symbols.comma);
        const arg4 = SUBRULE4(expression, undefined);
        return { arg4, i4 };
      });
      const i5 = SUBRULE4(blank, undefined);
      CONSUME(l.symbols.RParen);
      return {
        type: 'expression',
        expressionType: 'operation',
        operator: formatOperator(operator),
        args: arg4 ? [ arg1, arg2, arg3, arg4.arg4 ] : [ arg1, arg2, arg3 ],
        RTT: {
          img1: operator,
          ignored: arg4 ? [ i0, i1, i2, i3, arg4.i4, i5 ] : [ i0, i1, i2, i3, i5 ],
        },
      };
    },
  };
}

export function funcGroupGraphPattern<T extends string>(func: TokenType & { name: T }):
SparqlGrammarRule<Uncapitalize<T>, ExpressionPatternOperation> {
  return {
    name: unCapitalize(func.name),
    impl: ({ SUBRULE, CONSUME }) => ({ factory: F }) => {
      const i0 = SUBRULE(blank, undefined);
      const operator = CONSUME(func).image;
      const group = SUBRULE(groupGraphPattern, undefined);
      return {
        type: 'expression',
        expressionType: 'patternOperation',
        operator: formatOperator(operator),
        args: [ F.deGroupSingle(group) ],
        RTT: {
          img1: operator,
          i0,
        },
      };
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

      return F.aggregate(i0, i1, i2, i3, img1, img2, expr1);
    },
  };
}
