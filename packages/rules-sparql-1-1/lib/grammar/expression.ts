import type { ImplArgs } from '@traqula/core';
import * as l from '../lexer';
import type {
  Expression,
  IriTerm,
  Pattern,
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import { aggregate, builtInCall } from './builtIn';
import {
  var_,
  varOrTerm,
} from './general';
import {
  booleanLiteral,
  iri,
  numericLiteral,
  numericLiteralNegative,
  numericLiteralPositive,
  rdfLiteral,
} from './literals';
import { groupGraphPattern } from './whereClause';

export type Operation = '||' | '&&' | RelationalOperator | AdditiveOperator | aggregatorOperator | buildInOperator;
export type RelationalOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'in' | 'notin';
export type AdditiveOperator = '+' | '-' | '*' | '/';
export type unaryOperator = '!' | '+' | '-';
export type buildInOperator = 'STR' | 'LANG' | 'LANGMATCHES' | 'DATATYPE' | 'BOUND' | 'IRI' | 'URI' | 'BNODE' |
  'RAND' | 'ABS' | 'CEIL' | 'FLOOR' | 'ROUND' | 'CONCAT' | 'STRLEN' | 'UCASE' | 'LCASE' | 'ENCODE_FOR_URI' |
  'CONTAINS' | 'STRSTARTS' | 'STRENDS' | 'STRBEFORE' | 'STRAFTER' | 'YEAR' | 'MONTH' | 'DAY' | 'HOURS' | 'MINUTES' |
  'SECONDS' | 'TIMEZONE' | 'TZ' | 'NOW' | 'UUID' | 'STRUUID' | 'MD5' | 'SHA1' | 'SHA256' | 'SHA384' | 'SHA512' |
  'COALESCE' | 'IF' | 'STRLANG' | 'STRDT' | 'sameTerm' | 'isIRI' | 'isURI' | 'isBLANK' | 'isLITERAL' | 'isNUMERIC' |
  'REGEX' | 'SUBSTR' | 'REPLACE' | 'EXISTS' | 'NOT EXISTS';
export type aggregatorOperator = 'COUNT' | 'SUM' | 'MIN' | 'MAX' | 'AVG' | 'SAMPLE' | 'GROUP_CONCAT';

/**
 * [[71]](https://www.w3.org/TR/sparql11-query/#rArgList)
 */
export interface IArgList {
  type: 'functionCall';
  args: Expression[];
  distinct?: boolean;
}
export const argList: SparqlRule<'argList', IArgList> = <const> {
  name: 'argList',
  impl: ({ CONSUME, SUBRULE1, OPTION, OR, MANY_SEP }) => () => OR<IArgList>([
    {
      ALT: () => {
        CONSUME(l.terminals.nil);
        return {
          type: 'functionCall',
          args: [],
          distinct: false,
        };
      },
    },
    {
      ALT: () => {
        const args: Expression[] = [];
        CONSUME(l.symbols.LParen);
        const distinct = OPTION(() => CONSUME(l.distinct)) && true;

        MANY_SEP({
          DEF: () => args.push(SUBRULE1(expression, undefined)),
          SEP: l.symbols.comma,
        });
        CONSUME(l.symbols.RParen);

        return {
          type: 'functionCall',
          args,
          distinct: Boolean(distinct),
        };
      },
    },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ '(' ];
    if (ast.distinct) {
      builder.push('DISTINCT');
    }
    builder.push(SUBRULE(expression, ast.args, undefined));
    builder.push(')');
    return builder.join(' ');
  },
};

export const expressionList: SparqlGrammarRule<'expressionList', Expression[]> = <const> {
  name: 'expressionList',
  impl: ({ CONSUME, SUBRULE, MANY_SEP, OR }) => () => OR([
    {
      ALT: () => {
        CONSUME(l.terminals.nil);
        return [];
      },
    },
    {
      ALT: () => {
        const args: Expression[] = [];
        CONSUME(l.symbols.LParen);
        MANY_SEP({
          SEP: l.symbols.comma,
          DEF: () => {
            args.push(SUBRULE(expression, undefined));
          },
        });
        CONSUME(l.symbols.RParen);
        return args;
      },
    },
  ]),
};

/**
 * [[110]](https://www.w3.org/TR/sparql11-query/#rExpression)
 */
export const expression: SparqlRule<'expression', Expression> = <const> {
  name: 'expression',
  impl: ({ SUBRULE }) => () => SUBRULE(conditionalOrExpression, undefined),
  gImpl: ({ SUBRULE }) => (ast) => {
    if (Array.isArray(ast)) {
      return ast.map(arg => SUBRULE(expression, arg, undefined)).join(', ');
    }
    if ('type' in ast) {
      if (ast.type === 'operation') {
        if ([ '||', '&&', '=', '!=', '<', '>', '<=', '>=', 'in', '+', '-', '*', '/' ].includes(ast.operator)) {
          const [ left, right ] = <[Expression, Expression]>ast.args;
          return `( ${SUBRULE(expression, left, undefined)} ${ast.operator} ${SUBRULE(expression, right, undefined)} )`;
        }
        if (ast.operator === 'notin') {
          const [ left, right ] = <[Expression, Expression]>ast.args;
          return `( ${SUBRULE(expression, left, undefined)} NOT IN ${SUBRULE(expression, right, undefined)} )`;
        }
        if ([ '!', 'UPLUS', 'UMINUS' ].includes(ast.operator)) {
          const [ expr ] = <[Expression]>ast.args;
          return `${ast.operator}${SUBRULE(expression, expr, undefined)}`;
        }
        if ([ 'in', 'notin' ].includes(ast.operator)) {
          // ExpressionList
          const [ first, rest ] = <Expression[]>ast.args;
          const operator = ast.operator === 'in' ? 'IN' : 'NOT IN';
          return `${SUBRULE(expression, first, undefined)} ${operator} ( ${SUBRULE(expression, rest, undefined)} )`;
        }
        if ([ 'exists', 'notexists' ].includes(ast.operator)) {
          const patterns = <[Pattern]>ast.args;
          const operator = ast.operator === 'exists' ? 'EXISTS' : 'NOT EXISTS';
          return `${operator} ${SUBRULE(groupGraphPattern, { type: 'group', patterns }, undefined)}`;
        }
        return `${ast.operator}( ${ast.args.map(arg => SUBRULE(expression, <Expression>arg, undefined)).join(', ')} )`;
      }
      if (ast.type === 'functionCall') {
        return SUBRULE(iriOrFunction, ast, undefined);
      }
      if (ast.type === 'aggregate') {
        return SUBRULE(aggregate, ast, undefined);
      }
    }
    return SUBRULE(varOrTerm, ast, undefined);
  },
};

interface LeftDeepBuildArgs<T extends string = string> {
  expr: Expression;
  operator: T;
}

function constructLeftDeep<T extends string = string>(
  startGenerator: () => Expression,
  restGenerator: () => LeftDeepBuildArgs<T>,
  ACTION: ImplArgs['ACTION'],
  MANY: ImplArgs['MANY'],
): Expression {
// By using iterExpression, we avoid creating unnecessary arrays
  let iterExpr = startGenerator();
  MANY(() => {
    const res = restGenerator();
    ACTION(() => {
      iterExpr = {
        type: 'operation',
        operator: res.operator,
        args: [ iterExpr, res.expr ],
      };
    });
  });
  return iterExpr;
}

/**
 * [[111]](https://www.w3.org/TR/sparql11-query/#rConditionalOrExpression)
 */
export const conditionalOrExpression: SparqlGrammarRule<'conditionalOrExpression', Expression> = <const> {
  name: 'conditionalOrExpression',
  impl: ({ ACTION, MANY, CONSUME, SUBRULE1, SUBRULE2 }) => () =>
    constructLeftDeep(() => SUBRULE1(conditionalAndExpression, undefined), () => {
      CONSUME(l.symbols.logicOr);
      return {
        expr: SUBRULE2(conditionalAndExpression, undefined),
        operator: '||',
      };
    }, ACTION, MANY),
};

/**
 * [[112]](https://www.w3.org/TR/sparql11-query/#rConditionalAndExpression)
 */
export const conditionalAndExpression: SparqlGrammarRule<'conditionalAndExpression', Expression> = <const> {
  name: 'conditionalAndExpression',
  impl: ({ ACTION, MANY, SUBRULE1, SUBRULE2, CONSUME }) => () => constructLeftDeep(
    () => SUBRULE1(valueLogical, undefined),
    () => {
      CONSUME(l.symbols.logicAnd);
      return {
        expr: SUBRULE2(valueLogical, undefined),
        operator: '&&',
      };
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
export const relationalExpression: SparqlGrammarRule<'relationalExpression', Expression> = <const> {
  name: 'relationalExpression',
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, OPTION, OR, SUBRULE3, SUBRULE4, SUBRULE5, SUBRULE6, SUBRULE7 }) =>
    () => {
      const args1 = SUBRULE1(numericExpression, undefined);
      const arg2 = OPTION(() => OR<{ operator: RelationalOperator; args: Expression }>([
        {
          ALT: () => {
            CONSUME(l.symbols.equal);
            const expr = SUBRULE2(numericExpression, undefined);
            return { operator: '=', args: expr };
          },
        },
        {
          ALT: () => {
            CONSUME(l.symbols.notEqual);
            const expr = SUBRULE3(numericExpression, undefined);
            return { operator: '!=', args: expr };
          },
        },
        {
          ALT: () => {
            CONSUME(l.symbols.lessThan);
            const expr = SUBRULE4(numericExpression, undefined);
            return { operator: '<', args: expr };
          },
        },
        {
          ALT: () => {
            CONSUME(l.symbols.greaterThan);
            const expr = SUBRULE5(numericExpression, undefined);
            return { operator: '>', args: expr };
          },
        },
        {
          ALT: () => {
            CONSUME(l.symbols.lessThanEqual);
            const expr = SUBRULE6(numericExpression, undefined);
            return { operator: '<=', args: expr };
          },
        },
        {
          ALT: () => {
            CONSUME(l.symbols.greaterThanEqual);
            const expr = SUBRULE7(numericExpression, undefined);
            return { operator: '>=', args: expr };
          },
        },
        {
          ALT: () => {
            CONSUME(l.in_);
            const args = SUBRULE1(expressionList, undefined);
            return { operator: 'in', args };
          },
        },
        {
          ALT: () => {
            CONSUME(l.notIn);
            const args = SUBRULE2(expressionList, undefined);
            return { operator: 'notin', args };
          },
        },
      ]));
      if (!arg2) {
        return args1;
      }
      return ACTION(() => ({
        type: 'operation',
        operator: arg2.operator,
        args: [ args1, arg2.args ],
      }));
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
      () => OR1([
        {
          ALT: () => {
            CONSUME(l.symbols.opPlus);
            return {
              operator: '+',
              expr: SUBRULE2(multiplicativeExpression, undefined),
            };
          },
        },
        {
          ALT: () => {
            CONSUME(l.symbols.opMinus);
            return {
              operator: '-',
              expr: SUBRULE3(multiplicativeExpression, undefined),
            };
          },
        },
        {
          ALT: () => {
            // The operator of this alternative is actually parsed as part of the signed numeric literal. (note #6)
            const { operator, args } = OR2([
              {
                ALT: () => {
                  // Note #6. No spaces are allowed between the sign and a number.
                  // In this rule however, we do not want to care about this.
                  const integer = SUBRULE(numericLiteralPositive, undefined);
                  return ACTION(() => {
                    integer.value = integer.value.replace(/^\+/u, '');
                    return {
                      operator: '+',
                      args: [ integer ],
                    };
                  });
                },
              },
              {
                ALT: () => {
                  const integer = SUBRULE(numericLiteralNegative, undefined);
                  return ACTION(() => {
                    integer.value = integer.value.replace(/^-/u, '');
                    return {
                      operator: '-',
                      args: [ integer ],
                    };
                  });
                },
              },
            ]);
            const expr = constructLeftDeep(
              () => ACTION(() => args[0]),
              () => OR3<{ expr: Expression; operator: string }>([
                {
                  ALT: () => {
                    CONSUME(l.symbols.star);
                    const expr = SUBRULE1(unaryExpression, undefined);
                    return {
                      operator: '*',
                      expr,
                    };
                  },
                },
                {
                  ALT: () => {
                    CONSUME(l.symbols.slash);
                    const expr = SUBRULE2(unaryExpression, undefined);
                    return {
                      operator: '/',
                      expr,
                    };
                  },
                },
              ]),
              ACTION,
              MANY2,
            );
            return {
              operator,
              expr,
            };
          },
        },
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
  impl: ({ ACTION, CONSUME, MANY, SUBRULE1, SUBRULE2, SUBRULE3, OR }) => () => constructLeftDeep(
    () => SUBRULE1(unaryExpression, undefined),
    () => OR<LeftDeepBuildArgs>([
      {
        ALT: () => {
          CONSUME(l.symbols.star);
          const expr = SUBRULE2(unaryExpression, undefined);
          return {
            operator: '*',
            expr,
          };
        },
      },
      {
        ALT: () => {
          CONSUME(l.symbols.slash);
          const expr = SUBRULE3(unaryExpression, undefined);
          return {
            operator: '/',
            expr,
          };
        },
      },
    ]),
    ACTION,
    MANY,
  ),
};

/**
 * [[118]](https://www.w3.org/TR/sparql11-query/#rUnaryExpression)
 */
export const unaryExpression: SparqlGrammarRule<'unaryExpression', Expression> = <const> {
  name: 'unaryExpression',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, OR }) => () => OR<Expression>([
    {
      ALT: () => {
        CONSUME(l.symbols.exclamation);
        const expr = SUBRULE1(primaryExpression, undefined);
        return {
          type: 'operation',
          operator: '!',
          args: [ expr ],
        };
      },
    },
    {
      ALT: () => {
        CONSUME(l.symbols.opPlus);
        const expr = SUBRULE2(primaryExpression, undefined);
        return {
          type: 'operation',
          operator: 'UPLUS',
          args: [ expr ],
        };
      },
    },
    {
      ALT: () => {
        CONSUME(l.symbols.opMinus);
        const expr = SUBRULE3(primaryExpression, undefined);
        return {
          type: 'operation',
          operator: 'UMINUS',
          args: [ expr ],
        };
      },
    },
    { ALT: () => SUBRULE4(primaryExpression, undefined) },
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
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.symbols.LParen);
    const expr = SUBRULE(expression, undefined);
    CONSUME(l.symbols.RParen);

    return expr;
  },
};

/**
 * [[128]](https://www.w3.org/TR/sparql11-query/#ririOrFunction)
 */
export const iriOrFunction: SparqlRule<'iriOrFunction', IriTerm | (IArgList & { function: IriTerm })> = <const> {
  name: 'iriOrFunction',
  impl: ({ SUBRULE, OPTION }) => () => {
    const iriVal = SUBRULE(iri, undefined);
    const args = OPTION(() => SUBRULE(argList, undefined));
    return args ?
        {
          ...args,
          function: iriVal,
        } :
      iriVal;
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    if ('function' in ast) {
      return `${SUBRULE(iri, ast.function, undefined)}${SUBRULE(argList, ast, undefined)}`;
    }
    return SUBRULE(iri, ast, undefined);
  },
};
