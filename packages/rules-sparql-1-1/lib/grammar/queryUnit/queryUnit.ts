import type { Localized, RuleDefReturn, Wrap } from '@traqula/core';
import type { IToken } from 'chevrotain';
import * as l from '../../lexer';
import type {
  BasicGraphPattern,
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
} from '../../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../../Sparql11types';
import { datasetClauseStar } from '../dataSetClause';
import { expression } from '../expression';
import { prologue, var_, varOrIri } from '../general';
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
  impl: ({ ACTION, SUBRULE, OR }) => (C) => {
    const prologueValues = SUBRULE(prologue, undefined);
    const queryType = OR<Omit<Query, HandledByBase>>([
      { ALT: () => SUBRULE(selectQuery, undefined) },
      { ALT: () => SUBRULE(constructQuery, undefined) },
      { ALT: () => SUBRULE(describeQuery, undefined) },
      { ALT: () => SUBRULE(askQuery, undefined) },
    ]);
    const values = SUBRULE(valuesClause, undefined);

    return ACTION(() => (<Query>{
      context: prologueValues,
      ...queryType,
      type: 'query',
      ...(values && { values }),
      loc: C.factory.sourceLocation(
        prologueValues.at(0),
        queryType,
        values,
      ),
    }));
  },
  gImpl: () => () => '',
};

/**
 * [[7]](https://www.w3.org/TR/sparql11-query/#rSelectQuery)
 */
export const selectQuery: SparqlRule<'selectQuery', Omit<QuerySelect, HandledByBase>> = <const> {
  name: 'selectQuery',
  impl: ({ ACTION, SUBRULE }) => (C) => {
    const selectVal = SUBRULE(selectClause, undefined);
    const from = SUBRULE(datasetClauseStar, undefined);
    const where = SUBRULE(whereClause, undefined);
    const modifiers = SUBRULE(solutionModifier, undefined);

    return ACTION(() => ({
      queryType: 'select',
      where: where.val.patterns,
      solutionModifiers: modifiers,
      datasets: from,
      ...selectVal.val,
      loc: C.factory.sourceLocation(
        selectVal,
        where,
        modifiers.group,
        modifiers.having,
        modifiers.order,
        modifiers.limitOffset,
      ),
    }));
  },
  gImpl: () => () => '',
};

/**
 * [[8]](https://www.w3.org/TR/sparql11-query/#rSubSelect)
 */
export const subSelect: SparqlRule<'subSelect', SubSelect> = <const> {
  name: 'subSelect',
  impl: ({ ACTION, SUBRULE }) => (C) => {
    const selectVal = SUBRULE(selectClause, undefined);
    const where = SUBRULE(whereClause, undefined);
    const modifiers = SUBRULE(solutionModifier, undefined);
    const values = SUBRULE(valuesClause, undefined);

    return ACTION(() => ({
      type: 'query',
      queryType: 'select',
      where: where.val.patterns,
      solutionModifiers: modifiers,
      ...selectVal.val,
      ...(values && { values }),
      loc: C.factory.sourceLocation(
        selectVal,
        where,
        modifiers.group,
        modifiers.having,
        modifiers.order,
        modifiers.limitOffset,
        values,
      ),
    }));
  },
  gImpl: () => () => {},
};

/**
 * [[9]](https://www.w3.org/TR/sparql11-query/#rSelectClause)
 */
export const selectClause: SparqlRule<'selectClause', Wrap<Pick<QuerySelect, 'variables' | 'distinct' | 'reduced'>>> = {
  name: 'selectClause',
  impl: ({
    ACTION,
    AT_LEAST_ONE,
    SUBRULE1,
    SUBRULE2,
    CONSUME,
    OPTION,
    OR1,
    OR2,
    OR3,
  }) => (C) => {
    const select = CONSUME(l.select);
    const couldParseAgg = ACTION(() => C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));

    const distinctAndReduced = OPTION(() => OR1<[boolean, boolean]>([
      { ALT: () => {
        CONSUME(l.distinct);
        return <const> [ true, false ];
      } },
      { ALT: () => {
        CONSUME(l.reduced);
        return <const> [ false, true ];
      } },
    ])) ?? [ false, false ];
    const distRed = ACTION(() => {
      const [ distinct, reduced ] = distinctAndReduced;
      return {
        ...(distinct && { distinct }),
        ...(reduced && { reduced }),
      };
    });

    let last: Localized | IToken;
    const val = OR2<RuleDefReturn<typeof selectClause>['val']>([
      { ALT: () => {
        const star = CONSUME(l.symbols.star);
        return ACTION(() => {
          last = star;
          return { variables: [ C.factory.wildcard(C.factory.sourceLocation(star)) ], ...distRed };
        });
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
              last = raw;
            });
          } },
          { ALT: () => {
            const open = CONSUME(l.symbols.LParen);
            const expr = SUBRULE1(expression, undefined);
            CONSUME(l.as);
            const variable = SUBRULE2(var_, undefined);
            const close = CONSUME(l.symbols.RParen);
            ACTION(() => {
              last = close;
              if (usedVars.some(v => v.value === variable.value)) {
                throw new Error(`Variable ${variable.value} used more than once in SELECT clause`);
              }
              usedVars.push(variable);
              variables.push(C.factory.patternBind(expr, variable, C.factory.sourceLocation(open, last)));
            });
          } },
        ]));
        return { variables, ...distRed };
      } },
    ]);
    ACTION(() => !couldParseAgg && C.parseMode.delete('canParseAggregate'));
    return ACTION(() => C.factory.wrap(val, C.factory.sourceLocation(select, last)));
  },
  gImpl: () => () => {},
};

