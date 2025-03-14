import type { Query } from '@traqula/rules-sparql-1-1';
import { lex as l, SparqlParser } from '@traqula/rules-sparql-1-1';
import { queryUnitParserBuilder } from './queryUnitParser';

export class Parser extends SparqlParser<Query> {
  public constructor() {
    const parser = queryUnitParserBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    super(parser);
  }
}
