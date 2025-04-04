import { Builder } from '@traqula/core';
import { describe, it } from 'vitest';
import type { SparqlContext, TermLiteral } from '../lib';
import { TraqulaFactory, completeParseContext } from '../lib';
import { iri, iriFull, prefixedName, rdfLiteral, string } from '../lib/grammar';
import { sparql11Tokens } from '../lib/lexer';

describe('a SPARQL 1.1 expression parser', () => {
  function parse(query: string, context: Partial<SparqlContext>): TermLiteral {
    const parser = Builder.createBuilder(<const> [
      rdfLiteral,
      string,
      iri,
      iriFull,
      prefixedName,
    ]).consumeToParser({
      tokenVocabulary: sparql11Tokens.build(),
    });
    return parser.rdfLiteral(query, completeParseContext(context), undefined);
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  it('bug recreation', ({ expect }) => {
    const res = parse(`"abs"  ^^ ex:me`, context);
    expect(res).toEqual(new TraqulaFactory().literalTerm('abs', undefined, { start: 0, end: 4 }));
  });
});
