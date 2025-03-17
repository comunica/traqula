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
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, OPTION, OR, MANY }) => (C) => {
    const i0 = SUBRULE1(blank, undefined);
    const ignored = [ i0 ];
    return OR<IArgList>([
      { ALT: () => {
        const nil = CONSUME(l.terminals.nil).image.slice(1, -1);
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
        let img1 = '';
        let i1: ITOS = [];
        OPTION(() => {
          i1 = SUBRULE2(blank, undefined);
          img1 = CONSUME(l.distinct).image;
        });
        ignored.push(i1);

        const arg1 = SUBRULE1(expression, undefined);
        const args = [ arg1 ];
        MANY(() => {
          const i = SUBRULE3(blank, undefined);
          CONSUME(l.symbols.comma);
          const arg = SUBRULE2(expression, undefined);
          ignored.push(i);
          args.push(arg);
        });
        const ix = SUBRULE4(blank, undefined);
        ignored.push(ix);
        CONSUME(l.symbols.RParen);
        return {
          args,
          img1,
          ignored,
        };
      } },
    ]);
  },
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
  impl: ({ ACTION, CONSUME, MANY, OR, SUBRULE1, SUBRULE2, SUBRULE3 }) => (C) => {
    const i0 = SUBRULE1(blank, undefined);
    return OR([
      { ALT: () => {
        const nil = CONSUME(l.terminals.nil).image.slice(1, -1);
        return ACTION(() => ({ val: [], ignored: [ i0, [ C.factory.blankSpace(nil) ]]}));
      } },
      { ALT: () => {
        CONSUME(l.symbols.LParen);
        const ignored = [ i0 ];
        const expr1 = SUBRULE1(expression, undefined);
        const args: Expression[] = [ expr1 ];
        MANY(() => {
          const i1 = SUBRULE2(blank, undefined);
          CONSUME(l.symbols.comma);
          const expr = SUBRULE2(expression, undefined);
          ignored.push(i1);
          args.push(expr);
        });
        const ix = SUBRULE3(blank, undefined);
        ignored.push(ix);
        CONSUME(l.symbols.RParen);
        return { val: args, ignored };
      } },
    ]);
  },
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
        const i0 = SUBRULE1(blank, undefined);
        const img1 = CONSUME(l.symbols.logicOr).image;
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
      const i0 = SUBRULE1(blank, undefined);
      const img1 = CONSUME(l.symbols.logicAnd).image;
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
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, OPTION, OR, SUBRULE3, SUBRULE4, SUBRULE5, SUBRULE6, SUBRULE7 }) =>
    () => {
      const args1 = SUBRULE1(numericExpression, undefined);
      return OPTION<ExpressionOperation>(() => {
        const i0 = SUBRULE1(blank, undefined);
        const ret = (operator: string, expr: Expression): ExpressionOperation => ({
          type: 'expression',
          expressionType: 'operation',
          operator,
          args: [ args1, expr ],
          RTT: {
            ignored: [ i0 ],
            img1: operator,
          },
        });
        return OR<ExpressionOperation>([
          { ALT: () => {
            const img1 = CONSUME(l.symbols.equal).image;
            const expr = SUBRULE2(numericExpression, undefined);
            return ret(img1, expr);
          } },
          { ALT: () => {
            const img1 = CONSUME(l.symbols.notEqual).image;
            const expr = SUBRULE3(numericExpression, undefined);
            return ret(img1, expr);
          } },
          { ALT: () => {
            const img1 = CONSUME(l.symbols.lessThan).image;
            const expr = SUBRULE4(numericExpression, undefined);
            return ret(img1, expr);
          } },
          { ALT: () => {
            const img1 = CONSUME(l.symbols.greaterThan).image;
            const expr = SUBRULE5(numericExpression, undefined);
            return ret(img1, expr);
          } },
          { ALT: () => {
            const img1 = CONSUME(l.symbols.lessThanEqual).image;
            const expr = SUBRULE6(numericExpression, undefined);
            return ret(img1, expr);
          } },
          { ALT: () => {
            const img1 = CONSUME(l.symbols.greaterThanEqual).image;
            const expr = SUBRULE7(numericExpression, undefined);
            return ret(img1, expr);
          },
          },
          { ALT: () => {
            const img1 = CONSUME(l.in_).image;
            const args = SUBRULE1(expressionList, undefined);
            return ACTION(() => ({
              type: 'expression',
              expressionType: 'operation',
              operator: 'in',
              args: [ args1, ...args.val ],
              RTT: {
                img1,
                ignored: [ i0, ...args.ignored ],
              },
            }));
          },
          },
          { ALT: () => {
            const img1 = CONSUME(l.notIn).image;
            const args = SUBRULE2(expressionList, undefined);
            return ACTION(() => ({
              type: 'expression',
              expressionType: 'operation',
              operator: 'notin',
              args: [ args1, ...args.val ],
              RTT: {
                img1,
                ignored: [ i0, ...args.ignored ],
              },
            }));
          } },
        ]);
      }) ?? args1;
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
  impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, MANY1, MANY2, OR1, OR2, OR3 }) => () =>
    constructLeftDeep(
      () => SUBRULE1(multiplicativeExpression, undefined),
      () => {
        const i0 = SUBRULE1(blank, undefined);
        const res = (operator: '+' | '-' | '*' | '/', expr: Expression) => (left: Expression): ExpressionOperation => ({
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
            CONSUME(l.symbols.opPlus);
            const arg = SUBRULE2(multiplicativeExpression, undefined);
            return res('+', arg);
          } },
          { ALT: () => {
            CONSUME(l.symbols.opMinus);
            const arg = SUBRULE3(multiplicativeExpression, undefined);
            return res('-', arg);
          } },
          { ALT: () => {
            // The operator of this alternative is actually parsed as part of the signed numeric literal. (note #6)
            const { operator, startInt } = OR2<{ operator: '+' | '-'; startInt: TermLiteralPrimitive }>([
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
                const iInner = SUBRULE2(blank, undefined);
                const resInner = (operatorInner: '*' | '/', exprInner: Expression) =>
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
                return OR3([
                  { ALT: () => {
                    CONSUME(l.symbols.star);
                    const expr = SUBRULE1(unaryExpression, undefined);
                    return resInner('*', expr);
                  } },
                  { ALT: () => {
                    CONSUME(l.symbols.slash);
                    const expr = SUBRULE2(unaryExpression, undefined);
                    return resInner('/', expr);
                  },
                  },
                ]);
              },
              ACTION,
              MANY2,
            );
            return res(operator, expr);
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
  impl: ({ ACTION, CONSUME, MANY, SUBRULE1, SUBRULE2, SUBRULE3, OR }) => () => constructLeftDeep(
    () => SUBRULE1(unaryExpression, undefined),
    () => {
      const i0 = SUBRULE1(blank, undefined);
      const constructRes = (operator: '*' | '/', expr: Expression) => (left: Expression): ExpressionOperation => ({
        type: 'expression',
        expressionType: 'operation',
        operator,
        args: [ left, expr ],
        RTT: {
          img1: operator,
          ignored: [ i0 ],
        },
      });
      return OR([
        { ALT: () => {
          CONSUME(l.symbols.star);
          const expr = SUBRULE2(unaryExpression, undefined);
          return constructRes('*', expr);
        } },
        { ALT: () => {
          CONSUME(l.symbols.slash);
          const expr = SUBRULE3(unaryExpression, undefined);
          return constructRes('/', expr);
        } },
      ]);
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
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, OR1, OR2 }) => () => OR1<Expression>([
    { ALT: () => SUBRULE1(primaryExpression, undefined) },
    { ALT: () => {
      const i0 = SUBRULE1(blank, undefined);
      const res = (operator: '!' | '+' | '-', expr: Expression): ExpressionOperation => ({
        type: 'expression',
        expressionType: 'operation',
        operator: operator === '!' ? '!' : (operator === '+' ? 'UPLUS' : 'UMINUS'),
        args: [ expr ],
        RTT: {
          img1: operator,
          ignored: [ i0 ],
        },
      });
      return OR2<ExpressionOperation>([
        { ALT: () => {
          CONSUME(l.symbols.exclamation);
          const expr = SUBRULE2(primaryExpression, undefined);
          return res('!', expr);
        } },
        { ALT: () => {
          CONSUME(l.symbols.opPlus);
          const expr = SUBRULE3(primaryExpression, undefined);
          return res('+', expr);
        } },
        { ALT: () => {
          CONSUME(l.symbols.opMinus);
          const expr = SUBRULE4(primaryExpression, undefined);
          return res('-', expr);
        } },
      ]);
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
    const i0 = SUBRULE1(blank, undefined);
    CONSUME(l.symbols.LParen);
    const expr = SUBRULE(expression, undefined);
    const i1 = SUBRULE2(blank, undefined);
    CONSUME(l.symbols.RParen);
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
