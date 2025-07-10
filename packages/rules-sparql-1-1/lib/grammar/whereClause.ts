import type { RuleDefReturn, Wrap } from '@traqula/core';
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
  PatternBgp,
} from '../RoundTripTypes';
import type {
  SparqlGeneratorRule,
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import { checkNote13 } from '../validation/validators';
import { builtInCall } from './builtIn';
import { argList, brackettedExpression, expression } from './expression';
import { var_, varOrIri, varOrTerm } from './general';
import { booleanLiteral, iri, numericLiteral, rdfLiteral } from './literals';
import { query, subSelect } from './queryUnit/queryUnit';
import { graphNodePath, triplesBlock } from './tripleBlock';

/**
 * [[17]](https://www.w3.org/TR/sparql11-query/#rWhereClause)
 */
export const whereClause: SparqlRule<'whereClause', Wrap<PatternGroup>> = <const> {
  name: 'whereClause',
  impl: ({ ACTION, SUBRULE, CONSUME, OPTION }) => (C) => {
    const where = OPTION(() => CONSUME(l.where));
    const group = SUBRULE(groupGraphPattern, undefined);
    return ACTION(() => C.factory.wrap(group, C.factory.sourceLocation(where, group)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('WHERE'));
    SUBRULE(groupGraphPattern, ast.val, undefined);
  },
};

/**
 * [[53]](https://www.w3.org/TR/sparql11-query/#rGroupGraphPattern)
 */
export const groupGraphPattern: SparqlRule<'groupGraphPattern', PatternGroup> = <const> {
  name: 'groupGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME, OR }) => (C) => {
    const open = CONSUME(l.symbols.LCurly);
    const patterns = OR<Pattern[]>([
      { ALT: () => [ SUBRULE(subSelect, undefined) ]},
      { ALT: () => SUBRULE(groupGraphPatternSub, undefined) },
    ]);
    const close = CONSUME(l.symbols.RCurly);

    return ACTION(() => C.factory.patternGroup(patterns, C.factory.sourceLocation(open, close)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('{'));

    for (const pattern of ast.patterns) {
      SUBRULE(generatePattern, pattern, undefined);
    }

    F.printFilter(ast, () => PRINT_WORD('}'));
  },
};

export const generatePattern: SparqlGeneratorRule<'generatePattern', Pattern> = {
  name: 'generatePattern',
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    if (ast.type === 'query') {
      SUBRULE(query, F.querySelect({
        context: [],
        datasets: F.datasetClauses([], F.sourceLocation()),
        where: ast.where,
        variables: ast.variables,
        solutionModifiers: ast.solutionModifiers,
        values: ast.values,
      }, ast.loc), undefined);
    } else if (ast.subType === 'group') {
      SUBRULE(groupGraphPattern, ast, undefined);
    } else if (ast.subType === 'bgp') {
      SUBRULE(triplesBlock, ast, undefined);
    } else {
      SUBRULE(graphPatternNotTriples, ast, undefined);
    }
  },
};

/**
 * [[54]](https://www.w3.org/TR/sparql11-query/#rGroupGraphPatternSub)
 */
export const groupGraphPatternSub:
SparqlGrammarRule<'groupGraphPatternSub', Pattern[]> = <const> {
  name: 'groupGraphPatternSub',
  impl: ({ ACTION, SUBRULE, CONSUME, MANY, SUBRULE1, SUBRULE2, OPTION1, OPTION2, OPTION3 }) => () => {
    const patterns: Pattern[] = [];

    const bgpPattern = OPTION1(() => SUBRULE1(triplesBlock, undefined));
    if (bgpPattern) {
      patterns.push(bgpPattern);
    }
    MANY(() => {
      const notTriples = SUBRULE(graphPatternNotTriples, undefined);
      patterns.push(notTriples);

      OPTION2(() => CONSUME(l.symbols.dot));

      const moreTriples = OPTION3(() => SUBRULE2(triplesBlock, undefined));
      if (moreTriples) {
        patterns.push(moreTriples);
      }
    });

    ACTION(() => checkNote13(patterns));

    return patterns;
  },
};

/**
 * [[56]](https://www.w3.org/TR/sparql11-query/#rGraphPatternNotTriples)
 */
export const graphPatternNotTriples: SparqlRule<'graphPatternNotTriples', Exclude<Pattern, SubSelect | PatternBgp>> = {
  name: 'graphPatternNotTriples',
  impl: ({ SUBRULE, OR }) => () => OR<RuleDefReturn<typeof graphPatternNotTriples>>([
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
    switch (ast.subType) {
      case 'group':
      case 'union':
        SUBRULE(groupOrUnionGraphPattern, ast, undefined);
        break;
      case 'optional':
        SUBRULE(optionalGraphPattern, ast, undefined);
        break;
      case 'minus':
        SUBRULE(minusGraphPattern, ast, undefined);
        break;
      case 'graph':
        SUBRULE(graphGraphPattern, ast, undefined);
        break;
      case 'service':
        SUBRULE(serviceGraphPattern, ast, undefined);
        break;
      case 'filter':
        SUBRULE(filter, ast, undefined);
        break;
      case 'bind':
        SUBRULE(bind, ast, undefined);
        break;
      case 'values':
        SUBRULE(inlineData, ast, undefined);
        break;
    }
  },
};

/**
 * [[57]](https://www.w3.org/TR/sparql11-query/#rOptionalGraphPattern)
 */
export const optionalGraphPattern: SparqlRule<'optionalGraphPattern', PatternOptional> = <const> {
  name: 'optionalGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const optional = CONSUME(l.optional);
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => C.factory.patternOptional(group.patterns, C.factory.sourceLocation(optional, group)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('OPTIONAL'));
    SUBRULE(groupGraphPattern, F.patternGroup(ast.patterns, ast.loc), undefined);
  },
};

/**
 * [[58]](https://www.w3.org/TR/sparql11-query/#rGraphGraphPattern)
 */
export const graphGraphPattern: SparqlRule<'graphGraphPattern', PatternGraph> = <const> {
  name: 'graphGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const graph = CONSUME(l.graph.graph);
    const name = SUBRULE(varOrIri, undefined);
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => C.factory.patternGraph(name, group.patterns, C.factory.sourceLocation(graph, group)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('GRAPH'));
    SUBRULE(varOrTerm, ast.name, undefined);
    SUBRULE(groupGraphPattern, F.patternGroup(ast.patterns, ast.loc), undefined);
  },
};

