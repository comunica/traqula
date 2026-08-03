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

  function usesGrouping(op: Algebra.Operation): boolean {
    let grouping = false;
    algebraUtils.visitOperation(op, {
      // Variables of a nested projection are masked, its grouping is of no concern here.
      project: { preVisitor: () => ({ continue: false }) },
      group: {
        preVisitor: () => ({ shortcut: true }),
        visitor: () => {
          grouping = true;
        },
      },
    });
    return grouping;
  }

  for (const suite of suites) {
    describe(suite, () => {
      for (const test of sparqlAlgebraTests(suite, false, true)) {
        const { name, json: expected } = test;
        it (name, ({ expect }) => {
          const clone = <Algebra.Operation> algebraUtils.mapOperation(<Algebra.Operation>expected, {});
          if (clone.type === 'project' && !usesGrouping(clone.input)) {
            const scope = algebraUtils.inScopeVariables(clone.input);
            // Console.log(scope);
            // Cannot perform `select *` on aggergates.
            const project = <Algebra.Project> toAlgebra(toAst(factory.createProject(clone.input, [])));
            for (const v of project.variables.map(v => v.value)) {
              expect(scope.map(v => v.value)).toContain(v);
            }
          }
          expect(algebraUtils.objectify(clone)).toEqual(expected);
        });
      }
    });
  }
});
