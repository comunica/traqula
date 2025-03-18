import type { ImplArgs } from '@traqula/core';
import * as l from '../lexer';
import type {
  Expression,
  ExpressionFunctionCall,
  ExpressionOperation,
  TermIri,
  TermLiteralPrimitive,
} from '../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import type { ITOS } from '../TypeHelpersRTT';
import { builtInCall } from './builtIn';
import {
  blank,
  genB,
  var_,
} from './general';
import {
  booleanLiteral,
  iri,
  numericLiteral,
  numericLiteralNegative,
  numericLiteralPositive,
  rdfLiteral,
} from './literals';

const infixOperators = new Set([ '||', '&&', '=', '!=', '<', '>', '<=', '>=', 'in', 'notin', '+', '-', '*', '/' ]);
const prefixOperator = new Set([ '!', 'UPLUS', 'UMINUS' ]);

/**
 * [[71]](https://www.w3.org/TR/sparql11-query/#rArgList)
 */
export interface IArgList {
  args: Expression[];
  ignored: ITOS[];
  img1: string;
}
export const argList: SparqlRule<'argList', IArgList> = <const> {
  name: 'argList',
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, SUBRULE5, OPTION, OR, MANY }) => C => OR<IArgList>([
    { ALT: () => {
      const nil = CONSUME(l.terminals.nil).image.slice(1, -1);
      const i0 = SUBRULE1(blank, undefined);
      const ignored = [ i0 ];
      return ACTION(() => {
        const i1 = [ C.factory.blankSpace(nil) ];
        ignored.push(i1);
        return {
          args: [],
          distinct: false,
          ignored,
          img1: '',
        };
      });
    } },
    { ALT: () => {
      CONSUME(l.symbols.LParen);
      const i0 = SUBRULE2(blank, undefined);
      const ignored = [ i0 ];
      let img1 = '';
      let i1: ITOS = [];
      OPTION(() => {
        img1 = CONSUME(l.distinct).image;
        i1 = SUBRULE3(blank, undefined);
      });
      ignored.push(i1);

      const arg1 = SUBRULE1(expression, undefined);
      const args = [ arg1 ];
      MANY(() => {
        CONSUME(l.symbols.comma);
        const i = SUBRULE4(blank, undefined);
        const arg = SUBRULE2(expression, undefined);
        ignored.push(i);
        args.push(arg);
      });
      CONSUME(l.symbols.RParen);
      const ix = SUBRULE5(blank, undefined);
      ignored.push(ix);
      return {
        args,
        img1,
        ignored,
      };
    } },
  ]),
  gImpl: ({ SUBRULE: s }) => (ast) => {
    const builder = [ genB(s, ast.ignored[0]), '(', ast.ignored[1], ast.img1 ];
    if (ast.args.length > 0) {
      builder.push(s(expression, ast.args[0], undefined));
      for (const [ argIndex, arg ] of ast.args.slice(1).entries()) {
        const ignored = ast.ignored[argIndex + 2];
        builder.push(genB(s, ignored), ',', s(expression, arg, undefined));
      }
    }
    builder.push(genB(s, ast.ignored.at(-1)!), ')');
    return builder.join('');
  },
};

/**
 * [[72]](https://www.w3.org/TR/sparql11-query/#rConstructTemplate)
 */
export const expressionList: SparqlRule<'expressionList', { val: Expression[]; ignored: ITOS[] } > = <const> {
  name: 'expressionList',
  impl: ({ ACTION, CONSUME, MANY, OR, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4 }) => C => OR([
    { ALT: () => {
      const nil = CONSUME(l.terminals.nil).image.slice(1, -1);
      const i0 = SUBRULE1(blank, undefined);
      return ACTION(() => ({ val: [], ignored: [ i0, [ C.factory.blankSpace(nil) ]]}));
    } },
    { ALT: () => {
      CONSUME(l.symbols.LParen);
      const i0 = SUBRULE2(blank, undefined);
      const ignored = [ i0 ];
      const expr1 = SUBRULE1(expression, undefined);
      const args: Expression[] = [ expr1 ];
      MANY(() => {
        CONSUME(l.symbols.comma);
        const i1 = SUBRULE3(blank, undefined);
        const expr = SUBRULE2(expression, undefined);
        ignored.push(i1);
        args.push(expr);
      });
      CONSUME(l.symbols.RParen);
      const ix = SUBRULE4(blank, undefined);
      ignored.push(ix);
      return { val: args, ignored };
    } },
  ]),
  gImpl: () => () => '',
};