/**
 * [[59]](https://www.w3.org/TR/sparql11-query/#rServiceGraphPattern)
 */
export const serviceGraphPattern: SparqlRule<'serviceGraphPattern', PatternService> = <const> {
  name: 'serviceGraphPattern',
  impl: ({ ACTION, SUBRULE1, CONSUME, OPTION }) => (C) => {
    const service = CONSUME(l.service);
    const silent = OPTION(() => {
      CONSUME(l.silent);
      return true;
    }) ?? false;
    const name = SUBRULE1(varOrIri, undefined);
    const group = SUBRULE1(groupGraphPattern, undefined);

    return ACTION(() =>
      C.factory.patternService(name, group.patterns, silent, C.factory.sourceLocation(service, group)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => {
      PRINT_WORD('SERVICE');
      if (ast.silent) {
        PRINT_WORD('SILENT');
      }
    });
    SUBRULE(varOrTerm, ast.name, undefined);
    SUBRULE(groupGraphPattern, F.patternGroup(ast.patterns, ast.loc), undefined);
  },
};

/**
 * [[60]](https://www.w3.org/TR/sparql11-query/#rBind)
 */
export const bind: SparqlRule<'bind', PatternBind> = <const> {
  name: 'bind',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const bind = CONSUME(l.bind);
    CONSUME(l.symbols.LParen);
    const expressionVal = SUBRULE(expression, undefined);
    CONSUME(l.as);
    const variable = SUBRULE(var_, undefined);
    const close = CONSUME(l.symbols.RParen);

    return ACTION(() => C.factory.patternBind(expressionVal, variable, C.factory.sourceLocation(bind, close)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('BIND', '('));
    SUBRULE(expression, ast.expression, undefined);
    F.printFilter(ast, () => PRINT_WORD('AS'));
    SUBRULE(var_, ast.variable, undefined);
    F.printFilter(ast, () => PRINT_WORD(')'));
  },
};

/**
 * [[61]](https://www.w3.org/TR/sparql11-query/#rInlineData)
 */
export const inlineData: SparqlRule<'inlineData', PatternValues> = <const> {
  name: 'inlineData',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const values = CONSUME(l.values);
    const datablock = SUBRULE(dataBlock, undefined);

    return ACTION(() => C.factory.patternValues(datablock.val, C.factory.sourceLocation(values, datablock)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    const variables = Object.keys(ast.values[0]);
    F.printFilter(ast, () => {
      PRINT_WORD('VALUES', '(');
      for (const variable of variables) {
        PRINT_WORD(`?${variable}`);
      }
      PRINT_WORD(')', '{');
    });

    for (const mapping of ast.values) {
      F.printFilter(ast, () => PRINT_WORD('('));
      for (const variable of variables) {
        if (mapping[variable] === undefined) {
          F.printFilter(ast, () => PRINT_WORD('UNDEF'));
        } else {
          SUBRULE(graphNodePath, mapping[variable], undefined);
        }
      }
      F.printFilter(ast, () => PRINT_WORD(')'));
    }
    F.printFilter(ast, () => PRINT_WORD('}'));
  },
};

/**
 * [[62]](https://www.w3.org/TR/sparql11-query/#rDataBlock)
 */
export const dataBlock: SparqlGrammarRule<'dataBlock', Wrap<ValuePatternRow[]>> = <const> {
  name: 'dataBlock',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(inlineDataOneVar, undefined) },
    { ALT: () => SUBRULE(inlineDataFull, undefined) },
  ]),
};

