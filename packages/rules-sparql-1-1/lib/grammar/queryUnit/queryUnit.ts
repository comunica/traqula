import type { RuleDefReturn } from '@traqula/core';
import * as l from '../../lexer';
import type {
  PatternBgp,
  PatternBind,
  PatternValues,
  Query,
  QueryAsk,
  QueryConstruct,
  QueryDescribe,
  QuerySelect,
  SubSelect,
  TermIri,
  TermVariable,
  Triple,
} from '../../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../../Sparql11types';
import type { Ignores1, Ignores2, Images2, ITOS, Wrap } from '../../TypeHelpersRTT';
import { Wildcard } from '../../Wildcard';
import { datasetClauses } from '../dataSetClause';
import { expression } from '../expression';
import { blank, prologue, var_, varOrIri } from '../general';
import { solutionModifier } from '../solutionModifier';
import { triplesTemplate } from '../tripleBlock';
import { inlineData, whereClause } from '../whereClause';

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
        where: where.val.patterns,
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
        where: where.val.patterns,
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
export const selectClause: SparqlRule<'selectClause', Wrap<QuerySelect['variables']> & Images2 & Ignores2> = <const> {
  name: 'selectClause',
  impl: ({
    ACTION,
    AT_LEAST_ONE,
    SUBRULE1,
    SUBRULE2,
    SUBRULE3,
    SUBRULE4,
    SUBRULE5,
    SUBRULE6,
    CONSUME,
    OPTION,
    OR1,
    OR2,
    OR3,
  }) => (C) => {
    const img1 = CONSUME(l.select).image;
    const i0 = SUBRULE1(blank, undefined);
    const couldParseAgg = ACTION(() => C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));

    const img2 = OPTION(() => {
      const img2 = OR1([
        { ALT: () => CONSUME(l.distinct).image },
        { ALT: () => CONSUME(l.reduced).image },
      ]);
      const i1 = SUBRULE2(blank, undefined);
      return <const> [ i1, img2 ];
    }) ?? [[], '' ];

    let i2: ITOS = [];
    const val = OR2<RuleDefReturn<typeof selectClause>['val']>([
      { ALT: () => {
        CONSUME(l.symbols.star);
        i2 = SUBRULE3(blank, undefined);
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
            CONSUME(l.symbols.LParen);
            const i0 = SUBRULE4(blank, undefined);
            const expr = SUBRULE1(expression, undefined);
            const img1 = CONSUME(l.as).image;
            const i1 = SUBRULE5(blank, undefined);
            const variable = SUBRULE2(var_, undefined);
            CONSUME(l.symbols.RParen);
            const i2 = SUBRULE6(blank, undefined);
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
      i2,
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
  impl: ({ ACTION, SUBRULE1, SUBRULE2, CONSUME, OR }) => () => {
    const img1 = CONSUME(l.construct).image;
    const i0 = SUBRULE1(blank, undefined);
    return OR<Omit<QueryConstruct, HandledByBase>>([
      { ALT: () => {
        const template = SUBRULE1(constructTemplate, undefined);
        const from = SUBRULE1(datasetClauses, undefined);
        const where = SUBRULE1(whereClause, undefined);
        const modifiers = SUBRULE1(solutionModifier, undefined);
        return ACTION(() => {
          const { val, ...RTT } = where;
          return {
            queryType: 'construct',
            template: template.val,
            datasets: from,
            where: val.patterns,
            solutionModifiers: modifiers,
            RTT: {
              ...RTT,
              templateIgnored: template.ignored,
              templateBraces: [ template.i0, template.i1 ],
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
        const img2 = CONSUME(l.where).image;
        const i1 = SUBRULE2(blank, undefined);
        // ConstructTemplate is same as '{' TriplesTemplate? '}'
        const template = SUBRULE2(constructTemplate, undefined);
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
            templateIgnored: template ? template.ignored : [],
            templateBraces: template ? [ template.i0, template.i1 ] : [[], []],
            whereBraces: [],
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
export const describeQuery: SparqlRule<'describeQuery', Omit<QueryDescribe, HandledByBase>> = <const> {
  name: 'describeQuery',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE1, SUBRULE2, CONSUME, OPTION, OR }) => () => {
    const img1 = CONSUME(l.describe).image;
    const i0 = SUBRULE1(blank, undefined);
    let i1: ITOS = [];
    const variables = OR<QueryDescribe['variables']>([
      { ALT: () => {
        const variables: (TermVariable | TermIri)[] = [];
        AT_LEAST_ONE(() => {
          variables.push(SUBRULE1(varOrIri, undefined));
        });
        return variables;
      } },
      { ALT: () => {
        CONSUME(l.symbols.star);
        i1 = SUBRULE2(blank, undefined);
        return [ new Wildcard() ];
      } },
    ]);
    const from = SUBRULE1(datasetClauses, undefined);
    const where = OPTION(() => SUBRULE1(whereClause, undefined));
    const modifiers = SUBRULE1(solutionModifier, undefined);
    return ACTION(() => ({
      queryType: 'describe',
      variables,
      datasets: from,
      ...(where && { where: where.val.patterns }),
      solutionModifiers: modifiers,
      RTT: {
        where: where ? [ where.i0, where.img1 ] : [[], '' ],
        img1,
        i0,
        i1,
        // TODO: push up
        whereBraces: [],
      },
    } satisfies Omit<QueryDescribe, HandledByBase>));
  },
  gImpl: () => () => '',
};

/**
 * [[12]](https://www.w3.org/TR/sparql11-query/#rAskQuery)
 */
export const askQuery: SparqlRule<'askQuery', Omit<QueryAsk, HandledByBase>> = <const> {
  name: 'askQuery',
  impl: ({ ACTION, SUBRULE, CONSUME }) => () => {
    const img1 = CONSUME(l.ask).image;
    const i0 = SUBRULE(blank, undefined);
    const from = SUBRULE(datasetClauses, undefined);
    const where = SUBRULE(whereClause, undefined);
    const modifiers = SUBRULE(solutionModifier, undefined);
    return ACTION(() => ({
      queryType: 'ask',
      datasets: from,
      where: where.val.patterns,
      solutionModifiers: modifiers,
      RTT: {
        where: where ? [ where.i0, where.img1 ] : [[], '' ],
        img1,
        i0,
        // TODO: push up
        whereBraces: [],
      },
    } satisfies Omit<QueryAsk, HandledByBase>));
  },
  gImpl: () => () => '',
};

/**
 * [[28]](https://www.w3.org/TR/sparql11-query/#rValuesClause)
 */
export const valuesClause: SparqlRule<'valuesClause', PatternValues | undefined> = <const> {
  name: 'valuesClause',
  impl: ({ OPTION, SUBRULE }) => () => OPTION(() => SUBRULE(inlineData, undefined)),
  gImpl: ({ SUBRULE }) => ast => ast ? SUBRULE(inlineData, ast, undefined) : '',
};

/**
 * [[73]](https://www.w3.org/TR/sparql11-query/#ConstructTemplate)
 */
export const constructTemplate:
SparqlRule<'constructTemplate', Wrap<Triple[]> & Ignores1 & { ignored: ITOS[] }> = <const> {
  name: 'constructTemplate',
  impl: ({ SUBRULE1, SUBRULE2, CONSUME, OPTION }) => () => {
    CONSUME(l.symbols.LCurly);
    const i0 = SUBRULE1(blank, undefined);
    const triples = OPTION(() => SUBRULE1(constructTriples, undefined));
    CONSUME(l.symbols.RCurly);
    const i1 = SUBRULE2(blank, undefined);
    return { val: triples?.val ?? [], i0, i1, ignored: triples?.ignored ?? []};
  },
  gImpl: () => () => '',
};

/**
 * [[12]](https://www.w3.org/TR/sparql11-query/#rConstructTriples)
 */
export const constructTriples: SparqlGrammarRule<'constructTriples', RuleDefReturn<typeof triplesTemplate>> = <const> {
  name: 'constructTriples',
  impl: triplesTemplate.impl,
};
