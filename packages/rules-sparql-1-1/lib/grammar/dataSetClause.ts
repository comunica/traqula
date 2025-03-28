import type { RuleDefReturn } from '@traqula/core';
import type { TokenType } from 'chevrotain';
import * as l from '../lexer';
import type { DatasetClauses, TermIri } from '../RoundTripTypes';
import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import type { CTOS, Ignores, Images, Wrap } from '../TypeHelpersRTT';
import { blank } from './general';
import { iri } from './literals';

export function datasetClauseUsing<RuleName extends 'usingClause' | 'datasetClause'>(
  name: RuleName,
  token: TokenType,
): SparqlGrammarRule<RuleName, { named: boolean; completion: CTOS; value: TermIri }> {
  return {
    name,
    impl: ({ ACTION, SUBRULE, CONSUME, OR }) => (C) => {
      const img1 = CONSUME(token).image;
      const i0 = SUBRULE(blank, undefined);
      return OR<RuleDefReturn<typeof datasetClause>>([
        { ALT: () => {
          const iri = SUBRULE(defaultGraphClause, undefined);
          return ACTION(() => ({
            named: false,
            completion: [ ...i0, C.factory.image(img1) ],
            value: iri,
          }));
        } },
        { ALT: () => {
          const namedClause = SUBRULE(namedGraphClause, undefined);
          return ACTION(() => {
            const { val, img1: img2, i0: i1 } = namedClause;
            return ACTION(() => ({
              named: true,
              completion: [ ...i0, C.factory.image(img1), ...i1, C.factory.image(img2) ],
              value: val,
            }));
          });
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

export function datasetClausesUsings<RuleName extends string>(
  name: RuleName,
  subRule: ReturnType<typeof datasetClauseUsing<any>>,
): SparqlRule<RuleName, DatasetClauses> {
  return {
    name,
    impl: ({ ACTION, MANY, SUBRULE }) => () => {
      const iter = 0;
      const completion: CTOS[] = [];
      const namedIndexes: number[] = [];
      const _default: TermIri[] = [];
      const named: TermIri[] = [];

      MANY(() => {
        const clause = SUBRULE(subRule, undefined);
        ACTION(() => {
          const { completion: partial, value, named: isNamed } = clause;
          completion.push(partial);
          if (isNamed) {
            namedIndexes.push(iter);
            named.push(value);
          } else {
            _default.push(value);
          }
        });
      });
      return {
        type: 'datasetClauses',
        default: _default,
        named,
        RTT: { namedIndexes, completion },
      } satisfies DatasetClauses;
    },
    gImpl: () => () => '',
  };
}

export const datasetClauses = datasetClausesUsings(<const> 'datasetClauses', datasetClause);
export const usingClauses = datasetClausesUsings(<const> 'usingClauses', usingClause);

/**
 * [[15]](https://www.w3.org/TR/sparql11-query/#rNamedGraphClause)
 */
export const namedGraphClause: SparqlGrammarRule<'namedGraphClause', Wrap<TermIri> & Ignores & Images> = <const> {
  name: 'namedGraphClause',
  impl: ({ SUBRULE, CONSUME }) => () => {
    const img1 = CONSUME(l.graph.named).image;
    const i0 = SUBRULE(blank, undefined);
    const iri = SUBRULE(sourceSelector, undefined);
    return { val: iri, img1, i0 };
  },
};

/**
 * [[16]](https://www.w3.org/TR/sparql11-query/#rSourceSelector)
 */
export const sourceSelector: SparqlGrammarRule<'sourceSelector', TermIri> = <const> {
  name: 'sourceSelector',
  impl: ({ SUBRULE }) => () => SUBRULE(iri, undefined),
};
