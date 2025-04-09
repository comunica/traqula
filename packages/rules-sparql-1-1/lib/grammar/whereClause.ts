import * as l from '../lexer';
import type {
  BindPattern,
  BlankTerm,
  BlockPattern,
  Expression,
  FilterPattern,
  FunctionCallExpression,
  GraphPattern,
  GroupPattern,
  IriTerm,
  LiteralTerm,
  MinusPattern,
  OptionalPattern,
  Pattern,
  ServicePattern,
  SparqlGrammarRule,
  SparqlRule,
  UnionPattern,
  ValuePatternRow,
  ValuesPattern,
  VariableTerm,
} from '../Sparql11types';
import { deGroupSingle, isVariable } from '../utils';
import { builtInCall } from './builtIn';
import { argList, brackettedExpression, expression } from './expression';
import { graphTerm, var_, varOrIri, varOrTerm } from './general';
import { booleanLiteral, iri, numericLiteral, rdfLiteral } from './literals';
import { query, subSelect, valuesClause } from './queryUnit/queryUnit';
import { triplesBlock } from './tripleBlock';

/**
 * [[17]](https://www.w3.org/TR/sparql11-query/#rWhereClause)
 */
export const whereClause: SparqlGrammarRule<'whereClause', Pattern[]> = <const> {
  name: 'whereClause',
  impl: ({ ACTION, SUBRULE, CONSUME, OPTION }) => () => {
    OPTION(() => {
      CONSUME(l.where);
    });
    const group = SUBRULE(groupGraphPattern, undefined);
    return ACTION(() => group.patterns);
  },
};

/**
 * [[53]](https://www.w3.org/TR/sparql11-query/#rGroupGraphPattern)
 */
export const groupGraphPattern: SparqlRule<'groupGraphPattern', GroupPattern> = <const> {
  name: 'groupGraphPattern',
  impl: ({ SUBRULE, CONSUME, OR }) => () => {
    CONSUME(l.symbols.LCurly);
    const patterns = OR([
      { ALT: () => [ SUBRULE(subSelect, undefined) ]},
      { ALT: () => SUBRULE(groupGraphPatternSub, undefined) },
    ]);
    CONSUME(l.symbols.RCurly);
    return {
      type: 'group',
      patterns,
    };
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const patterns = ast.patterns;
    const builder = [ '{\n' ];
    for (const pattern of patterns) {
      if ('queryType' in pattern) {
        builder.push(SUBRULE(query, { ...pattern, prefixes: {}}, undefined));
      } else if (pattern.type === 'bgp') {
        builder.push(SUBRULE(triplesBlock, pattern, undefined));
      } else {
        builder.push(SUBRULE(graphPatternNotTriples, pattern, undefined));
      }
    }
    builder.push('\n}');
    return builder.join(' ');
  },
};

function findBoundVarsFromGroupGraphPattern(pattern: Pattern, boundedVars: Set<string>): void {
  if ('triples' in pattern) {
    for (const triple of pattern.triples) {
      if (isVariable(triple.subject)) {
        boundedVars.add(triple.subject.value);
      }
      if (isVariable(triple.predicate)) {
        boundedVars.add(triple.predicate.value);
      }
      if (isVariable(triple.object)) {
        boundedVars.add(triple.object.value);
      }
    }
  } else if ('patterns' in pattern) {
    for (const pat of pattern.patterns) {
      findBoundVarsFromGroupGraphPattern(pat, boundedVars);
    }
  }
}

/**
 * [[54]](https://www.w3.org/TR/sparql11-query/#rGroupGraphPatternSub)
 */
