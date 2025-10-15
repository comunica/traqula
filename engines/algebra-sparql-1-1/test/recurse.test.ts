import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { AlgebraFactory, algebraUtils } from '@traqula/algebra-transformations-1-1';
import { sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { toAlgebra, toAst } from '../lib/index.js';
import { suites } from './algebra.test.js';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('util functions', () => {
  const factory = new AlgebraFactory();

  for (const suite of suites) {
    describe(suite, () => {
      for (const test of sparqlAlgebraTests(suite, false, true)) {
        const { name, json: expected } = test;
        // Test does not work for when the query selects an unbound variable (since scope is on the input)
        if ([
          'sparql11-query/existence-subquery',
          'sparql11-query/filter-union',
          'sparql-1.1/subqueries/02b-subquery-within-graph-pattern-graph-variable-is-extended',
          'sparql-1.1/subqueries/02b-subquery-within-graph-pattern-graph-variable-is-extended-quads',
        ].includes(name)) {
          continue;
        }
        it (name, ({ expect }) => {
          const clone = <Algebra.Operation> algebraUtils.mapOperation(<Algebra.Operation>expected, {});
          if (clone.type === 'project') {
            const scope = algebraUtils.inScopeVariables(clone.input);
            // Console.log(scope);
            const ast = toAst(factory.createProject(clone.input, clone.variables));
            const project = <Algebra.Project> toAlgebra(ast);
            for (const v of project.variables) {
              expect(scope.map(v => v.value)).toContain(v.value);
            }
          }
          expect(algebraUtils.objectify(clone)).toEqual(expected);
        });
      }
    });
  }
});
