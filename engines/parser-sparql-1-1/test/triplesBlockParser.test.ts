import type { PatternBgp, SparqlContext } from '@traqula/rules-sparql-1-1';
import { TraqulaFactory, completeParseContext, lex as l } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { triplesBlockParserBuilder } from '../lib';

describe('a SPARQL 1.1 objectlist parser', () => {
  const F = new TraqulaFactory();
  function parse(query: string, context: Partial<SparqlContext>): PatternBgp {
    const parser = triplesBlockParserBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    return parser.triplesBlock(query, completeParseContext(context), undefined);
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  const values = [
    `<a> <b> <c>`,
    `<a> <b> <c> . <a> ?p <c> .`,
    `[ <a> 'apple' ] <p>? 'pear'`,
    `<a> <p>* ( 'list' )`,
    `<a> <p>* ( 'list' );
    #comment
         ?q [ a _:blank ]`,
    `<a> <p>* ( 'list' ); ; ;
    #comment
    ;;
         ?q [ a _:blank ] ; ;;;`,
  ];

  it('builtin', ({ expect }) => {
    const res = parse(`<a> <p>* ( 'list' ); ; ;
    #comment
    ;;
         ?q [ a _:blank ] ; ;;;`, context);
    expect(res).toEqual({});
  });
});
