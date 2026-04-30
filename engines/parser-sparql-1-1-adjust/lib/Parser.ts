import { ParserBuilder, LexerBuilder, type ParserBuildArgs } from '@traqula/core';
import { sparql11ParserBuilder } from '@traqula/parser-sparql-1-1';
import { sparqlCodepointEscape, lex as l11, MinimalSparqlParser } from '@traqula/rules-sparql-1-1';
import type { gram as g11, SparqlQuery, SparqlContext } from '@traqula/rules-sparql-1-1';
import { gram, lex } from '@traqula/rules-sparql-1-1-adjust';

/**
 * Pre-configured {@link ParserBuilder} for SPARQL 1.1 with ADJUST function support,
 * extending the SPARQL 1.1 parser builder with the
 * [ADJUST built-in function](https://github.com/w3c/sparql-dev/blob/main/SEP/SEP-0002/sep-0002.md).
 */
export const adjustParserBuilder = ParserBuilder.create(sparql11ParserBuilder)
  // This typePatch is not needed, but we need to import g11 for our types
  .typePatch<{ [g11.builtInCall.name]: [any]}>()
  .addRule(gram.builtInAdjust)
  .patchRule(gram.builtInPatch);

export type Adjust11Parser = ReturnType<typeof adjustParserBuilder.build>;

/**
 * Pre-configured {@link LexerBuilder} for SPARQL 1.1 with the ADJUST built-in token
 * inserted before the `a` token in the token order.
 */
export const adjustLexerBuilder = LexerBuilder.create(l11.sparql11LexerBuilder).addBefore(l11.a, lex.BuiltInAdjust);

/**
 * Parser that can parse a SPARQL 1.1 string (including the
 * [ADJUST function](https://github.com/w3c/sparql-dev/blob/main/SEP/SEP-0002/sep-0002.md))
 * into a SPARQL 1.1 AST.
 */
export class Parser extends MinimalSparqlParser<SparqlQuery> {
  public constructor(
    args: Pick<ParserBuildArgs, 'parserConfig' | 'lexerConfig'> & { defaultContext?: Partial<SparqlContext> } = {},
  ) {
    const parser: Adjust11Parser = adjustParserBuilder.build({
      ...args,
      tokenVocabulary: adjustLexerBuilder.tokenVocabulary,
      queryPreProcessor: sparqlCodepointEscape,
    });
    super(parser, args.defaultContext);
  }
}
