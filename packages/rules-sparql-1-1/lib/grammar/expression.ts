import type { ImplArgs, RuleDefReturn } from '@traqula/core';
import * as l from '../lexer';
import type {
  Expression,
  ExpressionBracketted,
  ExpressionFunctionCall,
  ExpressionOperation,
  TermIri,
  TermLiteral,
  Wrap,
} from '../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import { builtInCall } from './builtIn';
import {
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
  distinct: boolean;
}
export const argList: SparqlRule<'argList', Wrap<IArgList>> = <const> {
  name: 'argList',
  impl: ({ ACTION, CONSUME, SUBRULE1, OPTION, OR, AT_LEAST_ONE_SEP }) => C =>
    OR<RuleDefReturn<typeof argList>>([
      { ALT: () => {
        const nil = CONSUME(l.terminals.nil);
        return ACTION(() => ({
          val: { args: [], distinct: false },
          ...C.factory.sourceLocation(nil),
        }));
      } },
      { ALT: () => {
        const args: Expression[] = [];
        const open = CONSUME(l.symbols.LParen);
        const distinct = OPTION(() => {
          CONSUME(l.distinct);
          return true;
        }) ?? false;

        AT_LEAST_ONE_SEP({
          SEP: l.symbols.comma,
          DEF: () => {
            const arg = SUBRULE1(expression, undefined);
            args.push(arg);
          },
        });
        const close = CONSUME(l.symbols.RParen);
        return ACTION(() => ({
          val: { args, distinct },
          ...C.factory.sourceLocation(open, close),
        }));
      } },
    ]),
  gImpl: () => () => {},
};

/**
 * [[72]](https://www.w3.org/TR/sparql11-query/#rConstructTemplate)
 */
