import type { Range } from '@traqula/core';
import { GeneratorBuilder, RangeArithmetic } from '@traqula/core';
import type { PatternBgp, SparqlContext, Triple } from '@traqula/rules-sparql-1-1';
import { CommonIRIs, TraqulaFactory, completeParseContext, lex as l, gram } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { objectListBuilder } from '../lib';

describe('ranges', () => {
  it('parses ranges', ({ expect }) => {
    const calc = new RangeArithmetic(0, 10);
    expect(calc.subtract(2, 5).ranges).toEqual([[ 0, 2 ], [ 5, 10 ]]);
    expect(calc.subtract(6, 7).ranges).toEqual([[ 0, 2 ], [ 5, 6 ], [ 7, 10 ]]);
    expect(calc.subtract(6, 8).ranges).toEqual([[ 0, 2 ], [ 5, 6 ], [ 8, 10 ]]);
    expect(calc.subtract(1, 8).ranges).toEqual([[ 0, 1 ], [ 8, 10 ]]);
    expect(calc.projection(0, 10)).toEqual([[ 0, 1 ], [ 8, 10 ]]);
    expect(calc.projection(0, 9)).toEqual([[ 0, 1 ], [ 8, 9 ]]);
    expect(calc.projection(1, 9)).toEqual([[ 8, 9 ]]);
    expect(calc.projection(0, 1)).toEqual([[ 0, 1 ]]);
  });

  it('parses ranges with 0', ({ expect }) => {
    const calc = new RangeArithmetic(0, 10);
    expect(calc.subtract(0, 2).ranges).toEqual([[ 2, 10 ]]);
    expect(calc.subtract(9, 20).ranges).toEqual([[ 2, 9 ]]);
    expect(calc.subtract(-1, 0).ranges).toEqual([[ 2, 9 ]]);
    expect(calc.subtract(10, 15).ranges).toEqual([[ 2, 9 ]]);
    expect(calc.subtract(5, 6).ranges).toEqual([[ 2, 5 ], [ 6, 9 ]]);
    expect(() => calc.subtract(6, 6)).toThrow('Invalid range');
    expect(() => calc.subtract(6, 5)).toThrow('Invalid range');
  });
});

