import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { Canonicalizer, utils } from '@traqula/algebra-transformations-1-1';
import { Generator as Generator11 } from '@traqula/generator-sparql-1-1';
import { Parser as Parser11 } from '@traqula/parser-sparql-1-1';
import { positiveTest, sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { translate, toSparql } from '../lib';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('sparql output', () => {
  const canon = new Canonicalizer();
  const parser = new Parser11();
  const generator = new Generator11();

  describe('sparqlAlgebraTests', () => {
    for (const test of sparqlAlgebraTests(false, false)) {
      const { name, json, quads } = test;
      const expected = <Algebra.Operation> json;
      it (name, ({ expect }) => {
        const genAst = toSparql(expected);
        // Console.log(JSON.stringify(genAst, null, 2));
        const genQuery = generator.generate(genAst);
        // Console.log(genQuery);
        const ast = parser.parse(genQuery);
        const algebra = utils.objectify(translate(ast, { quads }));
        expect(canon.canonicalizeQuery(algebra, false)).toEqual(canon.canonicalizeQuery(expected, false));
      });
    }
  });

  describe('static 11', () => {
    for (const { name, statics } of positiveTest('sparql-1-1', x => ![
      // 2x Sequence path introduces new variable that is then scoped in projection
      'sequence-paths-in-anonymous-node',
      'sparql-9-3c',
      // Values is pushed from being solution modifier to being in patternGroup
      'sparql-values-clause',
    ].includes(x))) {
      it(`can algebra circle ${name}`, async({ expect }) => {
        const { query } = await statics();
        const path = parser.parse(query);
        // Console.log(JSON.stringify(path, null, 2));
        const algebra = utils.objectify(translate(path, { quads: true }));
        // Console.log(JSON.stringify(algebra, null, 2));
        const pathFromAlg = toSparql(algebra);
        // Console.log(JSON.stringify(pathFromAlg, null, 2));
        const queryGen = generator.generate(pathFromAlg);
        // Console.log(queryGen);
        const parsedGen = parser.parse(queryGen);
        const astFromGen = utils.objectify(translate(parsedGen, { quads: true }));
        expect(canon.canonicalizeQuery(astFromGen, false)).toEqual(canon.canonicalizeQuery(algebra, false));
      });
    }
  });
});
