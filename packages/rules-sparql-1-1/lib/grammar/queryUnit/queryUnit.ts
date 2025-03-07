import type { RuleDefReturn } from '@traqula/core';
import * as l from '../../lexer';
import type {
  PatternBgp,
  PatternBind,
  PatternValues,
  Query,
  QueryConstruct,
  QuerySelect,
  SubSelect,
  TermVariable,
} from '../../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../../Sparql11types';
import type { Ignores1, Images2, Wrap } from '../../TypeHelpersRTT';
import { Wildcard } from '../../Wildcard';
import { datasetClauses } from '../dataSetClause';
import { expression } from '../expression';
import { blank, prologue, var_, varOrIri, varOrTerm } from '../general';
import { iri } from '../literals';
import { solutionModifier } from '../solutionModifier';
import { triplesBlock, triplesTemplate } from '../tripleBlock';
import { groupGraphPattern, inlineData, whereClause } from '../whereClause';

/**
 * [[1]](https://www.w3.org/TR/sparql11-query/#rQueryUnit)
 */
export const queryUnit: SparqlGrammarRule<'queryUnit', Query> = <const> {
  name: 'queryUnit',
  impl: ({ SUBRULE }) => () => SUBRULE(query, undefined),
};

export type HandledByBase = 'type' | 'context' | 'values';

/**
 * [[2]](https://www.w3.org/TR/sparql11-query/#rQuery)
 */
export const query: SparqlRule<'query', Query> = <const> {
  name: 'query',
  impl: ({ ACTION, SUBRULE, OR }) => () => {
    const prologueValues = SUBRULE(prologue, undefined);
    const queryType = OR<Omit<Query, HandledByBase>>([
      { ALT: () => SUBRULE(selectQuery, undefined) },
      { ALT: () => SUBRULE(constructQuery, undefined) },
      { ALT: () => SUBRULE(describeQuery, undefined) },
      { ALT: () => SUBRULE(askQuery, undefined) },
    ]);
    const values = SUBRULE(valuesClause, undefined);

    return ACTION(() => (<Query>{
      ...prologueValues,
      ...queryType,
      type: 'query',
      ...(values && { values }),
    }));
  },
  gImpl: () => () => '',
};

/**
 * [[7]](https://www.w3.org/TR/sparql11-query/#rSelectQuery)
 */
export const selectQuery: SparqlRule<'selectQuery', Omit<QuerySelect, HandledByBase>> = <const> {
  name: 'selectQuery',
  impl: ({ ACTION, SUBRULE }) => () => {
    const selectVal = SUBRULE(selectClause, undefined);
    const from = SUBRULE(datasetClauses, undefined);
    const where = SUBRULE(whereClause, undefined);
    const modifier = SUBRULE(solutionModifier, undefined);

    return ACTION(() => {
      const { val, ...RTT } = selectVal;
      return {
        queryType: 'select',
        where: where.val,
        solutionModifiers: modifier,
        datasets: from,
        variables: val,
        ...(RTT.img2.toLowerCase() === 'distinct' && { distinct: true }),
        ...(RTT.img2.toLowerCase() === 'reduced' && { reduced: true }),
        RTT: {
          ...RTT,
          where: [ where.i0, where.img1 ],
          whereBraces: [],
        },
      };
    });
  },
  gImpl: () => () => '',
};

/**
 * [[8]](https://www.w3.org/TR/sparql11-query/#rSubSelect)
 */
export const subSelect: SparqlGrammarRule<'subSelect', SubSelect> = <const> {
  name: 'subSelect',
  impl: ({ ACTION, SUBRULE }) => () => {
    const selectVal = SUBRULE(selectClause, undefined);
    const where = SUBRULE(whereClause, undefined);
    const modifier = SUBRULE(solutionModifier, undefined);
    const values = SUBRULE(valuesClause, undefined);

    return ACTION(() => {
      const { val, ...RTT } = selectVal;
      return {
        type: 'query',
        queryType: 'select',
        where: where.val,
        solutionModifiers: modifier,
        variables: val,
        ...(values && { values }),
        ...(RTT.img2.toLowerCase() === 'distinct' && { distinct: true }),
        ...(RTT.img2.toLowerCase() === 'reduced' && { reduced: true }),
        RTT: {
          ...RTT,
          where: [ where.i0, where.img1 ],
          whereBraces: [],
        },
      };
    });
  },
};

/**
 * [[9]](https://www.w3.org/TR/sparql11-query/#rSelectClause)
 */
