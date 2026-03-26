import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, it } from 'vitest';
import { createAlgebraCliRuntime, handleAlgebraCliRequest } from '../lib/cli.js';

describe('algebra CLI runtime', () => {
  it('converts AST to algebra and back', ({ expect }) => {
    const parser = new Parser();
    const runtime = createAlgebraCliRuntime();
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o }');

    const algebra = handleAlgebraCliRequest(runtime, {
      mode: 'toAlgebra',
      input: ast,
    }) as Algebra.Operation;

    expect(algebra).toHaveProperty('type');

    const astAgain = handleAlgebraCliRequest(runtime, {
      mode: 'toAst',
      input: algebra,
    }) as { where?: unknown; loc?: unknown };

    expect(astAgain.where).toBeDefined();
    expect(astAgain.loc).toBeDefined();
  });
});