describe('a SPARQL 1.1 objectList parser', () => {
  const F = new TraqulaFactory();
  const subject = F.namedNode('http://example.org/subject', undefined, F.noStringMaterialization());
  const predicate = F.namedNode('http://example.org/predicate', undefined, F.noStringMaterialization());

  function generate(ast: PatternBgp, skipRanges: Range[]): string {
    const generator = GeneratorBuilder.createBuilder([
      gram.triplesBlock,
      gram.varOrTerm,
      gram.graphTerm,
      gram.var_,
      gram.rdfLiteral,
      gram.string,
      gram.path,
      gram.blankNode,
      gram.iri,
      gram.iriFull,
      gram.prefixedName,
    ]).build();
    return generator.triplesBlock(ast, { factory: F, skipRanges }, undefined);
  }

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
    F.namedNode('dust-in-the-wind', undefined, { start: 0, end: 18 }),
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
        F.triple(subject, predicate, F.namedNode('right-now', undefined, { start: 29, end: 40 })),
      ]);
    },
  }, {
    name: 'uri and string',
    query: `<dust-in-the-wind> ,
        <right-now>, """alegria"""
    `,
    get ast() {
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, F.namedNode('right-now', undefined, { start: 29, end: 40 })),
        F.triple(subject, predicate, F.literalTerm('alegria', undefined, { start: 42, end: 55 })),
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
        F.triple(subject, predicate, F.blankNode(undefined, { start: 29, end: 31 })),
      ]);
    },
  }, {
    name: 'blankNodePropertyList 1 element',
    query: `<dust-in-the-wind> ,
        [ <right-now> "alegria" ]
    `,
    get ast() {
      const blankNode = F.blankNode(undefined, { start: 29, end: 54 });
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, blankNode),
        F.triple(
          blankNode,
          F.namedNode('right-now', undefined, { start: 31, end: 42 }),
          F.literalTerm('alegria', undefined, { start: 43, end: 52 }),
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
      const outer = F.blankNode(undefined, { start: 26, end: 128 });
      const outerA = F.namedNode(CommonIRIs.TYPE, undefined, { start: 68, end: 69 });
      const inner = F.blankNode(undefined, { start: 108, end: 122 });
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, outer),
        F.triple(
          outer,
          F.namedNode('right-now', undefined, { start: 36, end: 47 }),
          F.literalTerm('alegria', undefined, { start: 48, end: 57 }),
        ),
        F.triple(
          outer,
          outerA,
          F.namedNode('http://example.org/Class', undefined, { start: 70, end: 96 }),
        ),
        F.triple(
          outer,
          outerA,
          F.namedNode('apple', undefined, { start: 99, end: 106 }),
        ),
        F.triple(
          outer,
          outerA,
          inner,
        ),
        F.triple(
          inner,
          F.namedNode(CommonIRIs.TYPE, undefined, { start: 110, end: 111 }),
          F.namedNode('banana', undefined, { start: 112, end: 120 }),
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
      const outer = F.blankNode(undefined, { start: 26, end: 164 });
      const outerA = F.namedNode(CommonIRIs.TYPE, undefined, { start: 104, end: 105 });
      const inner = F.blankNode(undefined, { start: 144, end: 158 });
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, outer),
        F.triple(
          outer,
          F.namedNode('right-now', undefined, { start: 36, end: 47 }),
          F.literalTerm('alegria', undefined, { start: 48, end: 57 }),
        ),
        F.triple(
          outer,
          outerA,
          F.namedNode('http://example.org/Class', undefined, { start: 106, end: 132 }),
        ),
        F.triple(
          outer,
          outerA,
          F.namedNode('apple', undefined, { start: 135, end: 142 }),
        ),
        F.triple(
          outer,
          outerA,
          inner,
        ),
        F.triple(
          inner,
          F.namedNode(CommonIRIs.TYPE, undefined, { start: 146, end: 147 }),
          F.namedNode('banana', undefined, { start: 148, end: 156 }),
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
        F.triple(subject, predicate, F.namedNode(CommonIRIs.NIL, undefined, { start: 26, end: 29 })),
      ]);
    },
  }, {
    name: 'connection 3 elements',
    query: `<dust-in-the-wind> , 
    ( <a> [] <b> )
`,
    get ast() {
      // Content blankNodes are created before list blankNodes
      const emptyBlank = F.blankNode(undefined, { start: 32, end: 34 });

      const outer = F.blankNode(undefined, { start: 26, end: 40 });
      const first = F.namedNode(CommonIRIs.FIRST, undefined, F.noStringMaterialization());
      const rest = F.namedNode(CommonIRIs.REST, undefined, F.noStringMaterialization());
      const nil = F.namedNode(CommonIRIs.NIL, undefined, F.noStringMaterialization());
      const rest1 = F.blankNode(undefined, F.noStringMaterialization());
      const rest2 = F.blankNode(undefined, F.noStringMaterialization());
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, outer),
        F.triple(outer, first, F.namedNode('a', undefined, { start: 28, end: 31 })),
        F.triple(outer, rest, rest1),
        F.triple(rest1, first, emptyBlank),
        F.triple(rest1, rest, rest2),
        F.triple(rest2, first, F.namedNode('b', undefined, { start: 35, end: 38 })),
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

      const generated = generate(res, []);
      expect(generated).toEqual(test.query);
    });
  }

  it('can generate altered round tripped', ({ expect }) => {
    const query = `<dust-in-the-wind> ,
        [ <right-now> """alegria""" ]
    `;
    F.resetBlankNodeCounter();
    const res = parse(query, context);
    F.resetBlankNodeCounter();
    const toSkip = res.triples[2].object.loc!;
    const alterRes: PatternBgp = {
      ...res,
      triples: [
        ...res.triples.slice(0, 2),
        F.triple(
          res.triples[2].subject,
          res.triples[2].predicate,
          F.literalTerm('altered', undefined),
        ),
      ],
    };
    expect(generate(alterRes, [[ toSkip.start, toSkip.end ]])).toEqual(`<dust-in-the-wind> ,
        [ <right-now> "altered" ]
    `);
  });
});
