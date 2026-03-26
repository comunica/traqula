import { describe, it } from 'vitest';
import { createParserCliRuntime, handleParserCliRequest } from '../lib/cli.js';

describe('parser CLI runtime', () => {
  it('parses a query', ({ expect }) => {
    const runtime = createParserCliRuntime();
    const ast = handleParserCliRequest(runtime, {
      query: 'SELECT * WHERE { ?s ?p ?o }',
    }) as { loc?: unknown; where?: unknown };

    expect(ast.loc).toBeDefined();
    expect(ast.where).toBeDefined();
  });

  it('parses a path expression', ({ expect }) => {
    const runtime = createParserCliRuntime();
    const path = handleParserCliRequest(runtime, {
      query: '<https://example.org/p> / <https://example.org/q>',
      path: true,
    }) as { loc?: unknown };

    expect(path.loc).toBeDefined();
  });
});
