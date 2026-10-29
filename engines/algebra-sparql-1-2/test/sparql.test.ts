import { Canonicalizer, algebraUtils } from '@traqula/algebra-transformations-1-2';
import type { Algebra } from '@traqula/algebra-transformations-1-2';
import { Generator as Generator12 } from '@traqula/generator-sparql-1-2';
import { Parser as Parser12 } from '@traqula/parser-sparql-1-2';
import { AstFactory } from '@traqula/rules-sparql-1-2';
import { positiveTest, sparqlAlgebraOnlyTests, sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { toAst, toAlgebra } from '../lib/index.js';
import { knownKeysTransformers, suites } from './algebra.test.js';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('sparql 1.2 algebra transformer', () => {
  const canon = new Canonicalizer();
  const parser = new Parser12();
  const generator = new Generator12();
  // A cyclic unknown key, like the metadata Comunica adds to operations
  const metadata: Record<string, unknown> = { type: 'metadata' };
  metadata.self = metadata;
  const addMetadata = Object.fromEntries(Object.keys(algebraUtils.knownKeysAllowlist)
    .map(type => [ type, { transform: (copy: object) => ({ ...copy, metadata }) }]));

  /**
   * Generates the canonical SPARQL of the algebra, also when only visiting the known keys of the algebra with metadata.
   */
  function generateCanonical(algebra: Algebra.Operation): string[] {
    const withMetadata = algebraUtils.mapOperation<'unsafe', Algebra.Operation>(algebra, addMetadata);
    return [
      generator.generate(toAst(algebra)).trim(),
      generator.generate(toAst(withMetadata, knownKeysTransformers)).trim(),
    ];
  }

  describe('sparqlAlgebraTests', () => {
    for (const suite of suites) {
      describe(suite, () => {
        for (const test of sparqlAlgebraTests(suite, false, false)) {
          const { name, json, quads, namedAggregatorCallback } = test;
          const expected = <Algebra.Operation> json;
          it (name, ({ expect }) => {
            const genAst = toAst(expected);
            // Console.log(JSON.stringify(genAst, null, 2));
            const genQuery = generator.generate(genAst);
            // Console.log(genQuery);
            const ast = parser.parse(genQuery, { namedAggregatorCallback });
            const algebra = algebraUtils.objectify(toAlgebra(ast, { quads, namedAggregatorCallback }));
            expect(canon.canonicalizeQuery(algebra, false)).toEqual(canon.canonicalizeQuery(expected, false));
          });
        }
      });
    }
  });

  describe('sparqlAlgebraTests Canonical SPARQL', () => {
    const astFactory = new AstFactory();
    for (const suite of suites) {
      for (const blankToVariable of [ true, false ]) {
        describe(`${suite}${blankToVariable ? ' with blank to var' : ''}`, () => {
          for (const test of sparqlAlgebraTests(suite, blankToVariable, true)) {
            const { name, quads, canonicalSparql, sparql, namedAggregatorCallback } = test;
            it (name, ({ expect }) => {
              astFactory.resetBlankNodeCounter();
              const parsedAst = parser.parse(sparql, { astFactory, namedAggregatorCallback });
              const algebra = toAlgebra(parsedAst, { quads, blankToVariable, namedAggregatorCallback });
              // Console.log(JSON.stringify(algebra, null, 2));
              expect(generateCanonical(algebra)).toEqual([ canonicalSparql.trim(), canonicalSparql.trim() ]);
            });
          }
        });
      }
    }
  });

  describe('sparqlAlgebraOnlyTests Canonical SPARQL', () => {
    for (const { name, json, canonicalSparql } of sparqlAlgebraOnlyTests('sparql-1.1-algebra-only')) {
      it (name, ({ expect }) => {
        expect(generateCanonical(<Algebra.Operation> json)).toEqual([ canonicalSparql.trim(), canonicalSparql.trim() ]);
      });
    }
  });

  function testLoopQuery(name: string, query: Promise<string>): void {
    it(`can algebra circle ${name}`, async({ expect }) => {
      const ast = parser.parse(await query);
      // Console.log(JSON.stringify(path, null, 2));
      const algebra = algebraUtils.objectify(toAlgebra(ast, { quads: true }));
      // Console.log(JSON.stringify(algebra, null, 2));
      const astFromAlg = toAst(algebra);
      // Console.log(JSON.stringify(pathFromAlg, null, 2));
      const queryGen = generator.generate(astFromAlg);
      // Console.log(queryGen);
      const astFromGen = parser.parse(queryGen);
      const algebraFromGen = algebraUtils.objectify(toAlgebra(astFromGen, { quads: true }));
      expect(canon.canonicalizeQuery(algebraFromGen, false)).toEqual(canon.canonicalizeQuery(algebra, false));
    });
  }

  describe('static 11', () => {
    for (const { name, statics } of positiveTest('sparql-1-1', x => ![
      // 2x Sequence path introduces new variable that is then scoped in projection
      'sequence-paths-in-anonymous-node',
      'sparql-9-3c',
      // Values is pushed from being solution modifier to being in patternGroup
      'sparql-values-clause',
      // Same reason
      'no-space-select',
    ].includes(x))) {
      testLoopQuery(name, statics().then(x => x.query));
    }
  });

  describe('static 12', () => {
    for (const { name, statics } of positiveTest('sparql-1-2', x => ![
    ].includes(<never> x))) {
      testLoopQuery(name, statics().then(x => x.query));
    }
  });
});
