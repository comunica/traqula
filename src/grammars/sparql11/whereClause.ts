import * as l from '../../lexer/index';
import type { RuleDef } from '../buildExample';
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
  UnionPattern,
  ValuePatternRow,
  ValuesPattern,
  VariableTerm,
} from '../sparqlJSTypes';
import { builtInCall } from './builtIn';
import { argList, brackettedExpression, expression } from './expression';
import { var_, varOrIri } from './general';
import { booleanLiteral, iri, numericLiteral, rdfLiteral } from './literals';
import { subSelect } from './queryUnit';
import { triplesBlock } from './tripleBlock';

/**
 * [[17]](https://www.w3.org/TR/sparql11-query/#rWhereClause)
 */
export const whereClause: RuleDef<'whereClause', Pattern[]> = {
  name: 'whereClause',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => {
    OPTION(() => {
      CONSUME(l.where);
    });
    return SUBRULE(groupGraphPattern);
  },
};

/**
 * [[53]](https://www.w3.org/TR/sparql11-query/#rGroupGraphPattern)
 */
export const groupGraphPattern: RuleDef<'groupGraphPattern', Pattern[]> = {
  name: 'groupGraphPattern',
  impl: ({ SUBRULE, CONSUME, OR }) => () => {
    CONSUME(l.symbols.LCurly);
    const result = OR([
      { ALT: () => [ SUBRULE(subSelect) ]},
      { ALT: () => SUBRULE(groupGraphPatternSub) },
    ]);
    CONSUME(l.symbols.RCurly);
    return result;
  },
};

/**
 * [[54]](https://www.w3.org/TR/sparql11-query/#rGroupGraphPatternSub)
 */
export const groupGraphPatternSub: RuleDef<'groupGraphPatternSub', Pattern[]> = {
  name: 'groupGraphPatternSub',
  impl: ({ SUBRULE, CONSUME, MANY, SUBRULE1, SUBRULE2, OPTION1, OPTION2, OPTION3 }) => () => {
    const patterns: Pattern[] = [];

    const bgpPattern = OPTION1(() => [ SUBRULE1(triplesBlock) ]) ?? [];
    patterns.push(...bgpPattern);
    MANY(() => {
      const notTriples = SUBRULE(graphPatternNotTriples);
      patterns.push(notTriples);
      OPTION2(() => CONSUME(l.symbols.dot));

      const moreTriples = OPTION3(() => [ SUBRULE2(triplesBlock) ]) ?? [];
      patterns.push(...moreTriples);
    });

    return patterns;
  },
};

/**
 * [[56]](https://www.w3.org/TR/sparql11-query/#rGraphPatternNotTriples)
 */
type GraphPatternNotTriplesReturn = ValuesPattern | BindPattern | FilterPattern | BlockPattern;
export const graphPatternNotTriples:
RuleDef<'graphPatternNotTriples', GraphPatternNotTriplesReturn> = {
  name: 'graphPatternNotTriples',
  impl: ({ SUBRULE, OR }) => () => OR<GraphPatternNotTriplesReturn>([
    { ALT: () => SUBRULE(groupOrUnionGraphPattern) },
    { ALT: () => SUBRULE(optionalGraphPattern) },
    { ALT: () => SUBRULE(minusGraphPattern) },
    { ALT: () => SUBRULE(graphGraphPattern) },
    { ALT: () => SUBRULE(serviceGraphPattern) },
    { ALT: () => SUBRULE(filter) },
    { ALT: () => SUBRULE(bind) },
    { ALT: () => SUBRULE(inlineData) },
  ]),
};

/**
 * [[57]](https://www.w3.org/TR/sparql11-query/#rOptionalGraphPattern)
 */
export const optionalGraphPattern: RuleDef<'optionalGraphPattern', OptionalPattern> = {
  name: 'optionalGraphPattern',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.optional);
    const patterns = SUBRULE(groupGraphPattern);

    return {
      type: 'optional',
      patterns,
    };
  },
};

