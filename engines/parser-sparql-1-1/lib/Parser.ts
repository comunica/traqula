import type { ParserBuildArgs } from '@traqula/core';
import { ParserBuilder } from '@traqula/core';
import type * as T11 from '@traqula/rules-sparql-1-1';
import { gram, lex as l, MinimalSparqlParser, sparqlCodepointEscape } from '@traqula/rules-sparql-1-1';
import { queryUnitParserBuilder } from './queryUnitParser.js';
import { updateParserBuilder } from './updateUnitParser.js';

/**
 * Pre-configured {@link ParserBuilder} for SPARQL 1.1 that combines query and update grammar rules.
 * Use {@link ParserBuilder.create | ParserBuilder.create(sparql11ParserBuilder)} to extend it
 * with additional rules.
 */
export const sparql11ParserBuilder = ParserBuilder.create(queryUnitParserBuilder)
  .merge(updateParserBuilder, <const> [])
  .addRule(gram.queryOrUpdate);

export type SparqlParser = ReturnType<typeof sparql11ParserBuilder.build>;

/**
 * Parser that can parse a SPARQL 1.1 string into a SPARQL 1.1 AST.
 */
export class Parser extends MinimalSparqlParser<T11.SparqlQuery> {
  public constructor(
    args: Pick<ParserBuildArgs, 'parserConfig' | 'lexerConfig'> & { defaultContext?: Partial<T11.SparqlContext> } = {},
  ) {
    const parser: SparqlParser = sparql11ParserBuilder.build({
      ...args,
      tokenVocabulary: l.sparql11LexerBuilder.tokenVocabulary,
      queryPreProcessor: sparqlCodepointEscape,
    });
    super(parser, args.defaultContext);
  }
}
