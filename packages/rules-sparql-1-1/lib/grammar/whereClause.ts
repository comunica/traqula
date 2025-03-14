import type { RuleDefReturn } from '@traqula/core';
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
  PatternOptional,
  PatternGraph,
  PatternValues,
  ValuePatternRow,
  TermVariable,
  SubSelect,
  EmptyGroup,
} from '../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import type { Ignores, Images, ITOS, Wrap } from '../TypeHelpersRTT';
import { builtInCall } from './builtIn';
import { argList, brackettedExpression, expression } from './expression';
import { blank, graphTerm, var_, varOrIri, varOrTerm } from './general';
import { booleanLiteral, iri, numericLiteral, rdfLiteral } from './literals';
import { subSelect } from './queryUnit/queryUnit';
import { triplesBlock } from './tripleBlock';

/**
 * [[17]](https://www.w3.org/TR/sparql11-query/#rWhereClause)
 */
export const whereClause: SparqlGrammarRule<'whereClause', Wrap<PatternGroup> & Images & Ignores> = <const> {
  name: 'whereClause',
  impl: ({ ACTION, SUBRULE, CONSUME, OPTION }) => () => {
    const { i0, img1 } = OPTION(() => {
      const i0 = SUBRULE(blank, undefined);
      const img1 = CONSUME(l.where).image;
      return { i0, img1 };
    }) ?? { i0: [], img1: '' };
    const group = SUBRULE(groupGraphPattern, undefined);
    return ACTION(() => ({ val: group, img1, i0 }));
  },
};

/**
 * [[53]](https://www.w3.org/TR/sparql11-query/#rGroupGraphPattern)
 */
export const groupGraphPattern: SparqlRule<'groupGraphPattern', PatternGroup> = <const> {
  name: 'groupGraphPattern',
  impl: ({ SUBRULE, SUBRULE1, SUBRULE2, CONSUME, OR }) => () => {
    const i0 = SUBRULE1(blank, undefined);
    CONSUME(l.symbols.LCurly);
    const patterns = OR<SubSelect | RuleDefReturn<typeof groupGraphPatternSub>>([
      { ALT: () => SUBRULE(subSelect, undefined) },
      { ALT: () => SUBRULE(groupGraphPatternSub, undefined) },
    ]);
    const i1 = SUBRULE2(blank, undefined);
    CONSUME(l.symbols.RCurly);

    if ('type' in patterns) {
      return {
        type: 'pattern',
        patternType: 'group',
        patterns: [ patterns ],
        RTT: {
          i0,
          i1,
          dotTracker: {},
          emptyGroups: {},
        },
      };
    }
    return patterns([ i0, i1 ]);
  },
  gImpl: () => () => '',
};

// Type Patch1<StartType extends {[K in Name]: any }, Name extends keyof StartType, NewType> =
//   {[K in keyof StartType]: K extends Name ? NewType : StartType[K] };
//
// type Patch2<
//   StartType extends {[K1 in Name1]: {[K2 in Name2]: any }},
// Name1 extends keyof StartType,
// Name2 extends keyof StartType[Name1],
// NewType,
// > =
//   {[K1 in keyof StartType]: K1 extends Name1 ? Patch1<StartType[K1], Name2, NewType> : StartType[K1] };

/**
 * [[54]](https://www.w3.org/TR/sparql11-query/#rGroupGraphPatternSub)
 */
