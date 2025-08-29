import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { Canonicalizer, utils } from '@traqula/algebra-transformations-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import { sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { translate12 } from '../lib';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('algebra output', () => {
  const canon = new Canonicalizer();
  const parser = new Parser();

  for (const blankToVariable of [ true, false ]) {
    for (const test of sparqlAlgebraTests(blankToVariable, true)) {
      const { name, json, sparql: query } = test;
      it(`${name}${blankToVariable ? ' (no blanks)' : ''}`, ({ expect }) => {
        const ast = parser.parse(query);
        const algebra = utils.objectify(
          translate12(ast, {
            quads: name.endsWith('-quads'),
            blankToVariable,
          }),
        );
        expect(canon.canonicalizeQuery(algebra, blankToVariable))
          .toEqual(canon.canonicalizeQuery(<Algebra.Operation>json, blankToVariable));
      });
    }
  }
});