/**
 * [[63]](https://www.w3.org/TR/sparql11-query/#rInlineDataOneVar)
 */
export const inlineDataOneVar: SparqlGrammarRule<'inlineDataOneVar', Wrap<ValuePatternRow[]>> = <const> {
  name: 'inlineDataOneVar',
  impl: ({ ACTION, SUBRULE, CONSUME, MANY }) => (C) => {
    const res: ValuePatternRow[] = [];
    const varVal = SUBRULE(var_, undefined);
    CONSUME(l.symbols.LCurly);
    MANY(() => {
      const value = SUBRULE(dataBlockValue, undefined);
      ACTION(() => {
        res.push({ [varVal.value]: value });
      });
    });
    const close = CONSUME(l.symbols.RCurly);

    return ACTION(() => C.factory.wrap(res, C.factory.sourceLocation(varVal, close)));
  },
};

/**
 * [[64]](https://www.w3.org/TR/sparql11-query/#rInlineDataFull)
 */
export const inlineDataFull: SparqlGrammarRule<'inlineDataFull', Wrap<ValuePatternRow[]>> = <const> {
  name: 'inlineDataFull',
  impl: ({
    ACTION,
    OR,
    MANY1,
    MANY2,
    MANY3,
    MANY4,
    SUBRULE,
    CONSUME1,
    CONSUME2,
  }) => (C) => {
    const res: ValuePatternRow[] = [];
    const vars: TermVariable[] = [];
    return OR<RuleDefReturn<typeof inlineDataFull>>([
      { ALT: () => {
        // Grammar rule 64 together with note 11 learns us that a nil should be followed by a nil in DataBlock.
        const nil = CONSUME1(l.terminals.nil);
        CONSUME1(l.symbols.LCurly);
        MANY1(() => {
          CONSUME2(l.terminals.nil);
          res.push({});
        });
        const close = CONSUME1(l.symbols.RCurly);

        return ACTION(() => C.factory.wrap(res, C.factory.sourceLocation(nil, close)));
      } },
      { ALT: () => {
        const open = CONSUME1(l.symbols.LParen);
        MANY2(() => {
          vars.push(SUBRULE(var_, undefined));
        });
        CONSUME1(l.symbols.RParen);
        CONSUME2(l.symbols.LCurly);
        MANY3(() => {
          let parsedValues = 0;
          const currentRow: ValuePatternRow = {};
          CONSUME2(l.symbols.LParen);
          MANY4(() => {
            if (parsedValues >= vars.length) {
              throw new Error('Number of dataBlockValues does not match number of variables. Too much values.');
            }
            const value = SUBRULE(dataBlockValue, undefined);
            ACTION(() => {
              currentRow[vars[parsedValues].value] = value;
              parsedValues++;
            });
          });
          CONSUME2(l.symbols.RParen);
          ACTION(() => {
            res.push(currentRow);
            if (vars.length !== parsedValues) {
              throw new Error('Number of dataBlockValues does not match number of variables. Too few values.');
            }
          });
        });
        const close = CONSUME2(l.symbols.RCurly);
        return ACTION(() => C.factory.wrap(res, C.factory.sourceLocation(open, close)));
      } },
    ]);
  },
};