/**
 * [[67]](https://www.w3.org/TR/sparql11-query/#rGroupOrUnionGraphPattern)
 */
export const groupOrUnionGraphPattern: RuleDef<'groupOrUnionGraphPattern', GroupPattern | UnionPattern> = {
  name: 'groupOrUnionGraphPattern',
  impl: ({ AT_LEAST_ONE_SEP, SUBRULE }) => () => {
    const patterns: Pattern[] = [];

    AT_LEAST_ONE_SEP({
      DEF: () => {
        const subPatterns = SUBRULE(groupGraphPattern);
        if (subPatterns.length === 1) {
          patterns.push(subPatterns[0]);
        } else {
          patterns.push({
            type: 'group',
            patterns: subPatterns,
          });
        }
      },
      SEP: l.union,
    });

    return patterns.length === 1 ?
    // TODO: This cast might not be correct! (Test it)
        <GroupPattern> patterns[0] :
        {
          type: 'union',
          patterns,
        };
  },
};

/**
 * [[58]](https://www.w3.org/TR/sparql11-query/#rGraphGraphPattern)
 */
export const graphGraphPattern: RuleDef<'graphGraphPattern', GraphPattern> = {
  name: 'graphGraphPattern',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.graph.graph);
    const name = SUBRULE(varOrIri);
    const patterns = SUBRULE(groupGraphPattern);

    return {
      type: 'graph',
      name,
      patterns,
    };
  },
};

/**
 * [[59]](https://www.w3.org/TR/sparql11-query/#rServiceGraphPattern)
 */
export const serviceGraphPattern: RuleDef<'serviceGraphPattern', ServicePattern> = {
  name: 'serviceGraphPattern',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => {
    CONSUME(l.service);
    const silent = OPTION(() => {
      CONSUME(l.silent);
      return true;
    }) ?? false;
    const name = SUBRULE(varOrIri);
    const patterns = SUBRULE(groupGraphPattern);

    return {
      type: 'service',
      name,
      silent,
      patterns,
    };
  },
};

/**
 * [[60]](https://www.w3.org/TR/sparql11-query/#rBind)
 */
export const bind: RuleDef<'bind', BindPattern> = {
  name: 'bind',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.bind);
    CONSUME(l.symbols.LParen);
    const expressionVal = SUBRULE(expression);
    CONSUME(l.as);
    const variable = SUBRULE(var_);
    CONSUME(l.symbols.RParen);

    return {
      type: 'bind',
      variable,
      expression: expressionVal,
    };
  },
};

/**
 * [[61]](https://www.w3.org/TR/sparql11-query/#rInlineData)
 */
export const inlineData: RuleDef<'inlineData', ValuesPattern> = {
  name: 'inlineData',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.values);
    const values = SUBRULE(dataBlock);

    return {
      type: 'values',
      values,
    };
  },
};

/**
 * [[62]](https://www.w3.org/TR/sparql11-query/#rDataBlock)
 */
export const dataBlock: RuleDef<'dataBlock', ValuePatternRow[]> = {
  name: 'dataBlock',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(inlineDataOneVar) },
    { ALT: () => SUBRULE(inlineDataFull) },
  ]),
};

/**
 * [[63]](https://www.w3.org/TR/sparql11-query/#rInlineDataOneVar)
 */
export const inlineDataOneVar: RuleDef<'inlineDataOneVar', ValuePatternRow[]> = {
  name: 'inlineDataOneVar',
  impl: ({ SUBRULE, CONSUME, MANY }) => () => {
    const res: ValuePatternRow[] = [];
    const varVal = SUBRULE(var_);
    CONSUME(l.symbols.LCurly);
    MANY(() => {
      const value = SUBRULE(dataBlockValue);
      res.push({
        [varVal.value]: value,
      });
    });
    CONSUME(l.symbols.RCurly);
    return res;
  },
};

/**
 * [[64]](https://www.w3.org/TR/sparql11-query/#rInlineDataFull)
 */