/**
 * [[10]](https://www.w3.org/TR/sparql11-query/#rConstructQuery)
 */
export const constructQuery: SparqlRule<'constructQuery', Omit<QueryConstruct, HandledByBase>> = <const> {
  name: 'constructQuery',
  impl: ({ ACTION, SUBRULE1, SUBRULE2, CONSUME, OR }) => (C) => {
    const construct = CONSUME(l.construct);
    return OR<Omit<QueryConstruct, HandledByBase>>([
      { ALT: () => {
        const template = SUBRULE1(constructTemplate, undefined);
        const from = SUBRULE1(datasetClauseStar, undefined);
        const where = SUBRULE1(whereClause, undefined);
        const modifiers = SUBRULE1(solutionModifier, undefined);
        return ACTION(() => ({
          queryType: 'construct',
          template: template.val,
          datasets: from,
          where: where.val.patterns,
          solutionModifiers: modifiers,
          loc: C.factory.sourceLocation(
            construct,
            where,
            modifiers.group,
            modifiers.having,
            modifiers.order,
            modifiers.limitOffset,
          ),
        } satisfies Omit<QueryConstruct, HandledByBase>));
      } },
      { ALT: () => {
        const from = SUBRULE2(datasetClauseStar, undefined);
        CONSUME(l.where);
        // ConstructTemplate is same as '{' TriplesTemplate? '}'
        const template = SUBRULE2(constructTemplate, undefined);
        const modifiers = SUBRULE2(solutionModifier, undefined);

        return ACTION(() => ({
          queryType: 'construct',
          template: template ? template.val : [],
          datasets: from,
          where: [ C.factory.patternBgp(template.val, C.factory.sourceLocation()) ],
          solutionModifiers: modifiers,
          loc: C.factory.sourceLocation(
            construct,
            template,
            modifiers.group,
            modifiers.having,
            modifiers.order,
            modifiers.limitOffset,
          ),
        }));
      } },
    ]);
  },
  gImpl: () => () => {},
};

/**
 * [[11]](https://www.w3.org/TR/sparql11-query/#rDescribeQuery)
 */
export const describeQuery: SparqlRule<'describeQuery', Omit<QueryDescribe, HandledByBase>> = <const> {
  name: 'describeQuery',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE1, CONSUME, OPTION, OR }) => (C) => {
    const describe = CONSUME(l.describe);
    const variables = OR<QueryDescribe['variables']>([
      { ALT: () => {
        const variables: (TermVariable | TermIri)[] = [];
        AT_LEAST_ONE(() => {
          variables.push(SUBRULE1(varOrIri, undefined));
        });
        return variables;
      } },
      { ALT: () => {
        const star = CONSUME(l.symbols.star);
        return [ ACTION(() => C.factory.wildcard(C.factory.sourceLocation(star))) ];
      } },
    ]);
    const from = SUBRULE1(datasetClauseStar, undefined);
    const where = OPTION(() => SUBRULE1(whereClause, undefined));
    const modifiers = SUBRULE1(solutionModifier, undefined);
    return ACTION(() => ({
      queryType: 'describe',
      variables,
      datasets: from,
      ...(where && { where: where.val.patterns }),
      solutionModifiers: modifiers,
      loc: C.factory.sourceLocation(
        describe,
        ...variables,
        from,
        where,
        modifiers.group,
        modifiers.having,
        modifiers.order,
        modifiers.limitOffset,
      ),
    }));
  },
  gImpl: () => () => '',
};

/**
 * [[12]](https://www.w3.org/TR/sparql11-query/#rAskQuery)
 */
export const askQuery: SparqlRule<'askQuery', Omit<QueryAsk, HandledByBase>> = <const> {
  name: 'askQuery',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const ask = CONSUME(l.ask);
    const from = SUBRULE(datasetClauseStar, undefined);
    const where = SUBRULE(whereClause, undefined);
    const modifiers = SUBRULE(solutionModifier, undefined);

    return ACTION(() => ({
      queryType: 'ask',
      datasets: from,
      where: where.val.patterns,
      solutionModifiers: modifiers,
      loc: C.factory.sourceLocation(
        ask,
        from,
        where,
        modifiers.group,
        modifiers.having,
        modifiers.order,
        modifiers.limitOffset,
      ),
    }));
  },
  gImpl: () => () => {},
};

/**
 * [[28]](https://www.w3.org/TR/sparql11-query/#rValuesClause)
 */
export const valuesClause: SparqlGrammarRule<'valuesClause', PatternValues | undefined> = <const> {
  name: 'valuesClause',
  impl: ({ OPTION, SUBRULE }) => () => OPTION(() => SUBRULE(inlineData, undefined)),
};

/**
 * [[73]](https://www.w3.org/TR/sparql11-query/#ConstructTemplate)
 */
export const constructTemplate: SparqlRule<'constructTemplate', Wrap<BasicGraphPattern>> = <const> {
  name: 'constructTemplate',
  impl: ({ ACTION, SUBRULE1, CONSUME, OPTION }) => (C) => {
    const open = CONSUME(l.symbols.LCurly);
    const triples = OPTION(() => SUBRULE1(constructTriples, undefined));
    const close = CONSUME(l.symbols.RCurly);

    return ACTION(() => C.factory.wrap(triples?.val ?? [], C.factory.sourceLocation(open, close)));
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