export const groupGraphPatternSub:
SparqlGrammarRule<'groupGraphPatternSub', (braces: [ITOS, ITOS]) => PatternGroup> = <const> {
  name: 'groupGraphPatternSub',
  impl: ({ ACTION, SUBRULE, CONSUME, MANY, SUBRULE1, SUBRULE2, OPTION1, OPTION2, OPTION3 }) => ({ factory: F }) => {
    const patterns: Pattern[] = [];
    const dotTracker: Record<number, ITOS> = {};
    const emptyGroups: Record<number, EmptyGroup[]> = {};

    const bgpPattern = OPTION1(() => SUBRULE1(triplesBlock, undefined));
    ACTION(() => {
      if (bgpPattern) {
        patterns.push(bgpPattern);
      }
    });
    MANY(() => {
      const notTriples = SUBRULE(graphPatternNotTriples, undefined);

      const dot = OPTION2(() => {
        const ix = SUBRULE1(blank, undefined);
        CONSUME(l.symbols.dot);
        return ix;
      });
      if (F.isPatternGroup(notTriples) && notTriples.patterns.length < 2) {
        const degrouped = F.deGroup(notTriples)(dot);
        if (F.isPattern(degrouped)) {
          // Degrouped handles own dot.
          patterns.push(notTriples);
        } else {
          const key = patterns.length;
          if (!emptyGroups[key]) {
            emptyGroups[key] = [];
          }
          emptyGroups[key].push(degrouped);
        }
      } else {
        if (dot) {
          dotTracker[patterns.length] = dot;
        }
        patterns.push(notTriples);
      }

      const moreTriples = OPTION3(() => SUBRULE2(triplesBlock, undefined));
      ACTION(() => {
        if (moreTriples) {
          patterns.push(moreTriples);
        }
      });
    });

    // TODO: Check note 13 of the spec.
    // TODO: currently optimized for case bind is present.
    //  Since every iteration, even when no bind is present, we walk the tree collecting variables.
    //  optimize either by: checking whether bind is present, or by keeping track of variables and passing them through
    // ACTION(() => {
    //   const boundedVars = new Set<string>();
    //   for (const pattern of patterns) {
    //     // Element can be bind, in that case, check note 13. If it is not, buildup set of bounded variables.
    //     if (pattern.type === 'bind') {
    //       if (boundedVars.has(pattern.variable.value)) {
    //         throw new Error(`Variable used to bind is already bound (?${pattern.variable.value})`);
    //       }
    //     } else if (pattern.type === 'group' || pattern.type === 'bgp') {
    //       findBoundVarsFromGroupGraphPattern(pattern, boundedVars);
    //     }
    //   }
    // });

    return ([ i0, i1 ]) => ({
      type: 'pattern',
      patternType: 'group',
      patterns,
      RTT: {
        i0,
        i1,
        dotTracker,
        emptyGroups,
      },
    }) satisfies PatternGroup;
  },
};

/**
 * [[56]](https://www.w3.org/TR/sparql11-query/#rGraphPatternNotTriples)
 */
export const graphPatternNotTriples: SparqlRule<'graphPatternNotTriples', Pattern> = {
  name: 'graphPatternNotTriples',
  impl: ({ SUBRULE, OR }) => () => OR<Pattern>([
    { ALT: () => SUBRULE(groupOrUnionGraphPattern, undefined) },
    { ALT: () => SUBRULE(optionalGraphPattern, undefined) },
    { ALT: () => SUBRULE(minusGraphPattern, undefined) },
    { ALT: () => SUBRULE(graphGraphPattern, undefined) },
    { ALT: () => SUBRULE(serviceGraphPattern, undefined) },
    { ALT: () => SUBRULE(filter, undefined) },
    { ALT: () => SUBRULE(bind, undefined) },
    { ALT: () => SUBRULE(inlineData, undefined) },
  ]),
  gImpl: () => () => '',
};

/**
 * [[57]](https://www.w3.org/TR/sparql11-query/#rOptionalGraphPattern)
 */
export const optionalGraphPattern: SparqlRule<'optionalGraphPattern', PatternOptional> = <const> {
  name: 'optionalGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.optional).image;
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => ({
      type: 'pattern',
      patternType: 'optional',
      patterns: group.patterns,
      RTT: {
        i0,
        img1,
      },
    }));
  },
  gImpl: () => () => '',
};

/**
 * [[58]](https://www.w3.org/TR/sparql11-query/#rGraphGraphPattern)
 */
