import { ParserBuilder, LexerBuilder } from '@traqula/core';
import { sparql11ParserBuilder } from '@traqula/parser-sparql-1-1';
import type { gram as g11, SparqlQuery } from '@traqula/rules-sparql-1-1';
import { sparqlCodepointEscape, lex as l11, MinimalSparqlParser } from '@traqula/rules-sparql-1-1';
import { gram, lex } from '@traqula/rules-sparql-1-1-adjust';

export const adjustBuilder = ParserBuilder.create(sparql11ParserBuilder)
  // This typePatch is not needed, but we need to import g11 for our types
  .typePatch<{ [g11.builtInCall.name]: [any]}>()
  .addRule(gram.builtInAdjust)
  .patchRule(gram.builtInPatch);

export type Adjust11Parser = ReturnType<typeof adjustBuilder.build>;

export const lexerBuilder = LexerBuilder.create(l11.sparqlLexerBuilder).addBefore(l11.a, lex.BuiltInAdjust);

export class Parser extends MinimalSparqlParser<SparqlQuery> {
  public constructor() {
    const parser: Adjust11Parser = adjustBuilder.build({
      tokenVocabulary: lexerBuilder.tokenVocabulary,
      queryPreProcessor: sparqlCodepointEscape,
    });
    super(parser);
  }
}
