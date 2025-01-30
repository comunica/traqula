import * as l from '../lexer';
import type { IriTerm, SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import { iri } from './literals';

/**
 * [[13]](https://www.w3.org/TR/sparql11-query/#rDatasetClause)
 */
export interface IDatasetClause {
  value: IriTerm;
  type: 'default' | 'named';
}
export const datasetClause: SparqlRule<'datasetClause', IDatasetClause> = <const> {
  name: 'datasetClause',
  impl: ({ SUBRULE, CONSUME, OR }) => () => {
    CONSUME(l.from);
    return OR<IDatasetClause>([
      { ALT: () => ({ value: SUBRULE(defaultGraphClause, undefined), type: 'default' }) },
      { ALT: () => ({ value: SUBRULE(namedGraphClause, undefined), type: 'named' }) },
    ]);
  },
  gImpl: () => ast => `FROM ${ast.type}`,
};

/**
 * [[14]](https://www.w3.org/TR/sparql11-query/#rDefaultGraphClause)
 */
export const defaultGraphClause: SparqlGrammarRule<'defaultGraphClause', IriTerm> = <const> {
  name: 'defaultGraphClause',
  impl: ({ SUBRULE }) => () => SUBRULE(sourceSelector, undefined),
};

/**
 * [[15]](https://www.w3.org/TR/sparql11-query/#rNamedGraphClause)
 */
export const namedGraphClause: SparqlGrammarRule<'namedGraphClause', IriTerm> = <const> {
  name: 'namedGraphClause',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.graph.named);
    return SUBRULE(sourceSelector, undefined);
  },
};

/**
 * [[16]](https://www.w3.org/TR/sparql11-query/#rSourceSelector)
 */
export const sourceSelector: SparqlGrammarRule<'sourceSelector', IriTerm> = <const> {
  name: 'sourceSelector',
  impl: ({ SUBRULE }) => () => SUBRULE(iri, undefined),
};
