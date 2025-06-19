import { GeneratorBuilder, RangeArithmetic } from '@traqula/core';
import type { PatternBgp, SparqlContext, TripleNesting } from '@traqula/rules-sparql-1-1';
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
  const subject = F.namedNode(F.sourceLocationNoMaterialize(), 'http://example.org/subject');
  const predicate = F.namedNode(F.sourceLocationNoMaterialize(), 'http://example.org/predicate');

  function generate(ast: PatternBgp, origSource: string): string {
    const generator = GeneratorBuilder.createBuilder([
      gram.triplesBlock,
      gram.graphNode,
      gram.graphTerm,
      gram.var_,
      gram.rdfLiteral,
      gram.path,
      gram.varOrTerm,
      gram.triplesNode,
      gram.collection,
      gram.blankNodePropertyList,
      gram.blankNode,
      gram.iri,
      gram.iriFull,
      gram.prefixedName,
    ]).build();
    return generator.triplesBlock(ast, { factory: F, origSource }, undefined);
  }

  function toBgp(query: string, triples: TripleNesting[]): PatternBgp {
    return F.patternBgp(triples, F.sourceLocationSource(0, query.length));
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
    F.namedNode(F.sourceLocationSource(0, 18), 'dust-in-the-wind'),
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
        F.triple(subject, predicate, F.namedNode(F.sourceLocationSource(29, 40), 'right-now')),
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
        F.triple(subject, predicate, F.namedNode(F.sourceLocationSource(29, 40), 'right-now')),
        F.triple(subject, predicate, F.literalTerm(F.sourceLocationSource(42, 55), 'alegria')),
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
        F.triple(subject, predicate, F.blankNode(undefined, F.sourceLocationSource(29, 31))),
      ]);
    },
  }, {
    name: 'blankNodePropertyList 1 element',
    query: `<dust-in-the-wind> ,
        [ <right-now> "alegria" ]
    `,
    get ast() {
      const blankNode = F.blankNode(undefined, F.sourceLocationNoMaterialize());
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, F.tripleCollectionBlankNodeProperties(
          blankNode,
          [ F.triple(
            blankNode,
            F.namedNode(F.sourceLocationSource(31, 42), 'right-now'),
            F.literalTerm(F.sourceLocationSource(43, 52), 'alegria'),
          ) ],
          F.sourceLocationSource(29, 54),
        )),
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
      const outerBlank = F.blankNode(undefined, F.sourceLocationNoMaterialize());
      const outerA = F.namedNode(F.sourceLocationSource(67, 68), CommonIRIs.TYPE);
      const innerBlank = F.blankNode(undefined, F.sourceLocationNoMaterialize());

      const propertyTriples = [
        F.triple(
          outerBlank,
          F.namedNode(F.sourceLocationSource(35, 46), 'right-now'),
          F.literalTerm(F.sourceLocationSource(47, 56), 'alegria'),
        ),
        F.triple(
          outerBlank,
          outerA,
          F.namedNode(F.sourceLocationSource(69, 95), 'http://example.org/Class'),
        ),
        F.triple(
          outerBlank,
          outerA,
          F.namedNode(F.sourceLocationSource(98, 105), 'apple'),
        ),
        F.triple(
          outerBlank,
          outerA,
          F.tripleCollectionBlankNodeProperties(innerBlank, [ F.triple(
            innerBlank,
            F.namedNode(F.sourceLocationSource(109, 110), CommonIRIs.TYPE),
            F.namedNode(F.sourceLocationSource(111, 119), 'banana'),
          ) ], F.sourceLocationSource(107, 121)),
        ),
      ];

      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, F.tripleCollectionBlankNodeProperties(
          outerBlank,
          propertyTriples,
          F.sourceLocationSource(25, 127),
        )),
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
      const outerBlank = F.blankNode(undefined, F.sourceLocationNoMaterialize());
      const innerBlank = F.blankNode(undefined, F.sourceLocationNoMaterialize());
      const outerA = F.namedNode(F.sourceLocationSource(102, 103), CommonIRIs.TYPE);

      const outer = F.tripleCollectionBlankNodeProperties(outerBlank, [
        F.triple(
          outerBlank,
          F.namedNode(F.sourceLocationSource(35, 46), 'right-now'),
          F.literalTerm(F.sourceLocationSource(47, 56), 'alegria'),
        ),
        F.triple(
          outerBlank,
          outerA,
          F.namedNode(F.sourceLocationSource(104, 130), 'http://example.org/Class'),
        ),
        F.triple(
          outerBlank,
          outerA,
          F.namedNode(F.sourceLocationSource(133, 140), 'apple'),
        ),
        F.triple(
          outerBlank,
          outerA,
          F.tripleCollectionBlankNodeProperties(innerBlank, [
            F.triple(
              innerBlank,
              F.namedNode(F.sourceLocationSource(144, 145), CommonIRIs.TYPE),
              F.namedNode(F.sourceLocationSource(147, 154), 'banana'),
            ),
          ], F.sourceLocationSource(142, 156)),
        ),
      ], F.sourceLocationSource(25, 162));
      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, outer),
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
        F.triple(subject, predicate, F.namedNode(F.sourceLocationSource(25, 28), CommonIRIs.NIL)),
      ]);
    },
  }, {
    name: 'connection 3 elements',
    query: `<dust-in-the-wind> ,
    ( <a> [] <b> )
`,
    get ast() {
      // Content blankNodes are created before list blankNodes
      const emptyBlank = F.blankNode(undefined, F.sourceLocationSource(31, 33));

      const listHead = F.blankNode(undefined, F.sourceLocationNoMaterialize());
      const first = F.namedNode(F.sourceLocationNoMaterialize(), CommonIRIs.FIRST);
      const rest = F.namedNode(F.sourceLocationNoMaterialize(), CommonIRIs.REST);
      const nil = F.namedNode(F.sourceLocationNoMaterialize(), CommonIRIs.NIL);
      const rest1 = F.blankNode(undefined, F.sourceLocationNoMaterialize());
      const rest2 = F.blankNode(undefined, F.sourceLocationNoMaterialize());
      const listWrap = F.tripleCollectionList(listHead, [
        F.triple(listHead, first, F.namedNode(F.sourceLocationSource(27, 30), 'a')),
        F.triple(listHead, rest, rest1),
        F.triple(rest1, first, emptyBlank),
        F.triple(rest1, rest, rest2),
        F.triple(rest2, first, F.namedNode(F.sourceLocationSource(34, 37), 'b')),
        F.triple(rest2, rest, nil),
      ], F.sourceLocationSource(25, 39));

      return toBgp(this.query, [
        firstTriple,
        F.triple(subject, predicate, listWrap),
      ]);
    },
  }];

  for (const test of tests) {
    it(test.name, ({ expect }) => {
      F.resetBlankNodeCounter();
      const res = parse(test.query, context);
      F.resetBlankNodeCounter();
      expect(res).toEqual(test.ast);

      const generated = generate(res, test.query);
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
    /* eslint-disable ts/ban-ts-comment */
    function alterType(curObject: object, searchType: string, patch: (current: object) => object): object {
      for (const [ key, value ] of Object.entries(curObject)) {
        if (value && typeof value === 'object') {
          (<Record<string, unknown>> curObject)[key] = alterType(value, searchType, patch);
        }
      }
      if ((<{ type?: unknown }> curObject).type === searchType) {
        return patch(curObject);
      }
      return curObject;
    }
    const alterRes = <PatternBgp> alterType(res, 'term', (cur) => {
      if (F.isTerm(cur) && F.isTermLiteral(cur) && cur.value === 'alegria') {
        // @ts-expect-error
        return F.literalTerm(F.sourceLocationNodeReplace(cur.loc.start, cur.loc.end), 'altered');
      }
      return cur;
    });
    /* eslint-enable ts/ban-ts-comment */

    expect(generate(alterRes, query)).toEqual(`<dust-in-the-wind> ,
        [ <right-now> "altered" ]
    `);
  });
});