/**
 * [[110]](https://www.w3.org/TR/sparql11-query/#rExpression)
 */
export const expression: SparqlRule<'expression', Expression> = <const> {
  name: 'expression',
  impl: ({ SUBRULE }) => () => SUBRULE(conditionalOrExpression, undefined),
  gImpl: ({ SUBRULE: s }) => (ast, { factory: F }) => {
    const builder: string[] = [];
    if (F.isBrackettedRTT(ast)) {
      builder.push(...ast.RTT.preBracket.flatMap(([ pre ]) => [ genB(s, pre), '(' ]));
    }

    if (F.isExpressionOperator(ast)) {
      if (infixOperators.has(ast.operator)) {
        // Operator is infix
        builder.push(
          s(expression, ast.args[0], undefined),
          genB(s, ast.RTT.ignored[0]),
          ast.RTT.img1,
          s(expressionList, { val: ast.args.slice(1), ignored: ast.RTT.ignored.slice(1) }, undefined),
        );
      } else if (prefixOperator.has(ast.operator)) {
        // Operator is prefix
        builder.push(
          genB(s, ast.RTT.ignored[0]),
          ast.RTT.img1,
          s(expression, ast.args[0], undefined),
        );
      } else {
        // Operator is function
        builder.push(
          genB(s, ast.RTT.ignored[0]),
          ast.RTT.img1,
          s(expressionList, { val: ast.args, ignored: ast.RTT.ignored.slice(1) }, undefined),
        );
      }
    } else if (F.isExpressionPatternOperator(ast)) {
      // Builder.push(s(iriOrFunction, ast.function, undefined));
    } else if (F.isExpressionFunctionCall(ast)) {
      builder.push(s(iriOrFunction, ast.function, undefined));
    } else if (F.isExpressionAggregate(ast)) {
      // Builder.push(s(iriOrFunction, ast.function, undefined));
    } else if (F.isTermIri(ast)) {
      builder.push(s(iri, ast, undefined));
    } else if (F.isTermVariable(ast)) {
      builder.push(s(var_, ast, undefined));
    } else {
      builder.push(s(rdfLiteral, ast, undefined));
    }

    if (F.isBrackettedRTT(ast)) {
      builder.push(...ast.RTT.preBracket.flatMap(([ , post ]) => [ genB(s, post), '(' ]));
    }
    return builder.join('');
  },
};

type LeftDeepBuildArgs = (left: Expression) => ExpressionOperation;

function constructLeftDeep(
  startGenerator: () => Expression,
  restGenerator: () => LeftDeepBuildArgs,
  ACTION: ImplArgs['ACTION'],
  MANY: ImplArgs['MANY'],
): ExpressionOperation | Expression {
  // By using iterExpression, we avoid creating unnecessary arrays
  let iterExpr = startGenerator();
  MANY(() => {
    const res = restGenerator();
    ACTION(() => {
      iterExpr = res(iterExpr);
    });
  });
  return iterExpr;
}

/**
 * [[111]](https://www.w3.org/TR/sparql11-query/#rConditionalOrExpression)
 */