/**
 * [[65]](https://www.w3.org/TR/sparql11-query/#rDataBlockValue)
 */
export const dataBlockValue: SparqlGrammarRule<'dataBlockValue', TermIri | TermBlank | TermLiteral | undefined> = {
  name: 'dataBlockValue',
  impl: ({ SUBRULE, CONSUME, OR }) => () => OR<RuleDefReturn<typeof dataBlockValue>>([
    { ALT: () => SUBRULE(iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(numericLiteral, undefined) },
    { ALT: () => SUBRULE(booleanLiteral, undefined) },
    { ALT: () => {
      CONSUME(l.undef);
      // eslint-disable-next-line unicorn/no-useless-undefined
      return undefined;
    } },
  ]),
};

/**
 * [[66]](https://www.w3.org/TR/sparql11-query/#rMinusGraphPattern)
 */
export const minusGraphPattern: SparqlRule<'minusGraphPattern', PatternMinus> = <const> {
  name: 'minusGraphPattern',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const minus = CONSUME(l.minus);
    const group = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => C.factory.patternMinus(group.patterns, C.factory.sourceLocation(minus, group)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('MINUS'));
    SUBRULE(groupGraphPattern, F.patternGroup(ast.patterns, ast.loc), undefined);
  },
};

/**
 * [[67]](https://www.w3.org/TR/sparql11-query/#rGroupOrUnionGraphPattern)
 */
export const groupOrUnionGraphPattern: SparqlRule<'groupOrUnionGraphPattern', PatternGroup | PatternUnion> =
  <const> {
    name: 'groupOrUnionGraphPattern',
    impl: ({ ACTION, MANY, SUBRULE1, SUBRULE2, CONSUME }) => (C) => {
      const groups: PatternGroup[] = [];

      const group = SUBRULE1(groupGraphPattern, undefined);
      groups.push(group);
      MANY(() => {
        CONSUME(l.union);
        const group = SUBRULE2(groupGraphPattern, undefined);
        groups.push(group);
      });

      return ACTION(() => groups.length === 1 ?
        groups[0] :
        C.factory.patternUnion(
          groups,
          C.factory.sourceLocation(group, groups.at(-1)),
        ));
    },
    gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
      if (F.isPatternUnion(ast)) {
        const [ head, ...tail ] = ast.patterns;
        SUBRULE(groupGraphPattern, head, undefined);
        for (const pattern of tail) {
          F.printFilter(ast, () => PRINT_WORD('UNION'));
          SUBRULE(groupGraphPattern, pattern, undefined);
        }
      } else {
        SUBRULE(groupGraphPattern, ast, undefined);
      }
    },
  };

/**
 * [[68]](https://www.w3.org/TR/sparql11-query/#rFilter)
 */
export const filter: SparqlRule<'filter', PatternFilter> = <const> {
  name: 'filter',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const filterToken = CONSUME(l.filter);
    const expression = SUBRULE(constraint, undefined);

    return ACTION(() => C.factory.patternFilter(expression, C.factory.sourceLocation(filterToken, expression)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('FILTER ('));
    SUBRULE(expression, ast.expression, undefined);
    F.printFilter(ast, () => PRINT_WORD(')'));
  },
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
  impl: ({ ACTION, SUBRULE }) => (C) => {
    const func = SUBRULE(iri, undefined);
    const args = SUBRULE(argList, undefined);
    return ACTION(() => C.factory.expressionFunctionCall(
      func,
      args.val.args,
      args.val.distinct,
      C.factory.sourceLocation(func, args),
    ));
  },
};