export const selectClause: SparqlRule<'selectClause', Wrap<QuerySelect['variables']> & Images2 & Ignores1> = <const> {
  name: 'selectClause',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, OPTION, OR1, OR2, OR3 }) => (C) => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.select).image;
    const couldParseAgg = ACTION(() => C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));

    const img2 = OPTION(() => {
      const i1 = SUBRULE(blank, undefined);
      const img2 = OR1([
        { ALT: () => CONSUME(l.distinct).image },
        { ALT: () => CONSUME(l.reduced).image },
      ]);
      return <const> [ i1, img2 ];
    }) ?? [[], '' ];

    const val = OR2<RuleDefReturn<typeof selectClause>['val']>([
      { ALT: () => {
        CONSUME(l.symbols.star);
        return [ new Wildcard() ];
      } },
      { ALT: () => {
        const usedVars: TermVariable[] = [];
        const variables: (TermVariable | PatternBind)[] = [];
        AT_LEAST_ONE(() => OR3([
          { ALT: () => {
            const raw = SUBRULE1(var_, undefined);
            ACTION(() => {
              if (usedVars.some(v => v.value === raw.value)) {
                throw new Error(`Variable ${raw.value} used more than once in SELECT clause`);
              }
              usedVars.push(raw);
              variables.push(raw);
            });
          } },
          { ALT: () => {
            const i0 = SUBRULE(blank, undefined);
            CONSUME(l.symbols.LParen);
            const expr = SUBRULE(expression, undefined);
            const i1 = SUBRULE(blank, undefined);
            const img1 = CONSUME(l.as).image;
            const variable = SUBRULE2(var_, undefined);
            const i2 = SUBRULE(blank, undefined);
            CONSUME(l.symbols.RParen);
            ACTION(() => {
              if (usedVars.some(v => v.value === variable.value)) {
                throw new Error(`Variable ${variable.value} used more than once in SELECT clause`);
              }
              usedVars.push(variable);
              variables.push(C.factory.patternBind([], i0, i1, i2, '', img1, expr, variable));
            });
          } },
        ]));
        return variables;
      } },
    ]);
    ACTION(() => !couldParseAgg && C.parseMode.delete('canParseAggregate'));
    return {
      val,
      i0,
      i1: img2[0],
      img1,
      img2: img2[1],
    };
  },
  gImpl: () => () => '',
};

/**
 * [[10]](https://www.w3.org/TR/sparql11-query/#rConstructQuery)
 */
export const constructQuery: SparqlRule<'constructQuery', Omit<QueryConstruct, HandledByBase>> = <const> {
  name: 'constructQuery',
  impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, MANY2, OPTION, OR }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.construct).image;
    return OR<Omit<QueryConstruct, HandledByBase>>([
      { ALT: () => {
        const template = SUBRULE(constructTemplate, undefined);
        const from = SUBRULE(datasetClauses, undefined);
        const where = SUBRULE(whereClause, undefined);
        const modifiers = SUBRULE1(solutionModifier, undefined);
        return ACTION(() => {
          const { val, ...RTT } = where;
          return {
            queryType: 'construct',
            template: template ?? [],
            datasets: from,
            where: val,
            solutionModifiers: modifiers,
            RTT: {
              ...RTT,
              whereBraces: [],
              i0,
              img1,
              where: [ RTT.i0, RTT.img1 ],
            },
          } satisfies Omit<QueryConstruct, HandledByBase>;
        });
      } },
      { ALT: () => {
        const from = SUBRULE2(datasetClauses, undefined);
        const i1 = SUBRULE(blank, undefined);
        const img2 = CONSUME(l.where).image;
        const i2 = SUBRULE(blank, undefined);
        CONSUME(l.symbols.LCurly);
        const template = OPTION(() => SUBRULE(triplesTemplate, undefined));
        const i3 = SUBRULE(blank, undefined);
        CONSUME(l.symbols.RCurly);
        const modifiers = SUBRULE2(solutionModifier, undefined);
        const where: [PatternBgp] | [] = template ?
            [{
              type: 'pattern',
              patternType: 'bgp',
              triples: template.val,
              RTT: {
                ignored: template.ignored,
              },
            }] :
            [];

        return ACTION(() => ({
          queryType: 'construct',
          template: template ? template.val : [],
          datasets: from,
          where,
          solutionModifiers: modifiers,
          RTT: {
            whereBraces: [{ idx: 0, braceSpaces: [[ i2, i3 ]]}],
            img1,
            i0,
            where: [ i1, img2 ],
          },
        } satisfies Omit<QueryConstruct, HandledByBase>));
      } },
    ]);
  },
  gImpl: () => () => '',
};