export const inlineDataFull: RuleDef<'inlineDataFull', ValuePatternRow[]> = {
  name: 'inlineDataFull',
  impl: ({ OR, MANY, SUBRULE, CONSUME }) => () => OR([
    // Grammar rule 64 together with note 11 learns us that a nil should be followed by a nil in DataBlock.
    {
      ALT: () => {
        const res: ValuePatternRow[] = [];
        CONSUME(l.terminals.nil);
        CONSUME(l.symbols.LCurly);
        MANY(() => {
          CONSUME(l.terminals.nil);
          res.push({});
        });
        CONSUME(l.symbols.RCurly);
        return res;
      },
    },
    {
      ALT: () => {
        const res: ValuePatternRow[] = [];
        const vars: VariableTerm[] = [];

        CONSUME(l.symbols.LParen);
        MANY(() => {
          vars.push(SUBRULE(var_));
        });
        CONSUME(l.symbols.RParen);

        CONSUME(l.symbols.LCurly);
        MANY(() => {
          const varBinds: ValuePatternRow[string][] = [];
          CONSUME(l.symbols.LParen);
          MANY({
            GATE: () => vars.length > varBinds.length,
            DEF: () => {
              varBinds.push(SUBRULE(dataBlockValue));
            },
          });
          CONSUME(l.symbols.RParen);

          // TODO: what happens when I throw this error?
          if (varBinds.length !== vars.length) {
            throw new Error('Number of dataBlockValues does not match number of variables.');
          }
          const row: ValuePatternRow = {};
          for (const [ index, varVal ] of vars.entries()) {
            row[varVal.value] = varBinds[index];
          }
          res.push(row);
        });
        CONSUME(l.symbols.RCurly);
        return res;
      },
    },
  ]),
};

/**
 * [[65]](https://www.w3.org/TR/sparql11-query/#rDataBlockValue)
 */
export const dataBlockValue: RuleDef<'dataBlockValue', IriTerm | BlankTerm | LiteralTerm | undefined> = {
  name: 'dataBlockValue',
  impl: ({ SUBRULE, CONSUME, OR }) => () => OR< IriTerm | BlankTerm | LiteralTerm | undefined>([
    { ALT: () => SUBRULE(iri) },
    { ALT: () => SUBRULE(rdfLiteral) },
    { ALT: () => SUBRULE(numericLiteral) },
    { ALT: () => SUBRULE(booleanLiteral) },
    {
      ALT: () => {
        CONSUME(l.undef);
        // eslint-disable-next-line unicorn/no-useless-undefined
        return undefined;
      },
    },
  ]),
};

/**
 * [[66]](https://www.w3.org/TR/sparql11-query/#rMinusGraphPattern)
 */
export const minusGraphPattern: RuleDef<'minusGraphPattern', MinusPattern> = {
  name: 'minusGraphPattern',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.minus);
    const patterns = SUBRULE(groupGraphPattern);

    return {
      type: 'minus',
      patterns,
    };
  },
};

/**
 * [[68]](https://www.w3.org/TR/sparql11-query/#rFilter)
 */
export const filter: RuleDef<'filter', FilterPattern> = {
  name: 'filter',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.filter);
    const expression = SUBRULE(constraint);

    return {
      type: 'filter',
      expression,
    };
  },
};

/**
 * [[69]](https://www.w3.org/TR/sparql11-query/#rConstraint)
 */
export const constraint: RuleDef<'constraint', Expression> = {
  name: 'constraint',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(brackettedExpression) },
    { ALT: () => SUBRULE(builtInCall) },
    { ALT: () => SUBRULE(functionCall) },
  ]),
};

/**
 * [[70]](https://www.w3.org/TR/sparql11-query/#rFunctionCall)
 */
export const functionCall: RuleDef<'functionCall', FunctionCallExpression> = {
  name: 'functionCall',
  impl: ({ SUBRULE }) => () => {
    const func = SUBRULE(iri);
    const args = SUBRULE(argList);
    return {
      ...args,
      function: func,
    };
  },
};
