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
      const img1 = CONSUME(l.where).image;
      const i0 = SUBRULE(blank, undefined);
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
  impl: ({ ACTION, SUBRULE, SUBRULE1, SUBRULE2, CONSUME, OR }) => () => {
    CONSUME(l.symbols.LCurly);
    const i0 = SUBRULE1(blank, undefined);
    const patterns = OR<SubSelect | RuleDefReturn<typeof groupGraphPatternSub>>([
      { ALT: () => SUBRULE(subSelect, undefined) },
      { ALT: () => SUBRULE(groupGraphPatternSub, undefined) },
    ]);
    CONSUME(l.symbols.RCurly);
    const i1 = SUBRULE2(blank, undefined);

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
    return ACTION(() => patterns([ i0, i1 ]));
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
  impl: ({ ACTION, SUBRULE, CONSUME, MANY, SUBRULE1, SUBRULE2, OPTION1, OPTION2, OPTION3 }) => (C) => {
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
        CONSUME(l.symbols.dot);
        const ix = SUBRULE1(blank, undefined);
        return ix;
      });

      const moreTriples = OPTION3(() => SUBRULE2(triplesBlock, undefined));

      ACTION(() => {
        const F = C.factory;
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
    const img1 = CONSUME(l.optional).image;
    const i0 = SUBRULE(blank, undefined);
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
    const img1 = CONSUME(l.graph.graph).image;
    const i0 = SUBRULE(blank, undefined);
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
  impl: ({ ACTION, SUBRULE1, SUBRULE2, CONSUME, OPTION }) => (C) => {
    const img1 = CONSUME(l.service).image;
    const i0 = SUBRULE1(blank, undefined);
    const silent = OPTION(() => {
      const img2 = CONSUME(l.silent).image;
      const i1 = SUBRULE2(blank, undefined);
      return { i1, img2 };
    }) ?? { i1: [], img2: '' };
    const name = SUBRULE1(varOrIri, undefined);
    const group = SUBRULE1(groupGraphPattern, undefined);

    return ACTION(() =>
      C.factory.patternService(i0, silent.i1, group.RTT.i0, group.RTT.i1, img1, silent.img2, name, group.patterns));
  },
  gImpl: ({ SUBRULE }) => ast =>
    `SERVICE ${ast.silent ? 'SILENT ' : ''}${SUBRULE(varOrTerm, ast.name, undefined)}`,
};

/**
 * [[60]](https://www.w3.org/TR/sparql11-query/#rBind)
 */
export const bind: SparqlRule<'bind', PatternBind> = <const> {
  name: 'bind',
  impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4 }) => (C) => {
    const img1 = CONSUME(l.bind).image;
    const i0 = SUBRULE1(blank, undefined);
    CONSUME(l.symbols.LParen);
    const i1 = SUBRULE2(blank, undefined);
    const expressionVal = SUBRULE(expression, undefined);
    const img2 = CONSUME(l.as).image;
    const i2 = SUBRULE3(blank, undefined);
    const variable = SUBRULE(var_, undefined);
    CONSUME(l.symbols.RParen);
    const i3 = SUBRULE4(blank, undefined);

    return ACTION(() => C.factory.patternBind(i0, i1, i2, i3, img1, img2, expressionVal, variable));
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
    const img1 = CONSUME(l.values).image;
    const i0 = SUBRULE(blank, undefined);
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
  impl: ({ ACTION, SUBRULE, SUBRULE1, SUBRULE2, CONSUME, MANY }) => (C) => {
    const res: ValuePatternRow[] = [];
    const undefRtt: [number, string, ITOS][] = [];
    const varVal = SUBRULE(var_, undefined);
    CONSUME(l.symbols.LCurly);
    const i0 = SUBRULE1(blank, undefined);
    MANY(() => {
      const value = SUBRULE(dataBlockValue, undefined);
      ACTION(() => {
        const F = C.factory;
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
    CONSUME(l.symbols.RCurly);
    const i1 = SUBRULE2(blank, undefined);
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
    SUBRULE5,
    SUBRULE6,
    SUBRULE7,
    SUBRULE8,
    SUBRULE9,
    CONSUME1,
    CONSUME2,
  }) => (C) => {
    const res: ValuePatternRow[] = [];
    const valueInnerBrackets: [ITOS, ITOS][] = [];
    const vars: TermVariable[] = [];
    const undefRtt: [number, string, ITOS][] = [];
    return OR([
      { ALT: () => {
        // Grammar rule 64 together with note 11 learns us that a nil should be followed by a nil in DataBlock.
        const nil = CONSUME1(l.terminals.nil).image.slice(1, -1);
        const i0 = SUBRULE1(blank, undefined);
        const i1 = [ ACTION(() => C.factory.blankSpace(nil)) ];
        CONSUME1(l.symbols.LCurly);
        const i2 = SUBRULE2(blank, undefined);
        MANY1(() => {
          const valuesNil = CONSUME2(l.terminals.nil);
          const iInner0 = SUBRULE3(blank, undefined);
          const iInner1 = [ ACTION(() => C.factory.blankSpace(valuesNil.image.slice(1, -1))) ];
          valueInnerBrackets.push([ iInner0, iInner1 ]);
          res.push({});
        });
        CONSUME1(l.symbols.RCurly);
        const i3 = SUBRULE4(blank, undefined);
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
        const i0 = SUBRULE(blank, undefined);
        MANY2(() => {
          vars.push(SUBRULE(var_, undefined));
        });
        CONSUME1(l.symbols.RParen);
        const i1 = SUBRULE5(blank, undefined);
        CONSUME2(l.symbols.LCurly);
        const i3 = SUBRULE6(blank, undefined);
        MANY3(() => {
          let parsedValues = 0;
          const currentRow: ValuePatternRow = {};
          CONSUME2(l.symbols.LParen);
          const iInner0 = SUBRULE7(blank, undefined);
          MANY4(() => {
            if (parsedValues >= vars.length) {
              throw new Error('Number of dataBlockValues does not match number of variables. Too much values.');
            }
            const value = SUBRULE(dataBlockValue, undefined);
            ACTION(() => {
              const F = C.factory;
              if (F.isTermIri(value) && F.isTermIriPrimitive(value) && value.value === 'UNDEF') {
                undefRtt.push([ res.length * vars.length + parsedValues, value.RTT.img1, value.RTT.i0 ]);
                currentRow[`?${vars[parsedValues].value}`] = undefined;
              } else {
                currentRow[`?${vars[parsedValues].value}`] = value;
              }
              parsedValues++;
            });
          });
          CONSUME2(l.symbols.RParen);
          const iInner1 = SUBRULE8(blank, undefined);
          ACTION(() => {
            valueInnerBrackets.push([ iInner0, iInner1 ]);
            res.push(currentRow);
            if (vars.length !== parsedValues) {
              throw new Error('Number of dataBlockValues does not match number of variables. Too few values.');
            }
          });
        });
        CONSUME2(l.symbols.RCurly);
        const i4 = SUBRULE9(blank, undefined);
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
  impl: ({ ACTION, SUBRULE, CONSUME, OR }) => C => OR<RuleDefReturn<typeof dataBlockValue>>([
    { ALT: () => SUBRULE(iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(numericLiteral, undefined) },
    { ALT: () => SUBRULE(booleanLiteral, undefined) },
    { ALT: () => {
      const img1 = CONSUME(l.undef).image;
      const i0 = SUBRULE(blank, undefined);
      return ACTION(() => C.factory.namedNodePrimitive(i0, img1, 'UNDEF'));
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
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const img1 = CONSUME(l.minus).image;
    const i0 = SUBRULE(blank, undefined);
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => C.factory.patternMinus(i0, group.RTT.i0, group.RTT.i1, img1, group.patterns));
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
    impl: ({ ACTION, MANY, SUBRULE1, SUBRULE2, CONSUME }) => (C) => {
      const groups: PatternGroup[] = [];
      const ignored: ITOS[] = [];
      const images: string[] = [];

      const group = SUBRULE1(groupGraphPattern, undefined);
      groups.push(group);
      MANY(() => {
        const imgx = CONSUME(l.union).image;
        const ix = SUBRULE1(blank, undefined);
        const group = SUBRULE2(groupGraphPattern, undefined);
        ignored.push(ix);
        images.push(imgx);
        groups.push(group);
      });

      return ACTION(() => groups.length === 1 ?
        groups[0] :
        C.factory.patternUnion(
          ignored,
          images,
          groups.map(group => C.factory.deGroupSingle(group)(undefined)),
        ));
    },
    gImpl: () => () => '',
  };

/**
 * [[68]](https://www.w3.org/TR/sparql11-query/#rFilter)
 */
export const filter: SparqlRule<'filter', PatternFilter> = <const> {
  name: 'filter',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const img1 = CONSUME(l.filter).image;
    const i0 = SUBRULE(blank, undefined);
    const expression = SUBRULE(constraint, undefined);
    return ACTION(() => C.factory.patternFilter(i0, img1, expression));
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