export const groupGraphPatternSub: SparqlGrammarRule<'groupGraphPatternSub', Pattern[]> = <const> {
  name: 'groupGraphPatternSub',
  impl: ({ ACTION, SUBRULE, CONSUME, MANY, SUBRULE1, SUBRULE2, OPTION1, OPTION2, OPTION3 }) => () => {
    const patterns: Pattern[] = [];

    const bgpPattern = OPTION1(() => SUBRULE1(triplesBlock, undefined));
    ACTION(() => {
      if (bgpPattern) {
        patterns.push(bgpPattern);
      }
    });
    MANY(() => {
      const notTriples = SUBRULE(graphPatternNotTriples, undefined);
      patterns.push(notTriples);
      OPTION2(() => CONSUME(l.symbols.dot));
      const moreTriples = OPTION3(() => SUBRULE2(triplesBlock, undefined));
      ACTION(() => {
        if (moreTriples) {
          patterns.push(moreTriples);
        }
      });
    });

    // Check note 13 of the spec.
    // TODO: currently optimized for case bind is present.
    //  Since every iteration, even when no bind is present, we walk the tree collecting variables.
    //  optimize either by: checking whether bind is present, or by keeping track of variables and passing them through
    ACTION(() => {
      const boundedVars = new Set<string>();
      for (const pattern of patterns) {
        // Element can be bind, in that case, check note 13. If it is not, buildup set of bounded variables.
        if (pattern.type === 'bind') {
          if (boundedVars.has(pattern.variable.value)) {
            throw new Error(`Variable used to bind is already bound (?${pattern.variable.value})`);
          }
        } else if (pattern.type === 'group' || pattern.type === 'bgp') {
          findBoundVarsFromGroupGraphPattern(pattern, boundedVars);
        }
      }
    });

    return patterns;
  },
};

/**
 * [[56]](https://www.w3.org/TR/sparql11-query/#rGraphPatternNotTriples)
 */
type GraphPatternNotTriplesReturn = ValuesPattern | BindPattern | FilterPattern | BlockPattern;
export const graphPatternNotTriples: SparqlRule<'graphPatternNotTriples', GraphPatternNotTriplesReturn> = {
  name: 'graphPatternNotTriples',
  impl: ({ SUBRULE, OR }) => () => OR<GraphPatternNotTriplesReturn>([
    { ALT: () => SUBRULE(groupOrUnionGraphPattern, undefined) },
    { ALT: () => SUBRULE(optionalGraphPattern, undefined) },
    { ALT: () => SUBRULE(minusGraphPattern, undefined) },
    { ALT: () => SUBRULE(graphGraphPattern, undefined) },
    { ALT: () => SUBRULE(serviceGraphPattern, undefined) },
    { ALT: () => SUBRULE(filter, undefined) },
    { ALT: () => SUBRULE(bind, undefined) },
    { ALT: () => SUBRULE(inlineData, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    switch (ast.type) {
      case 'group':
      case 'union':
        return SUBRULE(groupOrUnionGraphPattern, ast, undefined);
      case 'optional':
        return SUBRULE(optionalGraphPattern, ast, undefined);
      case 'minus':
        return SUBRULE(minusGraphPattern, ast, undefined);
      case 'graph':
        return SUBRULE(graphGraphPattern, ast, undefined);
      case 'service':
        return SUBRULE(serviceGraphPattern, ast, undefined);
      case 'filter':
        return SUBRULE(filter, ast, undefined);
      case 'bind':
        return SUBRULE(bind, ast, undefined);
      case 'values':
        return SUBRULE(valuesClause, ast.values, undefined);
    }
  },
};

/**
 * [[57]](https://www.w3.org/TR/sparql11-query/#rOptionalGraphPattern)
 */
export const optionalGraphPattern: SparqlRule<'optionalGraphPattern', OptionalPattern> = <const> {
  name: 'optionalGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME }) => () => {
    CONSUME(l.optional);
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => ({
      type: 'optional',
      patterns: group.patterns,
    }));
  },
  gImpl: ({ SUBRULE }) => ast =>
    `OPTIONAL ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.patterns }, undefined)}`,
};

/**
 * [[58]](https://www.w3.org/TR/sparql11-query/#rGraphGraphPattern)
 */
export const graphGraphPattern: SparqlRule<'graphGraphPattern', GraphPattern> = <const> {
  name: 'graphGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME }) => () => {
    CONSUME(l.graph.graph);
    const name = SUBRULE(varOrIri, undefined);
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => ({
      type: 'graph',
      name,
      patterns: group.patterns,
    }));
  },
  gImpl: ({ SUBRULE }) => ast =>
    `GRAPH ${SUBRULE(varOrTerm, ast.name, undefined)} ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.patterns }, undefined)}`,
};

/**
 * [[59]](https://www.w3.org/TR/sparql11-query/#rServiceGraphPattern)
 */
export const serviceGraphPattern: SparqlRule<'serviceGraphPattern', ServicePattern> = <const> {
  name: 'serviceGraphPattern',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => {
    CONSUME(l.service);
    const silent = Boolean(OPTION(() => CONSUME(l.silent)));
    const name = SUBRULE(varOrIri, undefined);
    const group = SUBRULE(groupGraphPattern, undefined);

    return {
      type: 'service',
      name,
      silent,
      patterns: group.patterns,
    };
  },
  gImpl: ({ SUBRULE }) => ast =>
    `SERVICE ${ast.silent ? 'SILENT ' : ''}${SUBRULE(varOrTerm, ast.name, undefined)} ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.patterns }, undefined)}`,
};

