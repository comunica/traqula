import type { SparqlContext, Triple } from '@traqula/rules-sparql-1-1';
import { TraqulaFactory, completeParseContext, lex as l } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { objectListBuilder } from '../lib';

describe('a SPARQL 1.1 objectlist parser', () => {
  const F = new TraqulaFactory();
  const subject = F.namedNode([], 'http://example.org/subject');
  const predicate = F.namedNode([], 'http://example.org/predicate');

  function parse(query: string, context: Partial<SparqlContext>): Triple[] {
    const parser = objectListBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    return parser.objectList(query, completeParseContext(context), { subject, predicate });
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  const firstTriple = F.triple(
    subject,
    predicate,
    F.namedNode([], 'dust-in-the-wind'),
  );

  const tests: { query: string; ast: Triple[] | null; name: string }[] = [{
    name: 'uri',
    query: `<dust-in-the-wind>`,
    ast: [ firstTriple ],
  }, {
    name: '2x uri',
    query: `<dust-in-the-wind> , 
    <right-now> 
`,
    ast: [
      firstTriple,
    ],
  }];

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

  for (const { name, query, ast } of tests) {
    it(name, ({ expect }) => {
      const res = parse(query, context);
      expect(res).toEqual(ast);
    });
  }
});
