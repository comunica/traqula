import { toAlgebra, toAst } from '@traqula/algebra-sparql-1-1';
import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { AlgebraFactory, algebraUtils, isTriple } from '@traqula/algebra-transformations-1-1';
import { sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it } from 'vitest';
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
        it (name, ({ expect }) => {
          const clone = <Algebra.Operation> algebraUtils.mapOperation(<Algebra.Operation>expected, {});
          if (clone.type === 'project') {
            const scope = algebraUtils.inScopeVariables(clone.input);
            // Console.log(scope);
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

describe('algebraUtils utility functions', () => {
  it('resolveIRI returns absolute IRIs unchanged', ({ expect }) => {
    expect(algebraUtils.resolveIRI('http://example.org/foo', 'http://base.org/')).toBe('http://example.org/foo');
    expect(algebraUtils.resolveIRI('urn:example:foo', 'http://base.org/')).toBe('urn:example:foo');
  });

  it('resolveIRI resolves empty relative IRI to base', ({ expect }) => {
    expect(algebraUtils.resolveIRI('', 'http://base.org/')).toBe('http://base.org/');
  });

  it('resolveIRI throws when no base is set and IRI is relative', ({ expect }) => {
    expect(() => algebraUtils.resolveIRI('relative/path', undefined))
      .toThrowError(/Cannot resolve relative IRI/u);
  });

  it('resolveIRI resolves query string relative IRI', ({ expect }) => {
    const result = algebraUtils.resolveIRI('?query=1', 'http://base.org/path');
    expect(result).toBe('http://base.org/path?query=1');
  });

  it('resolveIRI resolves root-relative IRI', ({ expect }) => {
    const result = algebraUtils.resolveIRI('/root/path', 'http://base.org/some/path');
    expect(result).toBe('http://base.org/root/path');
  });

  it('isTriple identifies quad-like objects', ({ expect }) => {
    const triple = { subject: {}, predicate: {}, object: {}};
    expect(isTriple(triple)).toBeTruthy();
    expect(isTriple({ subject: {}})).toBeFalsy();
    expect(isTriple({})).toBeFalsy();
  });
});
