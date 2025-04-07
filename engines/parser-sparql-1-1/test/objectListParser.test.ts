import type { PatternBgp, SparqlContext, Triple } from '@traqula/rules-sparql-1-1';
import { CommonIRIs, TraqulaFactory, completeParseContext, lex as l } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { objectListBuilder } from '../lib';

describe('a SPARQL 1.1 objectList parser', () => {
  const F = new TraqulaFactory();
  const subject = F.namedNode('http://example.org/subject', undefined, F.noStringMaterialization());
  const predicate = F.namedNode('http://example.org/predicate', undefined, F.noStringMaterialization());

  function toBgp(query: string, triples: Triple[]): PatternBgp {
    return F.patternBgp(triples, {
      start: 0,
      end: query.length - 1,
      source: query,
    });
  }

  function parse(query: string, context: Partial<SparqlContext>): PatternBgp {
    const parser = objectListBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    const triples = parser.objectList(query, completeParseContext(context), { subject, predicate });
    return toBgp(query, triples);
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  const firstTriple = F.triple(
    subject,
    predicate,
    F.namedNode('dust-in-the-wind', undefined, { start: 0, end: 17 }),
  );

  const tests: { query: string; ast: PatternBgp | null; name: string }[] = [{
    name: 'uri',
    query: `<dust-in-the-wind>`,
    get ast() {
      return toBgp(this.query, [ firstTriple ]);
    },
  }, {
    name: '2x uri',
    query: `<dust-in-the-wind> ,
        <right-now>
    `,
    get ast() {
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, F.namedNode('right-now', undefined, { start: 29, end: 39 })),
      ]);
    },
  }, {
    name: 'uri and string',
    query: `<dust-in-the-wind> ,
        <right-now>, "alegria"
    `,
    get ast() {
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, F.namedNode('right-now', undefined, { start: 29, end: 39 })),
        F.triple(subject, predicate, F.literalTerm('alegria', undefined, { start: 42, end: 50 })),
      ]);
    },
  }, {
    name: 'empty blankNodePropertyList',
    query: `<dust-in-the-wind> ,
        []
    `,
    get ast() {
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, F.blankNode(undefined, { start: 29, end: 30 })),
      ]);
    },
  }, {
    name: 'blankNodePropertyList 1 element',
    query: `<dust-in-the-wind> ,
        [ <right-now> "alegria" ]
    `,
    get ast() {
      const blankNode = F.blankNode(undefined, { start: 29, end: 53 });
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, blankNode),
        F.triple(
          blankNode,
          F.namedNode('right-now', undefined, { start: 31, end: 41 }),
          F.literalTerm('alegria', undefined, { start: 43, end: 51 }),
        ),
      ]);
    },
  }, {
    name: 'nested blankNodePropertyList',
    query: `<dust-in-the-wind> , 
    [
        <right-now> "alegria" ;
        a <http://example.org/Class> , <apple>, [ a <banana> ]
    ]
`,
    get ast() {
      const outer = F.blankNode(undefined, { start: 26, end: 127 });
      const outerA = F.namedNode(CommonIRIs.TYPE, undefined, { start: 68, end: 68 });
      const inner = F.blankNode(undefined, { start: 108, end: 121 });
      return toBgp(this.query, [
        // TODO: fix
        firstTriple,
        F.triple(subject, predicate, outer),
        F.triple(
          outer,
          F.namedNode('right-now', undefined, { start: 36, end: 46 }),
          F.literalTerm('alegria', undefined, { start: 48, end: 56 }),
        ),
        F.triple(
          outer,
          outerA,
          F.namedNode('http://example.org/Class', undefined, { start: 70, end: 95 }),
        ),
        F.triple(
          outer,
          outerA,
          F.namedNode('apple', undefined, { start: 99, end: 105 }),
        ),
        F.triple(
          outer,
          outerA,
          inner,
        ),
        F.triple(
          inner,
          F.namedNode(CommonIRIs.TYPE, undefined, { start: 110, end: 110 }),
          F.namedNode('banana', undefined, { start: 112, end: 119 }),
        ),
      ]);
    },
  }, {
    name: 'propertyList with much blank and comments',
    query: `<dust-in-the-wind> , 
    [
        <right-now> "alegria" ; ; 
        # More lines
        ; ;
        a <http://example.org/Class> , <apple>, [ a <banana> ]
    ]
`,
    get ast() {
      const outer = F.blankNode(undefined, { start: 26, end: 163 });
      const outerA = F.namedNode(CommonIRIs.TYPE, undefined, { start: 104, end: 104 });
      const inner = F.blankNode(undefined, { start: 144, end: 157 });
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, outer),
        F.triple(
          outer,
          F.namedNode('right-now', undefined, { start: 36, end: 46 }),
          F.literalTerm('alegria', undefined, { start: 48, end: 56 }),
        ),
        F.triple(
          outer,
          outerA,
          F.namedNode('http://example.org/Class', undefined, { start: 106, end: 131 }),
        ),
        F.triple(
          outer,
          outerA,
          F.namedNode('apple', undefined, { start: 135, end: 141 }),
        ),
        F.triple(
          outer,
          outerA,
          inner,
        ),
        F.triple(
          inner,
          F.namedNode(CommonIRIs.TYPE, undefined, { start: 146, end: 146 }),
          F.namedNode('banana', undefined, { start: 148, end: 155 }),
        ),
      ]);
    },
  }, {
    name: 'empty collection',
    query: `<dust-in-the-wind> , 
    ( )
`,
    get ast() {
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, F.namedNode(CommonIRIs.NIL, undefined, { start: 26, end: 28 })),
      ]);
    },
  }, {
    name: 'connection 3 elements',
    query: `<dust-in-the-wind> , 
    ( <a> [] <b> )
`,
    get ast() {
      // Content blankNodes are created before list blankNodes
      const emptyBlank = F.blankNode(undefined, { start: 32, end: 33 });

      const outer = F.blankNode(undefined, { start: 26, end: 39 });
      const first = F.namedNode(CommonIRIs.FIRST, undefined, F.noStringMaterialization());
      const rest = F.namedNode(CommonIRIs.REST, undefined, F.noStringMaterialization());
      const nil = F.namedNode(CommonIRIs.NIL, undefined, F.noStringMaterialization());
      const rest1 = F.blankNode(undefined, F.noStringMaterialization());
      const rest2 = F.blankNode(undefined, F.noStringMaterialization());
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, outer),
        F.triple(outer, first, F.namedNode('a', undefined, { start: 28, end: 30 })),
        F.triple(outer, rest, rest1),
        F.triple(rest1, first, emptyBlank),
        F.triple(rest1, rest, rest2),
        F.triple(rest2, first, F.namedNode('b', undefined, { start: 35, end: 37 })),
        F.triple(rest2, rest, nil),
      ]);
    },
  }];

  for (const test of tests) {
    it(test.name, ({ expect }) => {
      F.resetBlankNodeCounter();
      const res = parse(test.query, context);
      F.resetBlankNodeCounter();
      expect(res).toEqual(test.ast);
    });
  }
});
