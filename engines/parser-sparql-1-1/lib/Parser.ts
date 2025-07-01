import { Builder } from '@traqula/core';
import type { SparqlQuery, SparqlGrammarRule } from '@traqula/rules-sparql-1-1';
import { lex as l, SparqlParser, gram } from '@traqula/rules-sparql-1-1';
import { queryUnitParserBuilder } from './queryUnitParser';
import { updateParserBuilder } from './updateUnitParser';

/**
 * Query or update, optimized for the Query case.
 * One could implement a new rule that does not use BACKTRACK.
 * TODO: implement without backtracking - the error messages it produces are bad
 */
const queryOrUpdate: SparqlGrammarRule<'queryOrUpdate', SparqlQuery> = {
  name: 'queryOrUpdate',
  impl: ({ SUBRULE, OR, BACKTRACK }) => () => OR<SparqlQuery>([
    // { GATE: BACKTRACK(gram.updateUnit, undefined), ALT: () => SUBRULE(gram.updateUnit, undefined) },
    // { GATE: BACKTRACK(gram.queryUnit, undefined), ALT: () => SUBRULE(gram.queryUnit, undefined) },
    { GATE: BACKTRACK(gram.queryUnit, undefined), ALT: () => SUBRULE(gram.queryUnit, undefined) },
    { GATE: BACKTRACK(gram.updateUnit, undefined), ALT: () => SUBRULE(gram.updateUnit, undefined) },
  ]),
};

export const sparql11ParserBuilder = Builder.createBuilder(queryUnitParserBuilder)
  .merge(updateParserBuilder, <const> [])
  .addRule(queryOrUpdate);

export class Parser extends SparqlParser<SparqlQuery> {
  public constructor() {
    const parser = sparql11ParserBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    super({
      path: parser.path,
      query: parser.queryOrUpdate,
    });
  }
}