/**
 * [[60]](https://www.w3.org/TR/sparql11-query/#rBind)
 */
export const bind: SparqlRule<'bind', BindPattern> = <const> {
  name: 'bind',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.bind);
    CONSUME(l.symbols.LParen);
    const expressionVal = SUBRULE(expression, undefined);
    CONSUME(l.as);
    const variable = SUBRULE(var_, undefined);
    CONSUME(l.symbols.RParen);

    return {
      type: 'bind',
      variable,
      expression: expressionVal,
    };
  },
  gImpl: ({ SUBRULE }) => ast =>
    `BIND ( ${SUBRULE(expression, ast.expression, undefined)} AS ${SUBRULE(var_, ast.variable, undefined)} )`,
};

/**
 * [[61]](https://www.w3.org/TR/sparql11-query/#rInlineData)
 */
export const inlineData: SparqlGrammarRule<'inlineData', ValuesPattern> = <const> {
  name: 'inlineData',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.values);
    const values = SUBRULE(dataBlock, undefined);

    return {
      type: 'values',
      values,
    };
  },
};

/**
 * [[62]](https://www.w3.org/TR/sparql11-query/#rDataBlock)
 */
export const dataBlock: SparqlGrammarRule<'dataBlock', ValuePatternRow[]> = <const> {
  name: 'dataBlock',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(inlineDataOneVar, undefined) },
    { ALT: () => SUBRULE(inlineDataFull, undefined) },
  ]),
};

/**
 * [[63]](https://www.w3.org/TR/sparql11-query/#rInlineDataOneVar)
 */
export const inlineDataOneVar: SparqlGrammarRule<'inlineDataOneVar', ValuePatternRow[]> = <const> {
  name: 'inlineDataOneVar',
  impl: ({ ACTION, SUBRULE, CONSUME, MANY }) => () => {
    const res: ValuePatternRow[] = [];
    const varVal = SUBRULE(var_, undefined);
    CONSUME(l.symbols.LCurly);
    MANY(() => {
      const value = SUBRULE(dataBlockValue, undefined);

      ACTION(() => res.push({
        [`?${varVal.value}`]: value,
      }));
    });
    CONSUME(l.symbols.RCurly);
    return res;
  },
};

/**
 * [[64]](https://www.w3.org/TR/sparql11-query/#rInlineDataFull)
 */
