import { Canonicalizer, algebraUtils } from '@traqula/algebra-transformations-1-2';
import type { Algebra } from '@traqula/algebra-transformations-1-2';
import { TransformerSubTyped } from '@traqula/core';
import { Parser } from '@traqula/parser-sparql-1-2';
import { AstTransformer, astKnownKeysAllowlist } from '@traqula/rules-sparql-1-2';
import { sparqlAlgebraNegativeTests, sparqlAlgebraTests } from '@traqula/test-utils';
import type {
  NegativeAlgebraSuite,
  AlgebraTestSuite,
} from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { toAlgebra } from '../lib/index.js';

export const suites: AlgebraTestSuite[] = [ 'dawg-syntax', 'sparql11-query', 'sparql-1.1', 'sparql12' ];

/**
 * Transformers that only visit the keys the allowlists allow, so they skip unknown keys.
 */
export const knownKeysTransformers = {
  astTransformer: new AstTransformer({ visitChildren: () => {} }, astKnownKeysAllowlist),
  algebraTransformer: new TransformerSubTyped<Algebra.Operation>(
    { visitChildren: () => {} },
    algebraUtils.knownKeysAllowlist,
  ),
};

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('algebra output 1.2', () => {
  const canon = new Canonicalizer();
  const parser = new Parser();

  for (const suite of suites) {
    describe(suite, () => {
      for (const blankToVariable of [ true, false ]) {
        for (const test of sparqlAlgebraTests(suite, blankToVariable, true)) {
          const { name, json, sparql: query, namedAggregatorCallback } = test;
          // If (!name.includes('sparql-1-2-syntax-nested-anonreifier-01') ||
          //   blankToVariable || name.includes('-quads')) {
          //   continue;
          // }
          it(`${name}${blankToVariable ? ' (no blanks)' : ''}`, ({ expect }) => {
            const ast = parser.parse(query, { namedAggregatorCallback });
            const algebra = algebraUtils.objectify(
              toAlgebra(ast, {
                quads: name.endsWith('-quads'),
                blankToVariable,
                namedAggregatorCallback,
              }),
            );
            expect(canon.canonicalizeQuery(algebra, blankToVariable))
              .toEqual(canon.canonicalizeQuery(<Algebra.Operation>json, blankToVariable));
            const knownKeysAlgebra = algebraUtils.objectify(toAlgebra(ast, {
              quads: name.endsWith('-quads'),
              blankToVariable,
              namedAggregatorCallback,
              ...knownKeysTransformers,
            }));
            expect(canon.canonicalizeQuery(knownKeysAlgebra, blankToVariable))
              .toEqual(canon.canonicalizeQuery(<Algebra.Operation>json, blankToVariable));
          });
        }
      }
    });
  }

  for (const suite of [ 'sparql-1.1-negative', 'sparql-1.2-negative' ] satisfies NegativeAlgebraSuite[]) {
    describe(suite, () => {
      for (const test of sparqlAlgebraNegativeTests(suite)) {
        it(test.name, async({ expect }) => {
          const { query } = await test.statics();
          const ast = parser.parse(query, { skipValidation: true });
          expect(() => algebraUtils.objectify(toAlgebra(ast))).toThrow();
        });
      }
    });
  }
});
