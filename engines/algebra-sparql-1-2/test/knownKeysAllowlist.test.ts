import type { Algebra } from '@traqula/algebra-transformations-1-2';
import { algebraUtils } from '@traqula/algebra-transformations-1-2';
import { TransformerSubTyped } from '@traqula/core';
import { Parser } from '@traqula/parser-sparql-1-2';
import type { QuerySelect } from '@traqula/rules-sparql-1-2';
import { AstTransformer, astKnownKeysAllowlist } from '@traqula/rules-sparql-1-2';
import type { AlgebraTestSuite } from '@traqula/test-utils';
import { sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it, vi } from 'vitest';
import { toAlgebra, toAst } from '../lib/index.js';

// Not imported from a test file, which would register its tests here too
const suites: AlgebraTestSuite[] = [ 'dawg-syntax', 'sparql11-query', 'sparql-1.1', 'sparql12' ];

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

  it('lets toAst skip cyclic unknown keys, like the metadata Comunica adds to operations', ({ expect }) => {
    // Typed, so traversals that only step into typed objects would follow it too
    const metadata: Record<string, unknown> = { type: 'metadata' };
    metadata.self = metadata;
    const addMetadata = Object.fromEntries(Object.keys(algebraUtils.knownKeysAllowlist)
      .map(type => [ type, { transform: (copy: object) => ({ ...copy, metadata }) }]));
    const transformers = {
      algebraTransformer: allowlisted,
      astTransformer: new AstTransformer({}, astKnownKeysAllowlist),
    };
    for (const suite of suites) {
      for (const { name, json } of sparqlAlgebraTests(suite, false, false)) {
        const operation = <Algebra.Operation> json;
        const withMetadata = algebraUtils.mapOperation<'unsafe', Algebra.Operation>(operation, addMetadata);
        expect(toAst(withMetadata, transformers), name).toEqual(toAst(operation));
      }
    }
  });

  it('lets toAlgebra traverse with the given transformers', ({ expect }) => {
    const astTransformer = new AstTransformer({}, astKnownKeysAllowlist);
    const algebraTransformer = new TransformerSubTyped<Algebra.Operation>({}, algebraUtils.knownKeysAllowlist);
    const visitNodeSpecific = vi.spyOn(astTransformer, 'visitNodeSpecific');
    const transformNode = vi.spyOn(algebraTransformer, 'transformNode');
    toAlgebra(new Parser().parse('SELECT * WHERE { ?s ?p _:o }'), {
      blankToVariable: true,
      astTransformer,
      algebraTransformer,
    });
    expect(visitNodeSpecific).toHaveBeenCalled();
    expect(transformNode).toHaveBeenCalled();
  });

  it('lets toAlgebra skip cyclic unknown keys of the AST', ({ expect }) => {
    const metadata: Record<string, unknown> = { type: 'metadata' };
    metadata.self = metadata;
    const ast = <QuerySelect> new Parser().parse('SELECT * WHERE { ?s ?p _:o }');
    const withMetadata = { ...ast, where: { ...ast.where, metadata }};
    const astTransformer = new AstTransformer({}, astKnownKeysAllowlist);
    expect(toAlgebra(withMetadata, { blankToVariable: true, astTransformer }))
      .toEqual(toAlgebra(ast, { blankToVariable: true }));
  });
});
