import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { Factory, utils } from '@traqula/algebra-transformations-1-1';
import { sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { translate, toSparql } from '../lib';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('util functions', () => {
  const factory = new Factory();

  for (const test of sparqlAlgebraTests(false, true)) {
    const { name, json: expected } = test;
    it (name, ({ expect }) => {
      const clone: Algebra.Operation = utils.mapOperation(<Algebra.Operation>expected, {});
      if (clone.type === 'project') {
        // Const scope = Util.inScopeVariables(clone.input);
        const project = <Algebra.Project> translate(toSparql(factory.createProject(clone.input, [])));
        for (const _v of project.variables.map(v => v.value)) {
          // Expect(scope.map(v => v.value)).toContain(v);
        }
      }
      expect(utils.objectify(clone)).toEqual(expected);
    });
  }
});
