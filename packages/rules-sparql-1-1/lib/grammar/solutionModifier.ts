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
import type { Ignores1, Images, ITOS, Wrap } from '../TypeHelpersRTT';
import { builtInCall } from './builtIn';
import { brackettedExpression, expression } from './expression';
import { blank, genB, var_ } from './general';
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
  gImpl: ({ SUBRULE }) => ast => [
    ast.group ? SUBRULE(groupClause, ast.group, undefined) : '',
    ast.having ? SUBRULE(havingClause, ast.having, undefined) : '',
    ast.order ? SUBRULE(orderClause, ast.order, undefined) : '',
    ast.limitOffset ? SUBRULE(limitOffsetClauses, ast.limitOffset, undefined) : '',
  ].join(''),
};

/**
 * [[19]](https://www.w3.org/TR/sparql11-query/#rGroupClause)
 */
export const groupClause: SparqlRule<'groupClause', SolutionModifierGroup> = <const> {
  name: 'groupClause',
  impl: ({ AT_LEAST_ONE, SUBRULE, CONSUME }) => () => {
    const groupings: (Expression | SolutionModifierGroupBind)[] = [];
    const img1 = CONSUME(l.groupByGroup).image;
    const i0 = SUBRULE(blank, undefined);
    const img2 = CONSUME(l.by).image;
    const i1 = SUBRULE(blank, undefined);
    AT_LEAST_ONE(() => {
      groupings.push(SUBRULE(groupCondition, undefined));
    });

    return {
      type: 'solutionModifier',
      modifierType: 'group',
      groupings,
      RTT: {
        img1,
        img2,
        i0,
        i1,
      },
    };
  },
  gImpl: ({ SUBRULE }) => ast => [
    genB(SUBRULE, ast.RTT.i0),
    ast.RTT.img1,
    genB(SUBRULE, ast.RTT.i1),
    ast.RTT.img2,
  ].join(''),
};

/**
 * [[20]](https://www.w3.org/TR/sparql11-query/#rGroupCondition)
 */
export const groupCondition: SparqlRule<'groupCondition', Expression | SolutionModifierGroupBind> = <const> {
  name: 'groupCondition',
  impl: ({ SUBRULE, CONSUME, SUBRULE1, SUBRULE2, OPTION, OR }) => ({ factory: F }) =>
    OR<Expression | SolutionModifierGroupBind>([
      { ALT: () => SUBRULE(builtInCall, undefined) },
      { ALT: () => SUBRULE(functionCall, undefined) },
      { ALT: () => SUBRULE2(var_, undefined) },
      { ALT: () => {
      // Creates a bracketted expression or a Bind.
        CONSUME(l.symbols.LParen);
        const i0 = SUBRULE(blank, undefined);
        const expressionValue = SUBRULE(expression, undefined);
        const variable = OPTION(() => {
          const img1 = CONSUME(l.as).image;
          const i1 = SUBRULE1(blank, undefined);
          const variable = SUBRULE1(var_, undefined);
          return { variable, i1, img1 };
        });
        CONSUME(l.symbols.RParen);
        const i2 = SUBRULE2(blank, undefined);
        return variable ?
{
  variable: variable.variable,
  value: expressionValue,
  RTT: {
    img1: variable.img1,
    i0,
    i1: variable.i1,
    i2,
  },
} satisfies SolutionModifierGroupBind :
          F.bracketted(expressionValue, i0, i2);
      } },
    ]),
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    if (F.isExpression(ast)) {
      return SUBRULE(expression, ast, undefined);
    }
    // Is Bind
    return [
      genB(SUBRULE, ast.RTT.i0),
      '(',
      SUBRULE(expression, ast.value, undefined),
      genB(SUBRULE, ast.RTT.i1),
      ast.RTT.img1,
      SUBRULE(var_, ast.variable, undefined),
      genB(SUBRULE, ast.RTT.i2),
      ')',
    ].join('');
  },
};

/**
 * [[21]](https://www.w3.org/TR/sparql11-query/#rHavingClause)
 */
export const havingClause: SparqlRule<'havingClause', SolutionModifierHaving> = <const> {
  name: 'havingClause',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME }) => (C) => {
    const img1 = CONSUME(l.having).image;
    const i0 = SUBRULE(blank, undefined);

    const expressions: Expression[] = [];
    const couldParseAgg = ACTION(() =>
      C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));
    AT_LEAST_ONE(() => {
      expressions.push(SUBRULE(havingCondition, undefined));
    });
    ACTION(() => !couldParseAgg && C.parseMode.delete('canParseAggregate'));

    return {
      type: 'solutionModifier',
      modifierType: 'having',
      having: expressions,
      RTT: {
        img1,
        i0,
      },
    };
  },
  gImpl: ({ SUBRULE }) => ast =>
    `HAVING ${ast.having.map(having => `( ${SUBRULE(expression, having, undefined)} )`).join(' ')}`,
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
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME }) => (C) => {
    const img1 = CONSUME(l.order).image;
    const i0 = SUBRULE(blank, undefined);
    const img2 = CONSUME(l.by).image;
    const i1 = SUBRULE(blank, undefined);

    const orderings: Ordering[] = [];
    const couldParseAgg = ACTION(() =>
      C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));
    AT_LEAST_ONE(() => {
      orderings.push(SUBRULE(orderCondition, undefined));
    });
    ACTION(() => !couldParseAgg && C.parseMode.delete('canParseAggregate'));

    return {
      type: 'solutionModifier',
      modifierType: 'order',
      orderDefs: orderings,
      RTT: {
        i0,
        i1,
        img1,
        img2,
      },
    };
  },
  gImpl: ({ SUBRULE }) => ast => [
    genB(SUBRULE, ast.RTT.i0),
    ast.RTT.img1,
    genB(SUBRULE, ast.RTT.i1),
    ast.RTT.img2,
  ].join(''),
};

