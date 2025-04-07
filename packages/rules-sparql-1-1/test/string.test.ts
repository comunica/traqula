import type { SourceLocation } from '@traqula/core';
import { Builder, GeneratorBuilder } from '@traqula/core';
import { describe, it } from 'vitest';
import type { SparqlContext, TermIri, TermLiteral } from '../lib';
import { TraqulaFactory, completeParseContext } from '../lib';
import {
  iri,
  iriFull,
  numericLiteral,
  numericLiteralNegative,
  numericLiteralPositive,
  numericLiteralUnsigned,
  prefixedName,
  rdfLiteral,
  string,
} from '../lib/grammar';
import { sparql11Tokens } from '../lib/lexer';

describe('a SPARQL 1.1 expression parser', () => {
  const F = new TraqulaFactory();
  function parse(query: string, context: Partial<SparqlContext>): TermLiteral {
    const parser = Builder.createBuilder(<const> [
      rdfLiteral,
      string,
      iri,
      iriFull,
      prefixedName,
      numericLiteral,
      numericLiteralUnsigned,
      numericLiteralPositive,
      numericLiteralNegative,
    ]).consumeToParser({
      tokenVocabulary: sparql11Tokens.build(),
    });
    const literal = parser.numericLiteral(query, completeParseContext(context), undefined);
    (<SourceLocation> literal.loc).source = query;
    return literal;
  }
  function generate(ast: TermLiteral, context: Partial<SparqlContext>): string {
    const generator = GeneratorBuilder.createBuilder(<const> [
      rdfLiteral,
      iri,
      iriFull,
      prefixedName,
    ]).build();
    return generator.rdfLiteral(ast, completeParseContext(context), undefined);
  }

  const context = { prefixes: { ex: 'http://example.org/' }};

  it('bug recreation', ({ expect }) => {
    const query = `5`;
    const res = parse(query, context);
    // Expect(res).toEqual(
    //   F.literalTerm('abs', F.namedNode('me', 'ex', { start: 10, end: 14 }), { source: query, start: 0, end: 14 }),
    // );
    expect(generate(res, context)).toEqual(query);

    // Delete loc keys
    const namedNode2 = { ...(<TermIri> res.langOrIri), loc: undefined };
    const literal2 = { ...res, langOrIri: namedNode2, loc: undefined };
    expect(generate(literal2, context)).toEqual(query);
  });
});