export const inlineDataFull: SparqlRule<'inlineDataFull', ValuePatternRow[]> = <const> {
  name: 'inlineDataFull',
  impl: ({ ACTION, OR, MANY1, MANY2, MANY3, MANY4, SUBRULE, CONSUME1, CONSUME2 }) => () => OR([
    // Grammar rule 64 together with note 11 learns us that a nil should be followed by a nil in DataBlock.
    {
      ALT: () => {
        const res: ValuePatternRow[] = [];
        CONSUME1(l.terminals.nil);
        CONSUME1(l.symbols.LCurly);
        MANY1(() => {
          CONSUME2(l.terminals.nil);
          res.push({});
        });
        CONSUME1(l.symbols.RCurly);
        return res;
      },
    },
    {
      ALT: () => {
        const res: ValuePatternRow[] = [];
        const vars: VariableTerm[] = [];

        CONSUME1(l.symbols.LParen);
        MANY2(() => {
          vars.push(SUBRULE(var_, undefined));
        });
        CONSUME1(l.symbols.RParen);

        CONSUME2(l.symbols.LCurly);
        MANY3(() => {
          const varBinds: ValuePatternRow[string][] = [];
          CONSUME2(l.symbols.LParen);
          MANY4({
            DEF: () => {
              ACTION(() => {
                if (vars.length <= varBinds.length) {
                  throw new Error('Number of dataBlockValues does not match number of variables. Too much values.');
                }
              });
              varBinds.push(SUBRULE(dataBlockValue, undefined));
            },
          });
          CONSUME2(l.symbols.RParen);

          ACTION(() => {
            if (varBinds.length !== vars.length) {
              throw new Error('Number of dataBlockValues does not match number of variables. Too few values.');
            }
            const row: ValuePatternRow = {};
            for (const [ index, varVal ] of vars.entries()) {
              row[`?${varVal.value}`] = varBinds[index];
            }
            res.push(row);
          });
        });
        CONSUME2(l.symbols.RCurly);
        return res;
      },
    },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    const variables = Object.keys(ast[0]);
    const variableString = `( ${variables.join(' ')} )`;

    const values = ast.map((mapping) => {
      const valueString = variables.map((variable) => {
        const value = mapping[variable];
        return value ? SUBRULE(dataBlockValue, value, undefined) : 'UNDEF';
      }).join(' ');
      return `( ${valueString} )`;
    });

    return `VALUES ${variableString} { ${values.join(' ')} }`;
  },
};

/**
 * [[65]](https://www.w3.org/TR/sparql11-query/#rDataBlockValue)
 */
export const dataBlockValue: SparqlRule<'dataBlockValue', IriTerm | BlankTerm | LiteralTerm | undefined> = <const> {
  name: 'dataBlockValue',
  impl: ({ SUBRULE, CONSUME, OR }) => () => OR< IriTerm | BlankTerm | LiteralTerm | undefined>([
    { ALT: () => SUBRULE(iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(numericLiteral, undefined) },
    { ALT: () => SUBRULE(booleanLiteral, undefined) },
    {
      ALT: () => {
        CONSUME(l.undef);
        // eslint-disable-next-line unicorn/no-useless-undefined
        return undefined;
      },
    },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    if (ast) {
      return SUBRULE(graphTerm, ast, undefined);
    }
    return 'UNDEF';
  },
};

/**
 * [[66]](https://www.w3.org/TR/sparql11-query/#rMinusGraphPattern)
 */
export const minusGraphPattern: SparqlRule<'minusGraphPattern', MinusPattern> = <const> {
  name: 'minusGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME }) => () => {
    CONSUME(l.minus);
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => ({
      type: 'minus',
      patterns: group.patterns,
    }));
  },
  gImpl: ({ SUBRULE }) => ast =>
    `MINUS ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.patterns }, undefined)}`,
};

/**
 * [[67]](https://www.w3.org/TR/sparql11-query/#rGroupOrUnionGraphPattern)
 */
export const groupOrUnionGraphPattern: SparqlRule<'groupOrUnionGraphPattern', GroupPattern | UnionPattern> =
  <const> {
    name: 'groupOrUnionGraphPattern',
    impl: ({ AT_LEAST_ONE_SEP, SUBRULE }) => () => {
      const groups: GroupPattern[] = [];

      AT_LEAST_ONE_SEP({
        DEF: () => {
          const group = SUBRULE(groupGraphPattern, undefined);
          groups.push(group);
        },
        SEP: l.union,
      });

      return groups.length === 1 ?
        groups[0] :
          {
            type: 'union',
            patterns: groups.map(group => deGroupSingle(group)),
          };
    },
    gImpl: ({ SUBRULE }) => (ast) => {
      if (ast.type === 'group') {
        return SUBRULE(groupGraphPattern, ast, undefined);
      }
      return ast.patterns.map(pattern => SUBRULE(groupGraphPattern, {
        type: 'group',
        patterns: [ pattern ],
      }, undefined)).join(' UNION ');
    },
  };

/**
 * [[68]](https://www.w3.org/TR/sparql11-query/#rFilter)
 */
export const filter: SparqlRule<'filter', FilterPattern> = <const> {
  name: 'filter',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.filter);
    const expression = SUBRULE(constraint, undefined);

    return {
      type: 'filter',
      expression,
    };
  },
  gImpl: ({ SUBRULE }) => ast =>
    `FILTER ( ${SUBRULE(expression, ast.expression, undefined)} )`,
};

/**
 * [[69]](https://www.w3.org/TR/sparql11-query/#rConstraint)
 */
export const constraint: SparqlGrammarRule<'constraint', Expression> = <const> {
  name: 'constraint',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(brackettedExpression, undefined) },
    { ALT: () => SUBRULE(builtInCall, undefined) },
    { ALT: () => SUBRULE(functionCall, undefined) },
  ]),
};

/**
 * [[70]](https://www.w3.org/TR/sparql11-query/#rFunctionCall)
 */
export const functionCall: SparqlGrammarRule<'functionCall', FunctionCallExpression> = <const> {
  name: 'functionCall',
  impl: ({ ACTION, SUBRULE }) => () => {
    const func = SUBRULE(iri, undefined);
    const args = SUBRULE(argList, undefined);
    return ACTION(() => ({
      ...args,
      function: func,
    }));
  },
};
