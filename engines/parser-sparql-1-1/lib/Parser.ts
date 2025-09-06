import { ParserBuilder } from '@traqula/core';
import type * as T11 from '@traqula/rules-sparql-1-1';
import { gram, lex as l, MinimalSparqlParser, sparqlCodepointEscape } from '@traqula/rules-sparql-1-1';
import { queryUnitParserBuilder } from './queryUnitParser';
import { updateParserBuilder } from './updateUnitParser';

export const sparql11ParserBuilder = ParserBuilder.create(queryUnitParserBuilder)
  .merge(updateParserBuilder, <const> [])
  .addRule(gram.queryOrUpdate);

export type SparqlParser = ReturnType<typeof sparql11ParserBuilder.build>;

export class Parser extends MinimalSparqlParser<T11.SparqlQuery> {
  public constructor() {
    const parser: SparqlParser = sparql11ParserBuilder.build({
      tokenVocabulary: l.sparqlLexerBuilder.tokenVocabulary,
      queryPreProcessor: sparqlCodepointEscape,
    });
    super(parser);
  }
}
