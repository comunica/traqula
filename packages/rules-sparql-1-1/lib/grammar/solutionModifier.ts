import * as l from '../lexer';
import type { Expression, Grouping, Ordering, SelectQuery, SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import { builtInCall } from './builtIn';
import { brackettedExpression, expression } from './expression';
import { var_ } from './general';
import { constraint, functionCall } from './whereClause';

/**
 * [[18]](https://www.w3.org/TR/sparql11-query/#rSolutionModifier)
 */
export type ISolutionModifier = Pick<SelectQuery, 'group' | 'having' | 'order' | 'limit' | 'offset'>;
export const solutionModifier: SparqlRule<'solutionModifier', ISolutionModifier> = <const> {
  name: 'solutionModifier',
  impl: ({ ACTION, SUBRULE, OPTION1, OPTION2, OPTION3, OPTION4 }) => () => {
    const group = OPTION1(() => SUBRULE(groupClause, undefined));
    const having = OPTION2(() => SUBRULE(havingClause, undefined));
    const order = OPTION3(() => SUBRULE(orderClause, undefined));
    const limitAndOffset = OPTION4(() => SUBRULE(limitOffsetClauses, undefined));

    return ACTION(() => ({
      ...limitAndOffset,
      ...(group && { group }),
      ...(having && { having }),
      ...(order && { order }),
    }));
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const group = ast.group ? SUBRULE(groupClause, ast.group, undefined) : '';
    const having = ast.having ? SUBRULE(havingClause, ast.having, undefined) : '';
    const order = ast.order ? SUBRULE(orderClause, ast.order, undefined) : '';
    const limit = SUBRULE(limitOffsetClauses, ast, undefined);

    return [ group, having, order, limit ].filter(Boolean).join(' ');
  },
};

/**
 * [[19]](https://www.w3.org/TR/sparql11-query/#rGroupClause)
 */
export const groupClause: SparqlRule<'groupClause', Grouping[]> = <const> {
  name: 'groupClause',
  impl: ({ AT_LEAST_ONE, SUBRULE, CONSUME }) => () => {
    const groupings: Grouping[] = [];
    CONSUME(l.groupBy);
    AT_LEAST_ONE(() => {
      groupings.push(SUBRULE(groupCondition, undefined));
    });

    return groupings;
  },
  gImpl: ({ SUBRULE }) => ast =>
    `GROUP BY ${ast.map(group => SUBRULE(groupCondition, group, undefined)).join(' ')}`,
};

/**
 * [[20]](https://www.w3.org/TR/sparql11-query/#rGroupCondition)
 */
export const groupCondition: SparqlRule<'groupCondition', Grouping> = <const> {
  name: 'groupCondition',
  impl: ({ SUBRULE, CONSUME, SUBRULE1, SUBRULE2, OPTION, OR }) => () => OR<Grouping>([
    { ALT: () => {
      const expression = SUBRULE(builtInCall, undefined);
      return {
        expression,
      };
    } },
    { ALT: () => {
      const expression = SUBRULE(functionCall, undefined);
      return {
        expression,
      };
    } },
    {
      ALT: () => {
        CONSUME(l.symbols.LParen);
        const expressionValue = SUBRULE(expression, undefined);
        const variable = OPTION(() => {
          CONSUME(l.as);
          return SUBRULE1(var_, undefined);
        });
        CONSUME(l.symbols.RParen);

        return {
          expression: expressionValue,
          variable,
        };
      },
    },
    { ALT: () => {
      const expression = SUBRULE2(var_, undefined);
      return {
        expression,
      };
    } },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    if (ast.variable) {
      return `(${SUBRULE(expression, ast.expression, undefined)} AS ${SUBRULE(var_, ast.variable, undefined)})`;
    }
    return SUBRULE(expression, ast.expression, undefined);
  },
};

/**
 * [[21]](https://www.w3.org/TR/sparql11-query/#rHavingClause)
 */
export const havingClause: SparqlRule<'havingClause', Expression[]> = <const> {
  name: 'havingClause',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME }) => (C) => {
    const expressions: Expression[] = [];

    CONSUME(l.having);
    const couldParseAgg = ACTION(() =>
      C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));
    AT_LEAST_ONE(() => {
      expressions.push(SUBRULE(havingCondition, undefined));
    });
    ACTION(() => !couldParseAgg && C.parseMode.delete('canParseAggregate'));

    return expressions;
  },
  gImpl: ({ SUBRULE }) => ast =>
    `HAVING ${ast.map(having => `( ${SUBRULE(expression, having, undefined)} )`).join(' ')}`,
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
export const orderClause: SparqlRule<'orderClause', Ordering[]> = <const> {
  name: 'orderClause',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME }) => (C) => {
    const orderings: Ordering[] = [];

    CONSUME(l.order);
    const couldParseAgg = ACTION(() =>
      C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));
    AT_LEAST_ONE(() => {
      orderings.push(SUBRULE(orderCondition, undefined));
    });
    ACTION(() => !couldParseAgg && C.parseMode.delete('canParseAggregate'));

    return orderings;
  },
  gImpl: ({ SUBRULE }) => ast =>
    `ORDER BY ${ast.map(order => SUBRULE(orderCondition, order, undefined)).join(' ')}`,
};

