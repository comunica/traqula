import { Parser } from '@traqula/parser-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type { TripleCollection, TripleNesting } from '@traqula/rules-sparql-1-1';
import { Transformer, TraqulaFactory } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { Generator } from '../lib';

describe('a SPARQL 1.1 generator', () => {
  const generator = new Generator();
  const parser = new Parser();
  const F = new TraqulaFactory();
  const transformer = new Transformer<T11.Sparql11Nodes>();

  it ('generates simple round tripped', ({ expect }) => {
    const query = 'SELECT * WHERE { ?s ?p ?o }';
    const ast = <T11.Query> parser.parse(query);
    console.log(JSON.stringify(ast, null, 2));
    const result = generator.generate(ast, query);
    expect(result.replaceAll(/\s+/gu, ' ')).toBe(query);
  });

  describe('on altered nodes', () => {
    it('translates ?s -> ?subject', ({ expect }) => {
      const query = 'SELECT * WHERE { ?s ?p ?o }';
      const ast = <T11.Query> parser.parse(query);

      const altered = transformer.transformNodeSpecific(
        ast,
        'term',
        'variable',
        (current) => {
          if (current.value === 's') {
            return F.variable('subject', F.sourceLocationNodeReplaceUnsafe(current.loc));
          }
          return current;
        },
      );

      console.error(JSON.stringify(altered, null, 2));
      const result = generator.generate(altered, query);
      expect(result).toBe(`SELECT * WHERE { ?subject ?p ?o }`);
    });

    it('translates blanknodes -> variables', ({ expect }) => {
      const query = `
BASE <ex:>
CONSTRUCT { 
  ?s0 ?p0 [ <a0> [ <b0> <c0> ] ].
  [ <a0> [ <b0> <c0> ] ] ?p0 ?o0.
}
WHERE {
  ?s1 ?p1 [], <a1>; ?q1 <b1>, <c1>.
  []  ?p2 ?o2.
  ?s3 ?p3 [ <a3> <b3> ].
  ?s4 ?p4 [ <a4> <b4>; <c4> <d4>, <e4> ].
  ?s5 ?p5 [ <a5> [ <b5> <c5> ] ].
  [ <a6> [ <b6> <c6> ] ] ?p6 ?o6.
  [ <a7> <b7>; <c7> <d7>, <e7> ].
}`;
      const ast = <T11.Query> parser.parse(query);
      // Console.log(JSON.stringify(ast, null, 2));

      function extractCollection(collection: TripleCollection): TripleNesting[] {
        const result: TripleNesting[] = [];
        for (const entry of collection.triples) {
          const subject = entry.subject;
          const pred = entry.predicate;
          if (F.isTripleCollection(entry.object)) {
            const identifier = { ...F.graphNodeIdentifier(entry.object) };
            result.push(F.triple(subject, pred, identifier, F.gen()));
            result.push(...extractCollection(entry.object));
          } else {
            result.push(F.triple(
              subject,
              pred,
              entry.object,
              F.gen(),
            ));
          }
        }
        return result;
      }
      const flattenCollections = transformer.transformNodeSpecific(
        ast,
        'pattern',
        'bgp',
        (current) => {
          const bgpCopy = F.forcedAutoGenTree(current);
          const newTriples: TripleNesting[] = [];
          for (const entry of bgpCopy.triples) {
            if (F.isTriple(entry)) {
              const subject = entry.subject;
              const pred = entry.predicate;
              if (F.isTripleCollection(entry.object)) {
                const object = entry.object;
                const identifier = { ...F.graphNodeIdentifier(object) };
                newTriples.push(F.triple(subject, pred, identifier));
                newTriples.push(...extractCollection(object));
              } else {
                newTriples.push(F.triple(
                  subject,
                  pred,
                  entry.object,
                  F.gen(),
                ));
              }
            } else {
              const genTriples = extractCollection(entry);
              newTriples.push(...genTriples);
            }
          }
          return F.patternBgp(newTriples, F.sourceLocationNodeReplaceUnsafe(current.loc));
        },
      );

      const result = generator.generate(flattenCollections, query);
      expect(result).toBe(`
BASE <ex:>
CONSTRUCT { 
  ?s0 ?p0 _:g_13 . _:g_13 <a0> _:g_14 . _:g_14 <b0> <c0> . _:g_15 <a0> _:g_16 . _:g_16 <b0> <c0> . _:g_15 ?p0 ?o0 .
}
WHERE {
  ?s1 ?p1 _:g_17 . ?s1 ?p1 <a1> . ?s1 ?q1 <b1> . ?s1 ?q1 <c1> . _:g_18 ?p2 ?o2 . ?s3 ?p3 _:g_19 . _:g_19 <a3> <b3> . ?s4 ?p4 _:g_20 . _:g_20 <a4> <b4> . _:g_20 <c4> <d4> . _:g_20 <c4> <e4> . ?s5 ?p5 _:g_21 . _:g_21 <a5> _:g_22 . _:g_22 <b5> <c5> . _:g_23 <a6> _:g_24 . _:g_24 <b6> <c6> . _:g_23 ?p6 ?o6 . _:g_25 <a7> <b7> . _:g_25 <c7> <d7> . _:g_25 <c7> <e7> .
}`);
    });
  });

  it ('generates hand constructed query', ({ expect }) => {
    const query = 'SELECT * WHERE { ?s ?p ?o . }';
    const ast = F.querySelect({
      variables: [ F.wildcard(F.gen()) ],
      datasets: F.datasetClauses([], F.sourceLocation()),
      context: [],
      where: F.patternGroup([
        F.patternBgp([
          F.triple(F.variable('s', F.gen()), F.variable('p', F.gen()), F.variable('o', F.gen())),
        ], F.gen()),
      ], F.gen()),
      solutionModifiers: {},
    }, F.gen());
    console.log(JSON.stringify(ast, null, 2));
    const result = generator.generate(ast);
    expect(result).toBe(query);
  });
});