export const conditionalOrExpression: SparqlGrammarRule<'conditionalOrExpression', ExpressionOperation | Expression> =
  <const> {
    name: 'conditionalOrExpression',
    impl: ({ ACTION, MANY, CONSUME, SUBRULE1, SUBRULE2 }) => () => constructLeftDeep(
      () => SUBRULE1(conditionalAndExpression, undefined),
      () => {
        const img1 = CONSUME(l.symbols.logicOr).image;
        const i0 = SUBRULE1(blank, undefined);
        const args = SUBRULE2(conditionalAndExpression, undefined);
        return left => ({
          type: 'expression',
          expressionType: 'operation',
          args: [ left, args ],
          operator: '||',
          RTT: {
            img1,
            ignored: [ i0 ],
          },
        } satisfies ExpressionOperation);
      },
      ACTION,
      MANY,
    ),
  };

/**
 * [[112]](https://www.w3.org/TR/sparql11-query/#rConditionalAndExpression)
 */
export const conditionalAndExpression: SparqlGrammarRule<'conditionalAndExpression', Expression> = <const> {
  name: 'conditionalAndExpression',
  impl: ({ ACTION, MANY, SUBRULE1, SUBRULE2, CONSUME }) => () => constructLeftDeep(
    () => SUBRULE1(valueLogical, undefined),
    () => {
      const img1 = CONSUME(l.symbols.logicAnd).image;
      const i0 = SUBRULE1(blank, undefined);
      const arg = SUBRULE2(valueLogical, undefined);
      return left => ({
        type: 'expression',
        expressionType: 'operation',
        args: [ left, arg ],
        operator: '&&',
        expr: arg,
        RTT: {
          img1,
          ignored: [ i0 ],
        },
      });
    },
    ACTION,
    MANY,
  ),
};

/**
 * [[113]](https://www.w3.org/TR/sparql11-query/#rValueLogical)
 */
export const valueLogical: SparqlGrammarRule<'valueLogical', Expression> = <const> {
  name: 'valueLogical',
  impl: ({ SUBRULE }) => () => SUBRULE(relationalExpression, undefined),
};

/**
 * [[114]](https://www.w3.org/TR/sparql11-query/#rRelationalExpression)
 */
export const relationalExpression:
SparqlGrammarRule<'relationalExpression', ExpressionOperation | Expression> = <const>{
  name: 'relationalExpression',
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, OPTION, OR1, OR2, OR3 }) =>
    (C) => {
      const args1 = SUBRULE1(numericExpression, undefined);
      return OPTION<ExpressionOperation>(() => OR1<ExpressionOperation>([
        { ALT: () => {
          // Stay in numeric;
          const img1 = OR2([
            { ALT: () => CONSUME(l.symbols.equal).image },
            { ALT: () => CONSUME(l.symbols.notEqual).image },
            { ALT: () => CONSUME(l.symbols.lessThan).image },
            { ALT: () => CONSUME(l.symbols.greaterThan).image },
            { ALT: () => CONSUME(l.symbols.lessThanEqual).image },
            { ALT: () => CONSUME(l.symbols.greaterThanEqual).image },
          ]);
          const i0 = SUBRULE1(blank, undefined);
          const expr = SUBRULE2(numericExpression, undefined);
          return {
            type: 'expression',
            expressionType: 'operation',
            operator: img1,
            args: [ args1, expr ],
            RTT: {
              ignored: [ i0 ],
              img1,
            },
          };
        } },
        { ALT: () => {
          const img1 = OR3([
            { ALT: () => CONSUME(l.in_).image },
            { ALT: () => CONSUME(l.notIn).image },
          ]);
          const i0 = SUBRULE2(blank, undefined);
          const args = SUBRULE1(expressionList, undefined);
          return ACTION(() => ({
            type: 'expression',
            expressionType: 'operation',
            operator: C.factory.formatOperator(img1),
            args: [ args1, ...args.val ],
            RTT: {
              img1,
              ignored: [ i0, ...args.ignored ],
            },
          }));
        } },
      ])) ?? args1;
    },
};

/**
 * [[115]](https://www.w3.org/TR/sparql11-query/#rNumericExpression)
 */
export const numericExpression: SparqlGrammarRule<'numericExpression', Expression> = <const> {
  name: 'numericExpression',
  impl: ({ SUBRULE }) => () => SUBRULE(additiveExpression, undefined),
};

