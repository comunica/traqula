import type { Algebra } from '@traqula/algebra-transformations-1-2';
import { algebraUtils, createAlgebraContext, createAstContext } from '@traqula/algebra-transformations-1-2';
import { TransformerSubTyped } from '@traqula/core';
import { Parser } from '@traqula/parser-sparql-1-2';
import type { QuerySelect } from '@traqula/rules-sparql-1-2';
import { AstTransformer, astKnownKeysAllowlist } from '@traqula/rules-sparql-1-2';
import type { AlgebraTestSuite } from '@traqula/test-utils';
import { sparqlAlgebraOnlyTests, sparqlAlgebraTests } from '@traqula/test-utils';
import { describe, it, vi } from 'vitest';
import { toAlgebra, toAlgebra12Builder, toAst, toAst12Builder } from '../lib/index.js';

// Not imported from a test file, which would register its tests here too
const suites: AlgebraTestSuite[] = [ 'dawg-syntax', 'sparql11-query', 'sparql-1.1', 'sparql12' ];

describe('algebraUtils.knownKeysAllowlist', () => {
  const allowlisted = new TransformerSubTyped<Algebra.Operation>({}, algebraUtils.knownKeysAllowlist);

  function visitedOperations(visitOperation: typeof algebraUtils.visitOperation, operation: object): object[] {
    const visited: object[] = [];
    const visitor = (node: object): void => {
      visited.push(node);
    };
    visitOperation(
      operation,
      Object.fromEntries(Object.keys(algebraUtils.knownKeysAllowlist).map(type => [ type, { visitor }])),
    );
    return visited;
  }

  for (const suite of suites) {
    it(`visits the operations of the ${suite} algebra the algebra utilities visit`, ({ expect }) => {
      for (const { name, json } of sparqlAlgebraTests(suite, false, false)) {
        const expectedOperations = visitedOperations(algebraUtils.visitOperation, <object> json);
        const allowedOperations = visitedOperations(allowlisted.visitNode.bind(allowlisted), <object> json);
        expect(allowedOperations.length, name).toBe(expectedOperations.length);
        expect(allowedOperations.every((operation, index) => operation === expectedOperations[index]), name).toBe(true);
      }
    });
  }

  it('does not visit unknown keys of known operations', ({ expect }) => {
    const extension = { type: 'bgp', patterns: []};
    const operation = { type: 'join', input: [{ type: 'bgp', patterns: []}], extension };
    expect(visitedOperations(algebraUtils.visitOperation, operation)).toContain(extension);
    expect(visitedOperations(allowlisted.visitNode.bind(allowlisted), operation)).not.toContain(extension);
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

  it('lets toAst give the same AST with an unrestricted algebra transformer', ({ expect }) => {
    const algebraTransformer = new TransformerSubTyped<Algebra.Operation>();
    const parser = new Parser();
    for (const suite of suites) {
      for (const { name, sparql, quads, namedAggregatorCallback } of sparqlAlgebraTests(suite, false, true)) {
        // Built by toAlgebra, since the triple terms of the JSON algebra have a type, making them look like patterns
        // to a transformer that steps into RDF terms.
        const ast = parser.parse(sparql, { namedAggregatorCallback });
        const operation = toAlgebra(ast, { quads, namedAggregatorCallback });
        expect(toAst(operation, { algebraTransformer }), name).toEqual(toAst(operation));
      }
    }
  });

  it('lets contexts without an algebra transformer traverse with the default one', ({ expect }) => {
    const parser = new Parser();
    const algebraTransformer = undefined;
    const expectSameAst = (operation: Algebra.Operation, name: string): void => {
      expect(toAst12Builder.build().algToSparql({ ...createAstContext(), algebraTransformer }, operation), name)
        .toEqual(toAst(operation));
    };
    for (const suite of suites) {
      for (const { name, sparql, quads, namedAggregatorCallback } of sparqlAlgebraTests(suite, true, true)) {
        const ast = parser.parse(sparql, { namedAggregatorCallback });
        const options = { quads, namedAggregatorCallback, blankToVariable: true };
        const operation = toAlgebra12Builder.build()
          .translateQuery({ ...createAlgebraContext(options), algebraTransformer }, ast, quads, true);
        expect(operation, name).toEqual(toAlgebra(ast, options));
        expectSameAst(operation, name);
      }
    }
    // Algebra no query translates to, like an EXTEND over a GROUP, reaches rules of toAst no query reaches
    for (const { name, json } of sparqlAlgebraOnlyTests('sparql-1.1-algebra-only')) {
      expectSameAst(<Algebra.Operation> json, name);
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
