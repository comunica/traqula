import type { IToken } from '@chevrotain/types';
import type { Wrap } from '@traqula/core';
import * as l from '../lexer';
import type {
  Expression,
  SolutionModifierGroup,
  SolutionModifierGroupBind,
  SolutionModifierHaving,
  SolutionModifierOrder,
  Ordering,
  SolutionModifierLimitOffset,
  SolutionModifiers,
} from '../RoundTripTypes';
import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import { builtInCall } from './builtIn';
import { brackettedExpression, expression } from './expression';
import { var_ } from './general';
import { constraint, functionCall } from './whereClause';

/**
 * [[18]](https://www.w3.org/TR/sparql11-query/#rSolutionModifier)
 */
export const solutionModifier: SparqlRule<'solutionModifier', SolutionModifiers> = <const> {
  name: 'solutionModifier',
  impl: ({ ACTION, SUBRULE, OPTION1, OPTION2, OPTION3, OPTION4 }) => () => {
    const group = OPTION1(() => SUBRULE(groupClause, undefined));
    const having = OPTION2(() => SUBRULE(havingClause, undefined));
    const order = OPTION3(() => SUBRULE(orderClause, undefined));
    const limitOffset = OPTION4(() => SUBRULE(limitOffsetClauses, undefined));
    return ACTION(() => ({
      ...(limitOffset && { limitOffset }),
      ...(group && { group }),
      ...(having && { having }),
      ...(order && { order }),
    }));
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    if (ast.group) {
      SUBRULE(groupClause, ast.group, undefined);
    }
    if (ast.having) {
      SUBRULE(havingClause, ast.having, undefined);
    }
    if (ast.order) {
      SUBRULE(orderClause, ast.order, undefined);
    }
    if (ast.limitOffset) {
      SUBRULE(limitOffsetClauses, ast.limitOffset, undefined);
    }
  },
};

/**
 * [[19]](https://www.w3.org/TR/sparql11-query/#rGroupClause)
 */
export const groupClause: SparqlRule<'groupClause', SolutionModifierGroup> = <const> {
  name: 'groupClause',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE1, CONSUME }) => (C) => {
    const groupings: (Expression | SolutionModifierGroupBind)[] = [];
    const start = CONSUME(l.groupByGroup);
    CONSUME(l.by);
    AT_LEAST_ONE(() => {
      groupings.push(SUBRULE1(groupCondition, undefined));
    });

    return ACTION(() => ({
      type: 'solutionModifier',
      subType: 'group',
      groupings,
      loc: C.factory.sourceLocation(start, groupings.at(-1)),
    }));
  },
  gImpl: ({ PRINT_WORDS, SUBRULE }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORDS('GROUP', 'BY'));
    for (const grouping of ast.groupings) {
      if (F.isExpression(grouping)) {
        SUBRULE(expression, grouping, undefined);
      } else {
        F.printFilter(ast, () => PRINT_WORDS('('));
        SUBRULE(expression, grouping.value, undefined);
        F.printFilter(ast, () => PRINT_WORDS('AS'));
        SUBRULE(var_, grouping.variable, undefined);
        F.printFilter(ast, () => PRINT_WORDS(')'));
      }
    }
  },
};

/**
 * [[20]](https://www.w3.org/TR/sparql11-query/#rGroupCondition)
 */
export const groupCondition: SparqlGrammarRule<'groupCondition', Expression | SolutionModifierGroupBind> = <const>{
  name: 'groupCondition',
  impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, OPTION, OR }) => C =>
    OR<Expression | SolutionModifierGroupBind>([
      { ALT: () => SUBRULE(builtInCall, undefined) },
      { ALT: () => SUBRULE(functionCall, undefined) },
      { ALT: () => SUBRULE2(var_, undefined) },
      {
        ALT: () => {
          // Creates a bracketted expression or a Bind.
          const open = CONSUME(l.symbols.LParen);
          const expressionValue = SUBRULE(expression, undefined);
          const variable = OPTION(() => {
            CONSUME(l.as);
            return SUBRULE1(var_, undefined);
          });
          const close = CONSUME(l.symbols.RParen);
          return ACTION(() => {
            if (variable !== undefined) {
              return {
                variable,
                value: expressionValue,
                loc: C.factory.sourceLocation(open, close),
              } satisfies SolutionModifierGroupBind;
            }
            return expressionValue;
          });
        },
      },
    ]),
};

/**
 * [[21]](https://www.w3.org/TR/sparql11-query/#rHavingClause)
 */
export const havingClause: SparqlRule<'havingClause', SolutionModifierHaving> = <const> {
  name: 'havingClause',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME }) => (C) => {
    const having = CONSUME(l.having);
    const expressions: Expression[] = [];

    const couldParseAgg = ACTION(() =>
      C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));
    AT_LEAST_ONE(() => {
      expressions.push(SUBRULE(havingCondition, undefined));
    });
    ACTION(() => !couldParseAgg && C.parseMode.delete('canParseAggregate'));

    return ACTION(() =>
      C.factory.solutionModifierHaving(expressions, C.factory.sourceLocation(having, expressions.at(-1))));
  },
  gImpl: ({ PRINT_WORD, SUBRULE }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('HAVING'));
    for (const having of ast.having) {
      SUBRULE(expression, having, undefined);
    }
  },
};

/**
 * [[22]](https://www.w3.org/TR/sparql11-query/#rHavingCondition)
 */
