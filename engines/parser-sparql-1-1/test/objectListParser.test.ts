import type { SparqlContext, Triple } from '@traqula/rules-sparql-1-1';
import { TraqulaFactory, completeParseContext, lex as l } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { objectListBuilder } from '../lib';

describe('a SPARQL 1.1 objectlist parser', () => {
  const F = new TraqulaFactory();
  function parse(query: string, context: Partial<SparqlContext>): Triple[] {
    const parser = objectListBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    const subject = F.namedNode([], 'http://example.org/subject');
    const predicate = F.namedNode([], 'http://example.org/predicate');
    return parser.objectList(query, completeParseContext(context), { subject, predicate });
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  const values = [
    `<dust-in-the-wind>`,
    `<dust-in-the-wind> , 
    <right-now> 
`,
    `<dust-in-the-wind> , 
    <right-now>, "alegria" 
`,
    `<dust-in-the-wind> , 
    []
`,
    `<dust-in-the-wind> , 
    [ <right-now>, "alegria" ]
`,
    `<dust-in-the-wind> , 
    [
        <right-now> "alegria" ;
        a <http://example.org/Class> , <apple>, [ a <banana> ]
    ]
`,
    `<dust-in-the-wind> , 
    [
        <right-now> "alegria" ; ; 
        # More lines
        ; ;
        a <http://example.org/Class> , <apple>, [ a <banana> ]
    ]
`,
    `<dust-in-the-wind> , 
    ( )
`,
    `<dust-in-the-wind> , 
    ( <a> [] <b> )
`,
  ];

  it('builtin', ({ expect }) => {
    const res = parse(`<dust-in-the-wind> , 
    ( <a> [] <b> )
`, context);
    expect(res).toEqual(F.expressionOperation({
      img1: 'STR',
      args: [ F.variable([ F.blankSpace('\n'), F.comment('b') ], '?x') ],
      ignored: [
        [ F.blankSpace('\n'), F.comment('a') ],
        [],
        [ F.blankSpace('\n'), F.comment('b') ],
      ],
    }));
  });
});
