import type { RuleDefReturn } from '@traqula/core';
import * as l from '../lexer';
import type { DatasetClause, TermIri } from '../RoundTripTypes';
import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import type { CTOS, Ignores, Images, Wrap } from '../TypeHelpersRTT';
import { blank } from './general';
import { iri } from './literals';

export const datasetClauses: SparqlRule<'datasetClauses', DatasetClause> = <const> {
  name: 'datasetClauses',
  impl: ({ ACTION, MANY, SUBRULE }) => () => {
    const iter = 0;
    const completion: CTOS[] = [];
    const namedIndexes: number[] = [];
    const _default: TermIri[] = [];
    const named: TermIri[] = [];

    MANY(() => {
      const clause = SUBRULE(datasetClause, undefined);
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
      type: 'datasetClause',
      default: _default,
      named,
      RTT: { namedIndexes, completion },
    };
  },
  gImpl: () => () => '',
};

/**
 * [[13]](https://www.w3.org/TR/sparql11-query/#rDatasetClause)
 */
export const datasetClause:
SparqlGrammarRule<'datasetClause', { named: boolean; completion: CTOS; value: TermIri }> = <const> {
  name: 'datasetClause',
  impl: ({ ACTION, SUBRULE, CONSUME, OR }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.from).image;
    return OR<RuleDefReturn<typeof datasetClause>>([
      { ALT: () => {
        const iri = SUBRULE(defaultGraphClause, undefined);
        return { named: false, completion: [ ...i0, F.image(img1) ], value: iri };
      } },
      { ALT: () => {
        const namedClause = SUBRULE(namedGraphClause, undefined);
        return ACTION(() => {
          const { val, img1: img2, i0: i1 } = namedClause;
          return { named: true, completion: [ ...i0, F.image(img1), ...i1, F.image(img2) ], value: val };
        });
      } },
    ]);
  },
};

/**
 * [[14]](https://www.w3.org/TR/sparql11-query/#rDefaultGraphClause)
 */
export const defaultGraphClause: SparqlGrammarRule<'defaultGraphClause', TermIri> = <const> {
  name: 'defaultGraphClause',
  impl: ({ SUBRULE }) => () => SUBRULE(sourceSelector, undefined),
};

/**
 * [[15]](https://www.w3.org/TR/sparql11-query/#rNamedGraphClause)
 */
export const namedGraphClause: SparqlGrammarRule<'namedGraphClause', Wrap<TermIri> & Ignores & Images> = <const> {
  name: 'namedGraphClause',
  impl: ({ SUBRULE, CONSUME }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.graph.named).image;
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