export const havingCondition: SparqlGrammarRule<'havingCondition', Expression> = <const> {
  name: 'havingCondition',
  impl: ({ SUBRULE }) => () => SUBRULE(constraint, undefined),
};

/**
 * [[23]](https://www.w3.org/TR/sparql11-query/#rOrderClause)
 */
export const orderClause: SparqlRule<'orderClause', SolutionModifierOrder> = <const> {
  name: 'orderClause',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE1, CONSUME }) => (C) => {
    const order = CONSUME(l.order);
    CONSUME(l.by);
    const orderings: Ordering[] = [];

    const couldParseAgg = ACTION(() =>
      C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));
    AT_LEAST_ONE(() => {
      orderings.push(SUBRULE1(orderCondition, undefined));
    });
    ACTION(() => !couldParseAgg && C.parseMode.delete('canParseAggregate'));

    return ACTION(() =>
      C.factory.solutionModifierOrder(orderings, C.factory.sourceLocation(order, orderings.at(-1))));
  },
  gImpl: ({ PRINT_WORDS, SUBRULE }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORDS('ORDER', 'BY'));
    for (const ordering of ast.orderDefs) {
      if (ordering.descending) {
        F.printFilter(ast, () => PRINT_WORDS('DESC'));
      } else {
        F.printFilter(ast, () => PRINT_WORDS('ASC'));
      }
      F.printFilter(ast, () => PRINT_WORDS('('));
      SUBRULE(expression, ordering.expression, undefined);
      F.printFilter(ast, () => PRINT_WORDS(')'));
    }
  },
};

/**
 * [[24]](https://www.w3.org/TR/sparql11-query/#rOrderCondition)
 */
export const orderCondition: SparqlGrammarRule<'orderCondition', Ordering> = <const> {
  name: 'orderCondition',
  impl: ({ ACTION, SUBRULE, CONSUME, OR1, OR2 }) => C => OR1<Ordering>([
    { ALT: () => {
      const descending = OR2<[boolean, IToken]>([
        { ALT: () => {
          const token = CONSUME(l.orderAsc);
          return <const>[ false, token ];
        } },
        { ALT: () => {
          const token = CONSUME(l.orderDesc);
          return <const> [ true, token ];
        } },
      ]);

      const expr = SUBRULE(brackettedExpression, undefined);

      return ACTION(() => ({
        expression: expr,
        descending: descending[0],
        loc: C.factory.sourceLocation(descending[1], expr),
      }));
    } },
    { ALT: () => {
      const expr = SUBRULE(constraint, undefined);
      return ACTION(() => ({ expression: expr, descending: false, loc: expr.loc }));
    } },
    { ALT: () => {
      const expr = SUBRULE(var_, undefined);
      return ACTION(() => ({ expression: expr, descending: false, loc: expr.loc }));
    } },
  ]),
};

/**
 * Parses limit and or offset in any order.
 * [[25]](https://www.w3.org/TR/sparql11-query/#rLimitOffsetClauses)
 */
export const limitOffsetClauses: SparqlRule<'limitOffsetClauses', SolutionModifierLimitOffset> = <const> {
  name: 'limitOffsetClauses',
  impl: ({ ACTION, SUBRULE1, SUBRULE2, OPTION1, OPTION2, OR }) => C => OR([
    { ALT: () => {
      const limit = SUBRULE1(limitClause, undefined);
      const offset = OPTION1(() => SUBRULE1(offsetClause, undefined));
      return ACTION(() => C.factory.solutionModifierLimitOffset(
        limit.val,
        offset?.val,
        C.factory.sourceLocation(limit, ...(offset ? [ offset ] : [])),
      ));
    } },
    { ALT: () => {
      const offset = SUBRULE2(offsetClause, undefined);
      const limit = OPTION2(() => SUBRULE2(limitClause, undefined));
      return ACTION(() => C.factory.solutionModifierLimitOffset(
        limit?.val,
        offset.val,
        C.factory.sourceLocation(offset, limit),
      ));
    } },
  ]),
  gImpl: ({ PRINT_WORDS }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => {
      if (ast.limit) {
        PRINT_WORDS('LIMIT', String(ast.limit));
      }
      if (ast.offset) {
        PRINT_WORDS('OFFSET', String(ast.offset));
      }
    });
  },
};

/**
 * [[26]](https://www.w3.org/TR/sparql11-query/#rLimitClause)
 */
export const limitClause: SparqlGrammarRule<'limitClause', Wrap<number>> = <const> {
  name: 'limitClause',
  impl: ({ ACTION, CONSUME }) => (C) => {
    const offset = CONSUME(l.limit);
    const value = CONSUME(l.terminals.integer);
    const val = Number.parseInt(value.image, 10);
    return ACTION(() => C.factory.wrap(val, C.factory.sourceLocation(offset, value)));
  },
};

/**
 * [[27]](https://www.w3.org/TR/sparql11-query/#rWhereClause)
 */
export const offsetClause: SparqlGrammarRule<'offsetClause', Wrap<number>> = <const> {
  name: <const> 'offsetClause',
  impl: ({ CONSUME, ACTION }) => (C) => {
    const offset = CONSUME(l.offset);
    const value = CONSUME(l.terminals.integer);
    const val = Number.parseInt(value.image, 10);
    return ACTION(() => C.factory.wrap(val, C.factory.sourceLocation(offset, value)));
  },
};