/**
 * [[24]](https://www.w3.org/TR/sparql11-query/#rOrderCondition)
 */
export const orderCondition: SparqlRule<'orderCondition', Ordering> = <const> {
  name: 'orderCondition',
  impl: ({ ACTION, SUBRULE, CONSUME, OR1, OR2 }) => () => OR1<Ordering>([
    { ALT: () => {
      const order = OR2([
        { ALT: () => {
          const img1 = CONSUME(l.orderAsc).image;
          return { img1, desc: true };
        } },
        { ALT: () => {
          const img1 = CONSUME(l.orderDesc).image;
          return { img1, desc: true };
        } },
      ]);
      const i0 = SUBRULE(blank, undefined);

      const expr = SUBRULE(brackettedExpression, undefined);

      return ACTION(() => ({
        expression: expr,
        descending: order.desc,
        RTT: {
          img1: order.img1,
          i0,
        },
      }));
    } },
    { ALT: () => SUBRULE(constraint, undefined) },
    { ALT: () => SUBRULE(var_, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    if (F.isExpression(ast)) {
      return SUBRULE(expression, ast, undefined);
    }
    return [
      genB(SUBRULE, ast.RTT.i0),
      ast.RTT.img1,
      SUBRULE(expression, ast.expression, undefined),
    ].join('');
  },
};

/**
 * Parses limit and or offset in any order.
 * [[25]](https://www.w3.org/TR/sparql11-query/#rLimitOffsetClauses)
 */
export const limitOffsetClauses: SparqlRule<'limitOffsetClauses', SolutionModifierLimitOffset> = <const> {
  name: 'limitOffsetClauses',
  impl: ({ SUBRULE1, SUBRULE2, OPTION1, OPTION2, OR }) => () => {
    function ret(
      limit: number | undefined,
      offset: number | undefined,
      i0: ITOS,
      i1: ITOS,
      img1: string,
      i2?: ITOS,
      i3?: ITOS,
      img2?: string,
    ): SolutionModifierLimitOffset {
      return <SolutionModifierLimitOffset> {
        type: 'solutionModifier',
        modifierType: 'limitOffset',
        limit,
        offset,
        RTT: { i0, i1, img1, i2: i2 ?? [], i3: i3 ?? [], img2: img2 ?? '' },
      };
    }
    return OR([
      { ALT: () => {
        const limit = SUBRULE1(limitClause, undefined);
        const offset = OPTION1(() => SUBRULE1(offsetClause, undefined));
        return ret(limit.val, offset?.val, limit.i0, limit.i1, limit.img1, offset?.i0, offset?.i1, offset?.img1);
      } },
      { ALT: () => {
        const offset = SUBRULE2(offsetClause, undefined);
        const limit = OPTION2(() => SUBRULE2(limitClause, undefined));
        return ret(limit?.val, offset.val, offset.i0, offset.i1, offset.img1, limit?.i0, limit?.i1, limit?.img1);
      } },
    ]);
  },
  gImpl: ({ SUBRULE: s }) => (ast) => {
    const builder = [
      genB(s, ast.RTT.i0),
      ast.RTT.img1,
      genB(s, ast.RTT.i1),
    ];
    if (ast.limit !== undefined && ast.RTT.img1.toLowerCase() === 'limit') {
      builder.push(
        String(ast.limit),
        genB(s, ast.RTT.i2),
        ast.RTT.img2,
        genB(s, ast.RTT.i3),
        ast.offset === undefined ? '' : String(ast.offset),
      );
    }
    if (ast.offset !== undefined && ast.RTT.img1.toLowerCase() === 'offset') {
      builder.push(
        String(ast.offset),
        genB(s, ast.RTT.i2),
        ast.RTT.img2,
        genB(s, ast.RTT.i3),
        ast.limit === undefined ? '' : String(ast.limit),
      );
    }
    return builder.join('');
  },
};

/**
 * [[26]](https://www.w3.org/TR/sparql11-query/#rLimitClause)
 */
export const limitClause: SparqlGrammarRule<'limitClause', Wrap<number> & Ignores1 & Images> = <const> {
  name: 'limitClause',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2 }) => () => {
    const img1 = CONSUME(l.limit).image;
    const i0 = SUBRULE1(blank, undefined);
    const val = Number.parseInt(CONSUME(l.terminals.integer).image, 10);
    const i1 = SUBRULE2(blank, undefined);
    return { val, img1, i1, i0 };
  },
};

/**
 * [[27]](https://www.w3.org/TR/sparql11-query/#rWhereClause)
 */
export const offsetClause: SparqlGrammarRule<'offsetClause', Wrap<number> & Ignores1 & Images> = <const> {
  name: <const> 'offsetClause',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2 }) => () => {
    const img1 = CONSUME(l.offset).image;
    const i0 = SUBRULE1(blank, undefined);
    const val = Number.parseInt(CONSUME(l.terminals.integer).image, 10);
    const i1 = SUBRULE2(blank, undefined);
    return { val, img1, i1, i0 };
  },
};