/**
 * [[11]](https://www.w3.org/TR/sparql11-query/#rDescribeQuery)
 */
export const describeQuery: SparqlRule<'describeQuery', Omit<DescribeQuery, HandledByBase>> = <const> {
  name: 'describeQuery',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME, MANY, OPTION, OR }) => () => {
    CONSUME(l.describe);
    const variables = OR<DescribeQuery['variables']>([
      { ALT: () => {
        const variables: (VariableTerm | IriTerm)[] = [];
        AT_LEAST_ONE(() => {
          variables.push(SUBRULE(varOrIri, undefined));
        });
        return variables;
      } },
      { ALT: () => {
        CONSUME(l.symbols.star);
        return [ new Wildcard() ];
      } },
    ]);
    const from = extractFromOfDataSetClauses(ACTION, MANY, SUBRULE);
    const where = OPTION(() => SUBRULE(whereClause, undefined));
    const modifiers = SUBRULE(solutionModifier, undefined);
    return ACTION(() => ({
      ...modifiers,
      queryType: 'DESCRIBE',
      variables,
      from,
      where,
    }));
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ 'DESCRIBE' ];
    for (const variable of ast.variables) {
      if (variable.termType === 'Wildcard') {
        builder.push('*');
      } else {
        builder.push(SUBRULE(varOrTerm, variable, undefined));
      }
    }

    if (ast.from) {
      builder.push(ast.from.default.map(clause => `FROM ${SUBRULE(iri, clause, undefined)}`).join(' '));
      builder.push(ast.from.named.map(clause => `FROM NAMED ${SUBRULE(iri, clause, undefined)}`).join(' '));
    }

    if (ast.where) {
      builder.push(`WHERE ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.where }, undefined)}`);
    }
    builder.push(SUBRULE(solutionModifier, ast, undefined));
    return builder.join(' ');
  },
};

/**
 * [[12]](https://www.w3.org/TR/sparql11-query/#rAskQuery)
 */
export const askQuery: SparqlRule<'askQuery', Omit<AskQuery, HandledByBase>> = <const> {
  name: 'askQuery',
  impl: ({ ACTION, SUBRULE, CONSUME, MANY }) => () => {
    CONSUME(l.ask);
    const from = extractFromOfDataSetClauses(ACTION, MANY, SUBRULE);
    const where = SUBRULE(whereClause, undefined);
    const modifiers = SUBRULE(solutionModifier, undefined);
    return ACTION(() => ({
      ...modifiers,
      queryType: 'ASK',
      from,
      where,
    }));
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ 'ASK' ];
    if (ast.from) {
      builder.push(ast.from.default.map(clause => `FROM ${SUBRULE(iri, clause, undefined)}`).join(' '));
      builder.push(ast.from.named.map(clause => `FROM NAMED ${SUBRULE(iri, clause, undefined)}`).join(' '));
    }

    if (ast.where) {
      builder.push(`WHERE ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.where }, undefined)}`);
    }
    builder.push(SUBRULE(solutionModifier, ast, undefined));
    return builder.join(' ');
  },
};

/**
 * [[28]](https://www.w3.org/TR/sparql11-query/#rValuesClause)
 */
export const valuesClause: SparqlRule<'valuesClause', PatternValues | undefined> = <const> {
  name: 'valuesClause',
  impl: ({ OPTION, SUBRULE }) => () => OPTION(() =>
    OPTION(() => SUBRULE(inlineData, undefined))),
  gImpl: ({ SUBRULE }) => ast => ast ? SUBRULE(inlineData, ast, undefined) : '',
};

/**
 * [[73]](https://www.w3.org/TR/sparql11-query/#ConstructTemplate)
 */
export const constructTemplate: SparqlRule<'constructTemplate', Triple[] | undefined> = <const> {
  name: 'constructTemplate',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => {
    CONSUME(l.symbols.LCurly);
    const triples = OPTION(() => SUBRULE(constructTriples, undefined));
    CONSUME(l.symbols.RCurly);
    return triples;
  },
  gImpl: ({ SUBRULE }) => ast =>
    `{ ${ast ? SUBRULE(triplesBlock, { type: 'bgp', triples: ast }, undefined) : ''} }`,
};

/**
 * [[12]](https://www.w3.org/TR/sparql11-query/#rConstructTriples)
 */
export const constructTriples: SparqlGrammarRule<'constructTriples', Triple[]> = <const> {
  name: 'constructTriples',
  impl: triplesTemplate.impl,
};
