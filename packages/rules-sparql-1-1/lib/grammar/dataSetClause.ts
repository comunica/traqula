import type { RuleDefReturn } from '@traqula/core';
import type { TokenType } from 'chevrotain';
import * as l from '../lexer';
import type { DatasetClauses, TermIri, Wrap } from '../RoundTripTypes';
import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import { iri } from './literals';

export function datasetClauseUsing<RuleName extends 'usingClause' | 'datasetClause'>(
  name: RuleName,
  token: TokenType,
): SparqlGrammarRule<RuleName, Wrap<{ named: boolean; value: TermIri }>> {
  return {
    name,
    impl: ({ ACTION, SUBRULE, CONSUME, OR }) => (C) => {
      const start = CONSUME(token);
      return OR<RuleDefReturn<typeof datasetClause>>([
        { ALT: () => {
          const iri = SUBRULE(defaultGraphClause, undefined);
          return ACTION(() => ({
            val: { named: false, value: iri },
            ...C.factory.sourceLocation(start, iri.loc),
          }));
        } },
        { ALT: () => {
          const namedClause = SUBRULE(namedGraphClause, undefined);
          return ACTION(() => ({
            val: { named: true, value: namedClause.val },
            ...C.factory.sourceLocation(start, namedClause),
          }));
        } },
      ]);
    },
  };
}

/**
 * [[13]](https://www.w3.org/TR/sparql11-query/#rDatasetClause)
 */
export const datasetClause = datasetClauseUsing('datasetClause', l.from);

/**
 * [[14]](https://www.w3.org/TR/sparql11-query/#rDefaultGraphClause)
 */
export const defaultGraphClause: SparqlGrammarRule<'defaultGraphClause', TermIri> = <const> {
  name: 'defaultGraphClause',
  impl: ({ SUBRULE }) => () => SUBRULE(sourceSelector, undefined),
};
/**
 * [[44]](https://www.w3.org/TR/sparql11-query/#rUsingClause)
 */
export const usingClause = datasetClauseUsing('usingClause', l.usingClause);

export function datasetClauseUsingStar<RuleName extends string>(
  name: RuleName,
  subRule: ReturnType<typeof datasetClauseUsing<any>>,
): SparqlRule<RuleName, DatasetClauses> {
  return {
    name,
    impl: ({ ACTION, MANY, SUBRULE }) => (C) => {
      const _default: TermIri[] = [];
      const named: TermIri[] = [];
      let first: RuleDefReturn<typeof datasetClause> | undefined;
      let last: RuleDefReturn<typeof datasetClause> | undefined;

      MANY(() => {
        const clause = SUBRULE(subRule, undefined);
        if (!first) {
          first = clause;
        }
        last = clause;
        ACTION(() => {
          if (clause.val.named) {
            named.push(clause.val.value);
          } else {
            _default.push(clause.val.value);
          }
        });
      });
      return {
        type: 'datasetClauses',
        default: _default,
        named,
        loc: C.factory.sourceLocation(...[ first, last ].filter(x => x !== undefined)),
      } satisfies DatasetClauses;
    },
    gImpl: () => () => '',
  };
}

export const datasetClauseStar = datasetClauseUsingStar(<const> 'datasetClauses', datasetClause);
export const usingClauseStar = datasetClauseUsingStar(<const> 'usingClauses', usingClause);

/**
 * [[15]](https://www.w3.org/TR/sparql11-query/#rNamedGraphClause)
 */
export const namedGraphClause: SparqlGrammarRule<'namedGraphClause', Wrap<TermIri>> = <const> {
  name: 'namedGraphClause',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const named = CONSUME(l.graph.named);
    const iri = SUBRULE(sourceSelector, undefined);
    return ACTION(() => ({ val: iri, ...C.factory.sourceLocation(named, iri.loc) }));
  },
};

/**
 * [[16]](https://www.w3.org/TR/sparql11-query/#rSourceSelector)
 */
export const sourceSelector: SparqlGrammarRule<'sourceSelector', TermIri> = <const> {
  name: 'sourceSelector',
  impl: ({ SUBRULE }) => () => SUBRULE(iri, undefined),
};