export const expressionList: SparqlRule<'expressionList', Wrap<Expression[]>> = <const> {
  name: 'expressionList',
  impl: ({ ACTION, CONSUME, MANY, OR, SUBRULE1, SUBRULE2 }) => C => OR([
    { ALT: () => {
      const nil = CONSUME(l.terminals.nil);
      return ACTION(() => ({ val: [], ...C.factory.sourceLocation(nil) }));
    } },
    { ALT: () => {
      const open = CONSUME(l.symbols.LParen);
      const expr1 = SUBRULE1(expression, undefined);
      const args: Expression[] = [ expr1 ];
      MANY(() => {
        CONSUME(l.symbols.comma);
        const expr = SUBRULE2(expression, undefined);
        args.push(expr);
      });
      const close = CONSUME(l.symbols.RParen);
      return ACTION(() => ({ val: args, ...C.factory.sourceLocation(open, close) }));
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
  gImpl: () => () => {},
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
    impl: ({ ACTION, MANY, CONSUME, SUBRULE1, SUBRULE2 }) => C => constructLeftDeep(
      () => SUBRULE1(conditionalAndExpression, undefined),
      () => {
        CONSUME(l.symbols.logicOr);
        const args = SUBRULE2(conditionalAndExpression, undefined);
        return left => ACTION(() =>
          C.factory.expressionOperation('||', [ left, args ], C.factory.sourceLocation(left.loc, args.loc)));
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
  impl: ({ ACTION, MANY, SUBRULE1, SUBRULE2, CONSUME }) => C => constructLeftDeep(
    () => SUBRULE1(valueLogical, undefined),
    () => {
      CONSUME(l.symbols.logicAnd);
      const arg = SUBRULE2(valueLogical, undefined);
      return left => ACTION(() =>
        C.factory.expressionOperation('&&', [ left, arg ], C.factory.sourceLocation(left.loc, arg.loc)));
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
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, OPTION, OR1, OR2, OR3 }) => (C) => {
    const args1 = SUBRULE1(numericExpression, undefined);
    const expression = OPTION<ExpressionOperation>(() =>
      OR1<ExpressionOperation>([
        { ALT: () => {
          // Stay in numeric;
          const operator = OR2([
            { ALT: () => CONSUME(l.symbols.equal) },
            { ALT: () => CONSUME(l.symbols.notEqual) },
            { ALT: () => CONSUME(l.symbols.lessThan) },
            { ALT: () => CONSUME(l.symbols.greaterThan) },
            { ALT: () => CONSUME(l.symbols.lessThanEqual) },
            { ALT: () => CONSUME(l.symbols.greaterThanEqual) },
          ]);
          const expr = SUBRULE2(numericExpression, undefined);
          return ACTION(() => C.factory.expressionOperation(
            operator.image,
            [ args1, expr ],
            C.factory.sourceLocation(args1.loc, expr.loc),
          ));
        } },
        { ALT: () => {
          const operator = OR3([
            { ALT: () => CONSUME(l.in_) },
            { ALT: () => CONSUME(l.notIn) },
          ]);
          const args = SUBRULE1(expressionList, undefined);
          return ACTION(() => C.factory.expressionOperation(
            operator.image,
            [ args1, ...args.val ],
            C.factory.sourceLocation(args1.loc, args),
          ));
        } },
      ]));
    return expression ?? args1;
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
  impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, MANY1, MANY2, OR1, OR2, OR3, OR4 }) => C =>
    constructLeftDeep(
      () => SUBRULE1(multiplicativeExpression, undefined),
      () => OR1<(left: Expression) => ExpressionOperation>([
        { ALT: () => {
          // Multiplicative expression as 2nd argument
          const operator = OR2([
            { ALT: () => CONSUME(l.symbols.opPlus) },
            { ALT: () => CONSUME(l.symbols.opMinus) },
          ]);
          const arg = SUBRULE2(multiplicativeExpression, undefined);
          return ACTION(() => left =>
            C.factory.expressionOperation(operator.image, [ left, arg ], C.factory.sourceLocation(left.loc, arg.loc)));
        } },
        { ALT: () => {
          // The operator of this alternative is actually parsed as part of the signed numeric literal. (note #6)
          const { operator, startInt } = OR3<{ operator: '+' | '-'; startInt: TermLiteral }>([
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
          const multiplicativeExpr = constructLeftDeep(
            () => ACTION(() => startInt),
            () => {
              const innerOperator = OR4([
                { ALT: () => CONSUME(l.symbols.star) },
                { ALT: () => CONSUME(l.symbols.slash) },
              ]);
              const innerExpr = SUBRULE1(unaryExpression, undefined);
              return ACTION(() => leftInner => C.factory.expressionOperation(
                innerOperator.image,
                [ leftInner, innerExpr ],
                C.factory.sourceLocation(leftInner.loc, innerExpr.loc),
              ));
            },
            ACTION,
            MANY2,
          );
          return left => C.factory.expressionOperation(
            operator,
            [ left, multiplicativeExpr ],
            C.factory.sourceLocation(left.loc, multiplicativeExpr.loc),
          );
        } },
      ]),
      ACTION,
      MANY1,
    ),
};

/**
 * [[117]](https://www.w3.org/TR/sparql11-query/#rMultiplicativeExpression)
 */
export const multiplicativeExpression: SparqlGrammarRule<'multiplicativeExpression', Expression> = <const> {
  name: 'multiplicativeExpression',
  impl: ({ ACTION, CONSUME, MANY, SUBRULE1, SUBRULE2, OR }) => C => constructLeftDeep(
    () => SUBRULE1(unaryExpression, undefined),
    () => {
      const operator = OR([
        { ALT: () => CONSUME(l.symbols.star) },
        { ALT: () => CONSUME(l.symbols.slash) },
      ]);
      const expr = SUBRULE2(unaryExpression, undefined);
      return (left: Expression) => ({
        type: 'expression',
        expressionType: 'operation',
        operator: operator.image,
        args: [ left, expr ],
        loc: C.factory.sourceLocation(left.loc, expr.loc),
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
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, OR1, OR2 }) => C => OR1<Expression>([
    { ALT: () => SUBRULE1(primaryExpression, undefined) },
    { ALT: () => {
      const operator = OR2([
        { ALT: () => CONSUME(l.symbols.exclamation) },
        { ALT: () => CONSUME(l.symbols.opPlus) },
        { ALT: () => CONSUME(l.symbols.opMinus) },
      ]);
      const expr = SUBRULE2(primaryExpression, undefined);
      return ACTION(() => ({
        type: 'expression',
        expressionType: 'operation',
        operator: operator.image === '!' ? '!' : (operator.image === '+' ? 'UPLUS' : 'UMINUS'),
        args: [ expr ],
        loc: C.factory.sourceLocation(operator, expr.loc),
      }));
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
export const brackettedExpression: SparqlGrammarRule<'brackettedExpression', ExpressionBracketted> = <const> {
  name: 'brackettedExpression',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const open = CONSUME(l.symbols.LParen);
    const expr = SUBRULE(expression, undefined);
    const close = CONSUME(l.symbols.RParen);
    return ACTION(() => ({
      type: 'expression',
      expressionType: 'bracketted',
      expression: expr,
      loc: C.factory.sourceLocation(open, close),
    }));
  },
};

/**
 * [[128]](https://www.w3.org/TR/sparql11-query/#ririOrFunction)
 */
export const iriOrFunction: SparqlRule<'iriOrFunction', TermIri | ExpressionFunctionCall> = <const> {
  name: 'iriOrFunction',
  impl: ({ ACTION, SUBRULE, OPTION }) => (C) => {
    const iriVal = SUBRULE(iri, undefined);
    const functionCall = OPTION<ExpressionFunctionCall>(() => {
      const args = SUBRULE(argList, undefined);
      return ACTION(() => {
        const distinct = args.val.distinct;
        if (!C.parseMode.has('canParseAggregate') && distinct) {
          throw new Error(`DISTINCT implies that this function is an aggregated function, which is not allowed in this context.`);
        }
        return {
          type: 'expression',
          expressionType: 'functionCall',
          function: iriVal,
          args: args.val.args,
          distinct,
          loc: C.factory.sourceLocation(iriVal.loc, args),
        };
      });
    });
    return functionCall ?? iriVal;
  },
  gImpl: () => () => {},
};
