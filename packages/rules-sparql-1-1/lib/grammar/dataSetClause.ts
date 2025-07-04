import type { RuleDefReturn, Wrap } from '@traqula/core';
import type { TokenType } from 'chevrotain';
import * as l from '../lexer';
import type { DatasetClauses, TermIri } from '../RoundTripTypes';
import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import { iri } from './literals';

export function datasetClauseUsing<RuleName extends 'usingClause' | 'datasetClause'>(
  name: RuleName,
  token: TokenType,
): SparqlGrammarRule<RuleName, Wrap<DatasetClauses['clauses'][0]>> {
  return {
    name,
    impl: ({ ACTION, SUBRULE, CONSUME, OR }) => (C) => {
      const start = CONSUME(token);
      return OR<RuleDefReturn<typeof datasetClause>>([
        { ALT: () => {
          const iri = SUBRULE(defaultGraphClause, undefined);
          return ACTION(() =>
            C.factory.wrap({ clauseType: 'default', value: iri }, C.factory.sourceLocation(start, iri)));
        } },
        { ALT: () => {
          const namedClause = SUBRULE(namedGraphClause, undefined);
          return ACTION(() => C.factory.wrap({
            clauseType: 'named',
            value: namedClause.val,
          }, C.factory.sourceLocation(start, namedClause)));
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
      const clauses: RuleDefReturn<typeof datasetClause>[] = [];

      MANY(() => {
        const clause = SUBRULE(subRule, undefined);
        clauses.push(clause);
      });

      return ACTION(() => C.factory.datasetClauses(
        clauses.map(clause => clause.val),
        C.factory.sourceLocation(...clauses),
      ));
    },
    gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
      for (const clause of ast.clauses) {
        if (clause.clauseType === 'named') {
          F.printFilter(ast, () => PRINT_WORD('NAMED'));
        }
        SUBRULE(iri, clause.value, undefined);
      }
    },
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
    return ACTION(() => C.factory.wrap(iri, C.factory.sourceLocation(named, iri)));
  },
};

/**
 * [[16]](https://www.w3.org/TR/sparql11-query/#rSourceSelector)
 */
export const sourceSelector: SparqlGrammarRule<'sourceSelector', TermIri> = <const> {
  name: 'sourceSelector',
  impl: ({ SUBRULE }) => () => SUBRULE(iri, undefined),
};