export const graphGraphPattern: SparqlRule<'graphGraphPattern', PatternGraph> = <const> {
  name: 'graphGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.graph.graph).image;
    const name = SUBRULE(varOrIri, undefined);
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => ({
      type: 'pattern',
      patternType: 'graph',
      name,
      patterns: group.patterns,
      RTT: {
        i0,
        img1,
      },
    }));
  },
  gImpl: () => () => '',
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
export const inlineData: SparqlRule<'inlineData', PatternValues> = <const> {
  name: 'inlineData',
  impl: ({ SUBRULE, CONSUME }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.values).image;
    const { values, ...RTT } = SUBRULE(dataBlock, undefined);

    return {
      type: 'pattern',
      patternType: 'values',
      values,
      RTT: {
        ...RTT,
        i0,
        img1,
      },
    };
  },
  gImpl: () => () => '',
};

/**
 * [[62]](https://www.w3.org/TR/sparql11-query/#rDataBlock)
 */
export const dataBlock:
SparqlGrammarRule<'dataBlock', Pick<PatternValues, 'values'> & Omit<PatternValues['RTT'], 'i0' | 'img1'>> = <const> {
  name: 'dataBlock',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(inlineDataOneVar, undefined) },
    { ALT: () => SUBRULE(inlineDataFull, undefined) },
  ]),
};

/**
 * [[63]](https://www.w3.org/TR/sparql11-query/#rInlineDataOneVar)
 */
export const inlineDataOneVar: SparqlGrammarRule<'inlineDataOneVar', RuleDefReturn<typeof dataBlock>> = <const> {
  name: 'inlineDataOneVar',
  impl: ({ ACTION, SUBRULE, SUBRULE1, SUBRULE2, CONSUME, MANY }) => ({ factory: F }) => {
    const res: ValuePatternRow[] = [];
    const undefRtt: [number, string, ITOS][] = [];
    const varVal = SUBRULE(var_, undefined);
    const i0 = SUBRULE1(blank, undefined);
    CONSUME(l.symbols.LCurly);
    MANY(() => {
      const value = SUBRULE(dataBlockValue, undefined);
      ACTION(() => {
        if (F.isTermIri(value) && F.isTermIriPrimitive(value) && value.value === 'UNDEF') {
          undefRtt.push([ res.length, value.RTT.img1, value.RTT.i0 ]);
          res.push({
            [`?${varVal.value}`]: undefined,
          });
        } else {
          res.push({
            [`?${varVal.value}`]: value,
          });
        }
      });
    });
    const i1 = SUBRULE2(blank, undefined);
    CONSUME(l.symbols.RCurly);
    return {
      varBrackets: [],
      vars: [ varVal ],
      valueBrackets: [ i0, i1 ],
      valueInnerBrackets: [],
      undefRtt,
      values: res,
    };
  },
};

/**
 * [[64]](https://www.w3.org/TR/sparql11-query/#rInlineDataFull)
 */
