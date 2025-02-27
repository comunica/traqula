import * as l from '../lexer';
import type {
  Expression,
  ExpressionFunctionCall,
  PatternFilter,
  Pattern,
  PatternGroup,
  PatternUnion,
  PatternMinus,
  TermIri,
  TermBlank,
  TermLiteral,
  PatternBind,
  PatternService,
} from '../RoundTripTypes';
import type {
  BindPattern,
  FilterPattern,
  SparqlGrammarRule,
  SparqlRule,
  ValuePatternRow,
} from '../Sparql11types';
import type { ITOS } from '../TypeHelpersRTT';
import { isVariable } from '../utils';
import { builtInCall } from './builtIn';
import { argList, brackettedExpression, expression } from './expression';
import { blank, graphTerm, var_, varOrIri, varOrTerm } from './general';
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
export const groupGraphPattern: SparqlRule<'groupGraphPattern', PatternGroup> = <const> {
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
    const builder = [ '{' ];
    for (const pattern of patterns) {
      if ('queryType' in pattern) {
        builder.push(SUBRULE(query, { ...pattern, prefixes: {}}, undefined));
      } else if (pattern.type === 'bgp') {
        builder.push(SUBRULE(triplesBlock, pattern, undefined));
      } else {
        builder.push(SUBRULE(graphPatternNotTriples, pattern, undefined));
      }
    }
    builder.push('}');
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
export const serviceGraphPattern: SparqlRule<'serviceGraphPattern', PatternService> = <const> {
  name: 'serviceGraphPattern',
  impl: ({ SUBRULE1, SUBRULE2, CONSUME, OPTION }) => ({ factory: F }) => {
    const i0 = SUBRULE1(blank, undefined);
    const img1 = CONSUME(l.service).image;
    const silent = OPTION(() => {
      const i1 = SUBRULE2(blank, undefined);
      const img2 = CONSUME(l.silent).image;
      return { i1, img2 };
    }) ?? { i1: [], img2: '' };
    const name = SUBRULE1(varOrIri, undefined);
    const group = SUBRULE1(groupGraphPattern, undefined);

    return F.patternService(i0, silent.i1, group.RTT.i0, group.RTT.i1, img1, silent.img2, name, group.patterns);
  },
  gImpl: ({ SUBRULE }) => ast =>
    `SERVICE ${ast.silent ? 'SILENT ' : ''}${SUBRULE(varOrTerm, ast.name, undefined)}`,
};

/**
 * [[60]](https://www.w3.org/TR/sparql11-query/#rBind)
 */
export const bind: SparqlRule<'bind', PatternBind> = <const> {
  name: 'bind',
  impl: ({ SUBRULE, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4 }) => ({ factory: F }) => {
    const i0 = SUBRULE1(blank, undefined);
    const img1 = CONSUME(l.bind).image;
    const i1 = SUBRULE2(blank, undefined);
    CONSUME(l.symbols.LParen);
    const expressionVal = SUBRULE(expression, undefined);
    const i2 = SUBRULE3(blank, undefined);
    const img2 = CONSUME(l.as).image;
    const variable = SUBRULE(var_, undefined);
    const i3 = SUBRULE4(blank, undefined);
    CONSUME(l.symbols.RParen);

    return F.patternBind(i0, i1, i2, i3, img1, img2, expressionVal, variable);
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
export const dataBlockValue: SparqlRule<'dataBlockValue', TermIri | TermBlank | TermLiteral | string> = <const> {
  name: 'dataBlockValue',
  impl: ({ SUBRULE, CONSUME, OR }) => () => OR<TermIri | TermBlank | TermLiteral | string>([
    { ALT: () => SUBRULE(iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(numericLiteral, undefined) },
    { ALT: () => SUBRULE(booleanLiteral, undefined) },
    { ALT: () => CONSUME(l.undef).image },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    if (typeof ast === 'string') {
      return ast;
    }
    return SUBRULE(graphTerm, ast, undefined);
  },
};

/**
 * [[66]](https://www.w3.org/TR/sparql11-query/#rMinusGraphPattern)
 */
export const minusGraphPattern: SparqlRule<'minusGraphPattern', PatternMinus> = <const> {
  name: 'minusGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.minus).image;
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => F.patternMinus(i0, group.RTT.i0, group.RTT.i1, img1, group.patterns));
  },
  gImpl: () => () =>
    ``,
};

/**
 * [[67]](https://www.w3.org/TR/sparql11-query/#rGroupOrUnionGraphPattern)
 */
export const groupOrUnionGraphPattern: SparqlRule<'groupOrUnionGraphPattern', PatternGroup | PatternUnion> =
  <const> {
    name: 'groupOrUnionGraphPattern',
    impl: ({ MANY, SUBRULE1, SUBRULE2, CONSUME }) => ({ factory: F }) => {
      const groups: PatternGroup[] = [];
      const ignored: ITOS[] = [];
      const images: string[] = [];

      const group = SUBRULE1(groupGraphPattern, undefined);
      groups.push(group);
      MANY(() => {
        const ix = SUBRULE1(blank, undefined);
        const imgx = CONSUME(l.union).image;
        const group = SUBRULE2(groupGraphPattern, undefined);
        ignored.push(ix);
        images.push(imgx);
        groups.push(group);
      });

      return groups.length === 1 ?
        groups[0] :
        F.patternUnion(ignored, images, groups.map(group => F.deGroupSingle(group)));
    },
    gImpl: () => () => '',
  };

/**
 * [[68]](https://www.w3.org/TR/sparql11-query/#rFilter)
 */
export const filter: SparqlRule<'filter', PatternFilter> = <const> {
  name: 'filter',
  impl: ({ SUBRULE, CONSUME }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.filter).image;
    const expression = SUBRULE(constraint, undefined);
    return F.patternFilter(i0, img1, expression);
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
export const functionCall: SparqlGrammarRule<'functionCall', ExpressionFunctionCall> = <const> {
  name: 'functionCall',
  impl: ({ SUBRULE }) => () => {
    const func = SUBRULE(iri, undefined);
    const args = SUBRULE(argList, undefined);
    return {
      type: 'expression',
      expressionType: 'functionCall',
      args: args.args,
      function: func,
      distinct: args.img1 !== '',
      RTT: {
        ignored: args.ignored,
        img1: args.img1,
      },
    };
  },
};