/**
 * [[24]](https://www.w3.org/TR/sparql11-query/#rOrderCondition)
 */
export const orderCondition: SparqlRule<'orderCondition', Ordering> = <const> {
  name: 'orderCondition',
  impl: ({ SUBRULE, CONSUME, OR1, OR2 }) => () => OR1([
    {
      ALT: () => {
        const descending = OR2([
          { ALT: () => {
            CONSUME(l.orderAsc);
            return false;
          } },
          { ALT: () => {
            CONSUME(l.orderDesc);
            return true;
          } },
        ]);
        const expr = SUBRULE(brackettedExpression, undefined);

        return {
          expression: expr,
          descending,
        };
      },
    },
    { ALT: () => {
      const expr = SUBRULE(constraint, undefined);
      return {
        expression: expr,
      };
    } },
    { ALT: () => {
      const expr = SUBRULE(var_, undefined);
      return {
        expression: expr,
      };
    } },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder: string[] = [];
    if (ast.descending) {
      builder.push('DESC');
    }
    builder.push('(', SUBRULE(expression, ast.expression, undefined), ')');
    return builder.join(' ');
  },
};

/**
 * Parses limit and or offset in any order.
 * [[25]](https://www.w3.org/TR/sparql11-query/#rLimitOffsetClauses)
 */
export const limitOffsetClauses: SparqlRule<'limitOffsetClauses', Pick<SelectQuery, 'limit' | 'offset'>> = <const> {
  name: 'limitOffsetClauses',
  impl: ({ SUBRULE1, SUBRULE2, OPTION1, OPTION2, OR }) => () => OR<Pick<SelectQuery, 'limit' | 'offset'>>([
    {
      ALT: () => {
        const limit = SUBRULE1(limitClause, undefined);
        const offset = OPTION1(() => SUBRULE1(offsetClause, undefined));
        return {
          limit,
          offset,
        };
      },
    },
    {
      ALT: () => {
        const offset = SUBRULE2(offsetClause, undefined);
        const limit = OPTION2(() => SUBRULE2(limitClause, undefined));
        return {
          limit,
          offset,
        };
      },
    },
  ]),
  gImpl: () => (ast) => {
    const builder: string[] = [];
    if (ast.limit) {
      builder.push(`LIMIT ${String(ast.limit)}`);
    }
    if (ast.offset) {
      builder.push(`OFFSET ${String(ast.offset)}`);
    }
    return builder.join(' ');
  },
};

/**
 * [[26]](https://www.w3.org/TR/sparql11-query/#rLimitClause)
 */
export const limitClause: SparqlGrammarRule<'limitClause', number> = <const> {
  name: 'limitClause',
  impl: ({ CONSUME }) => () => {
    CONSUME(l.limit);
    return Number.parseInt(CONSUME(l.terminals.integer).image, 10);
  },
};

/**
 * [[27]](https://www.w3.org/TR/sparql11-query/#rWhereClause)
 */
export const offsetClause: SparqlGrammarRule<'offsetClause', number> = <const> {
  name: <const> 'offsetClause',
  impl: ({ CONSUME }) => () => {
    CONSUME(l.offset);
    return Number.parseInt(CONSUME(l.terminals.integer).image, 10);
  },
};
