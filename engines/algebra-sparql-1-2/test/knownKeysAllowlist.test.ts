import type { Algebra } from '@traqula/algebra-transformations-1-2';
import { algebraUtils } from '@traqula/algebra-transformations-1-2';
import { TransformerSubTyped } from '@traqula/core';
import { sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { suites } from './extraCoverage.test.js';

describe('algebraUtils.knownKeysAllowlist', () => {
  const unrestricted = new TransformerSubTyped<Algebra.Operation>();
  const allowlisted = new TransformerSubTyped<Algebra.Operation>({}, algebraUtils.knownKeysAllowlist);

  function visitedOperations(transformer: TransformerSubTyped<Algebra.Operation>, operation: object): object[] {
    const visited: object[] = [];
    const visitor = (node: object): void => {
      visited.push(node);
    };
    transformer.visitNode(
      operation,
      Object.fromEntries(Object.keys(algebraUtils.knownKeysAllowlist).map(type => [ type, { visitor }])),
    );
    return visited;
  }

  for (const suite of suites) {
    it(`visits all operations of the ${suite} algebra`, ({ expect }) => {
      for (const { name, json } of sparqlAlgebraTests(suite, false, false)) {
        const allOperations = visitedOperations(unrestricted, <object> json);
        const allowedOperations = visitedOperations(allowlisted, <object> json);
        expect(allowedOperations.length, name).toBe(allOperations.length);
        expect(allowedOperations.every((operation, index) => operation === allOperations[index]), name).toBe(true);
      }
    });
  }

  it('does not visit unknown keys of known operations', ({ expect }) => {
    const extension = { type: 'bgp', patterns: []};
    const operation = { type: 'join', input: [{ type: 'bgp', patterns: []}], extension };
    expect(visitedOperations(unrestricted, operation)).toContain(extension);
    expect(visitedOperations(allowlisted, operation)).not.toContain(extension);
  });
});