export const inlineDataFull: SparqlRule<'inlineDataFull', RuleDefReturn<typeof dataBlock>> = <const> {
  name: 'inlineDataFull',
  impl: ({
    ACTION,
    OR,
    MANY1,
    MANY2,
    MANY3,
    MANY4,
    SUBRULE,
    SUBRULE1,
    SUBRULE2,
    SUBRULE3,
    SUBRULE4,
    CONSUME1,
    CONSUME2,
  }) => ({ factory: F }) => {
    const res: ValuePatternRow[] = [];
    const valueInnerBrackets: [ITOS, ITOS][] = [];
    const vars: TermVariable[] = [];
    const undefRtt: [number, string, ITOS][] = [];
    const i0 = SUBRULE1(blank, undefined);
    return OR([
      { ALT: () => {
        // Grammar rule 64 together with note 11 learns us that a nil should be followed by a nil in DataBlock.
        const nil = CONSUME1(l.terminals.nil).image.slice(1, -1);
        const i1 = [ F.blankSpace(nil) ];
        const i2 = SUBRULE2(blank, undefined);
        CONSUME1(l.symbols.LCurly);
        MANY1(() => {
          const iInner0 = SUBRULE3(blank, undefined);
          const valuesNil = CONSUME2(l.terminals.nil);
          const iInner1 = [ F.blankSpace(valuesNil.image.slice(1, -1)) ];
          valueInnerBrackets.push([ iInner0, iInner1 ]);
          res.push({});
        });
        const i3 = SUBRULE2(blank, undefined);
        CONSUME1(l.symbols.RCurly);
        return {
          values: res,
          varBrackets: [ i0, i1 ],
          valueBrackets: [ i2, i3 ],
          undefRtt,
          valueInnerBrackets,
          vars,
        } satisfies RuleDefReturn<typeof dataBlock>;
      } },
      { ALT: () => {
        const res: ValuePatternRow[] = [];
        CONSUME1(l.symbols.LParen);
        MANY2(() => {
          vars.push(SUBRULE(var_, undefined));
        });
        const i1 = SUBRULE2(blank, undefined);
        CONSUME1(l.symbols.RParen);
        const i3 = SUBRULE3(blank, undefined);
        CONSUME2(l.symbols.LCurly);
        MANY3(() => {
          let parsedValues = 0;
          const currentRow: ValuePatternRow = {};
          const iInner0 = SUBRULE4(blank, undefined);
          CONSUME2(l.symbols.LParen);
          MANY4(() => {
            if (parsedValues >= vars.length) {
              throw new Error('Number of dataBlockValues does not match number of variables. Too much values.');
            }
            const value = SUBRULE(dataBlockValue, undefined);
            ACTION(() => {
              if (F.isTermIri(value) && F.isTermIriPrimitive(value) && value.value === 'UNDEF') {
                undefRtt.push([ res.length * vars.length + parsedValues, value.RTT.img1, value.RTT.i0 ]);
                currentRow[`?${vars[parsedValues].value}`] = undefined;
              } else {
                currentRow[`?${vars[parsedValues].value}`] = value;
              }
              parsedValues++;
            });
          });
          const iInner1 = SUBRULE4(blank, undefined);
          CONSUME2(l.symbols.RParen);
          ACTION(() => {
            valueInnerBrackets.push([ iInner0, iInner1 ]);
            res.push(currentRow);
            if (vars.length !== parsedValues) {
              throw new Error('Number of dataBlockValues does not match number of variables. Too few values.');
            }
          });
        });
        const i4 = SUBRULE2(blank, undefined);
        CONSUME2(l.symbols.RCurly);
        return {
          vars,
          valueInnerBrackets,
          undefRtt,
          valueBrackets: [ i3, i4 ],
          varBrackets: [ i0, i1 ],
          values: res,
        } satisfies RuleDefReturn<typeof dataBlock>;
      } },
    ]);
  },
  gImpl: () => () => '',
};

/**
 * [[65]](https://www.w3.org/TR/sparql11-query/#rDataBlockValue)
 */
export const dataBlockValue: SparqlRule<'dataBlockValue', TermIri | TermBlank | TermLiteral> = <const> {
  name: 'dataBlockValue',
  impl: ({ SUBRULE, CONSUME, OR }) => ({ factory: F }) => OR<RuleDefReturn<typeof dataBlockValue>>([
    { ALT: () => SUBRULE(iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(numericLiteral, undefined) },
    { ALT: () => SUBRULE(booleanLiteral, undefined) },
    { ALT: () => {
      const i0 = SUBRULE(blank, undefined);
      const img1 = CONSUME(l.undef).image;
      return F.namedNodePrimitive(i0, img1, 'UNDEF');
    } },
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
        F.patternUnion(ignored, images, groups.map(group => F.deGroupSingle(group)(undefined)));
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
