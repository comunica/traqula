import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { Factory, utils } from '@traqula/algebra-transformations-1-1';
import { type AlgebraTestSuite, sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { toAlgebra, toAst } from '../lib';

const suites: AlgebraTestSuite[] = [ 'dawg-syntax', 'sparql11-query', 'sparql-1.1' ];

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('util functions', () => {
  const factory = new Factory();

  for (const test of sparqlAlgebraTests(suites, false, true)) {
    const { name, json: expected } = test;
    it (name, ({ expect }) => {
      const clone: Algebra.Operation = utils.mapOperation(<Algebra.Operation>expected, {});
      if (clone.type === 'project') {
        const scope = utils.inScopeVariables(clone.input);
        // Console.log(scope);
        const project = <Algebra.Project> toAlgebra(toAst(factory.createProject(clone.input, [])));
        for (const v of project.variables.map(v => v.value)) {
          expect(scope.map(v => v.value)).toContain(v);
        }
      }
      expect(utils.objectify(clone)).toEqual(expected);
    });
  }
});