/**
 * [[116]](https://www.w3.org/TR/sparql11-query/#rAdditiveExpression)
 */
export const additiveExpression: SparqlGrammarRule<'additiveExpression', Expression> = <const> {
  name: 'additiveExpression',
  impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, MANY1, MANY2, OR1, OR2, OR3, OR4 }) => () =>
    constructLeftDeep(
      () => SUBRULE1(multiplicativeExpression, undefined),
      () => {
        const res = (i0: ITOS, operator: '+' | '-' | '*' | '/', expr: Expression) =>
          (left: Expression): ExpressionOperation => ({
            type: 'expression',
            expressionType: 'operation',
            operator,
            args: [ left, expr ],
            RTT: {
              img1: operator,
              ignored: [ i0 ],
            },
          });
        return OR1<(left: Expression) => ExpressionOperation>([
          { ALT: () => {
            // Multiplicative expression as 2nd argument
            const img1 = OR2<'+' | '-'>([
              { ALT: () => <'+'> CONSUME(l.symbols.opPlus).image },
              { ALT: () => <'-'> CONSUME(l.symbols.opMinus).image },
            ]);
            const i0 = SUBRULE1(blank, undefined);
            const arg = SUBRULE2(multiplicativeExpression, undefined);
            return res(i0, img1, arg);
          } },
          { ALT: () => {
            // The operator of this alternative is actually parsed as part of the signed numeric literal. (note #6)
            const { operator, startInt } = OR3<{ operator: '+' | '-'; startInt: TermLiteralPrimitive }>([
              { ALT: () => {
                // Note #6. No spaces are allowed between the sign and a number.
                // In this rule however, we do not want to care about this.
                const integer = SUBRULE(numericLiteralPositive, undefined);
                return ACTION(() => {
                  integer.value = integer.value.replace(/^\+/u, '');
                  return <const> {
                    operator: '+',
                    startInt: integer,
                  };
                });
              } },
              { ALT: () => {
                const integer = SUBRULE(numericLiteralNegative, undefined);
                return ACTION(() => {
                  integer.value = integer.value.replace(/^-/u, '');
                  return <const> {
                    operator: '-',
                    startInt: integer,
                  };
                });
              } },
            ]);
            const expr = constructLeftDeep(
              () => ACTION(() => startInt),
              () => {
                const resInner = (iInner: ITOS, operatorInner: '*' | '/', exprInner: Expression) =>
                  (leftInner: Expression): ExpressionOperation => ({
                    type: 'expression',
                    expressionType: 'operation',
                    operator: operatorInner,
                    args: [ leftInner, exprInner ],
                    RTT: {
                      img1: operatorInner,
                      ignored: [ iInner ],
                    },
                  });
                const operator = OR4<'*' | '/'>([
                  { ALT: () => <'*'> CONSUME(l.symbols.star).image },
                  { ALT: () => <'/'> CONSUME(l.symbols.slash).image },
                ]);
                const iInner = SUBRULE2(blank, undefined);
                const expr = SUBRULE1(unaryExpression, undefined);
                return resInner(iInner, operator, expr);
              },
              ACTION,
              MANY2,
            );
            return res([], operator, expr);
          },
          },
        ]);
      },
      ACTION,
      MANY1,
    ),
};

/**
 * [[117]](https://www.w3.org/TR/sparql11-query/#rMultiplicativeExpression)
 */
export const multiplicativeExpression: SparqlGrammarRule<'multiplicativeExpression', Expression> = <const> {
  name: 'multiplicativeExpression',
  impl: ({ ACTION, CONSUME, MANY, SUBRULE1, SUBRULE2, OR }) => () => constructLeftDeep(
    () => SUBRULE1(unaryExpression, undefined),
    () => {
      const operator = OR<'*' | '/'>([
        { ALT: () => <'*'> CONSUME(l.symbols.star).image },
        { ALT: () => <'/'> CONSUME(l.symbols.slash).image },
      ]);
      const i0 = SUBRULE1(blank, undefined);
      const expr = SUBRULE2(unaryExpression, undefined);
      return (left: Expression) => ({
        type: 'expression',
        expressionType: 'operation',
        operator,
        args: [ left, expr ],
        RTT: {
          img1: operator,
          ignored: [ i0 ],
        },
      });
    },
    ACTION,
    MANY,
  ),
};

/**
 * [[118]](https://www.w3.org/TR/sparql11-query/#rUnaryExpression)
 */
export const unaryExpression: SparqlGrammarRule<'unaryExpression', Expression> = <const> {
  name: 'unaryExpression',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, OR1, OR2 }) => () => OR1<Expression>([
    { ALT: () => SUBRULE1(primaryExpression, undefined) },
    { ALT: () => {
      const operator = OR2([
        { ALT: () => CONSUME(l.symbols.exclamation).image },
        { ALT: () => CONSUME(l.symbols.opPlus).image },
        { ALT: () => CONSUME(l.symbols.opMinus).image },
      ]);
      const i0 = SUBRULE1(blank, undefined);
      const expr = SUBRULE2(primaryExpression, undefined);
      return {
        type: 'expression',
        expressionType: 'operation',
        operator: operator === '!' ? '!' : (operator === '+' ? 'UPLUS' : 'UMINUS'),
        args: [ expr ],
        RTT: {
          img1: operator,
          ignored: [ i0 ],
        },
      };
    } },
  ]),
};

/**
 * [[119]](https://www.w3.org/TR/sparql11-query/#rPrimaryExpression)
 */
export const primaryExpression: SparqlGrammarRule<'primaryExpression', Expression> = <const> {
  name: 'primaryExpression',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(brackettedExpression, undefined) },
    { ALT: () => SUBRULE(builtInCall, undefined) },
    { ALT: () => SUBRULE(iriOrFunction, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(numericLiteral, undefined) },
    { ALT: () => SUBRULE(booleanLiteral, undefined) },
    { ALT: () => SUBRULE(var_, undefined) },
  ]),
};

/**
 * [[120]](https://www.w3.org/TR/sparql11-query/#rBrackettedExpression)
 */
export const brackettedExpression: SparqlGrammarRule<'brackettedExpression', Expression> = <const> {
  name: 'brackettedExpression',
  impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2 }) => (C) => {
    CONSUME(l.symbols.LParen);
    const i0 = SUBRULE1(blank, undefined);
    const expr = SUBRULE(expression, undefined);
    CONSUME(l.symbols.RParen);
    const i1 = SUBRULE2(blank, undefined);
    return ACTION(() => C.factory.bracketted(expr, i0, i1));
  },
};

/**
 * [[128]](https://www.w3.org/TR/sparql11-query/#ririOrFunction)
 */
export const iriOrFunction: SparqlRule<'iriOrFunction', TermIri | ExpressionFunctionCall> = <const> {
  name: 'iriOrFunction',
  impl: ({ ACTION, SUBRULE, OPTION }) => (C) => {
    const iriVal = SUBRULE(iri, undefined);
    return OPTION<ExpressionFunctionCall>(() => {
      const args = SUBRULE(argList, undefined);
      const distinct = args.img1 !== '';
      ACTION(() => {
        if (!C.parseMode.has('canParseAggregate') && distinct) {
          throw new Error(`DISTINCT implies that this function is an aggregated function, which is not allowed in this context.`);
        }
      });
      return {
        type: 'expression',
        expressionType: 'functionCall',
        function: iriVal,
        args: args.args,
        distinct,
        RTT: {
          img1: args.img1,
          ignored: args.ignored,
        },
      };
    }) ?? iriVal;
  },
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => F.isExpressionFunctionCall(ast) ?
      [
        SUBRULE(iri, ast.function, undefined),
        SUBRULE(argList, { img1: ast.RTT.img1, args: ast.args, ignored: ast.RTT.ignored }, undefined),
      ].join('') :
    SUBRULE(iri, ast, undefined),
};
