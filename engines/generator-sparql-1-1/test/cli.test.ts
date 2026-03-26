import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, it } from 'vitest';
import { createGeneratorCliRuntime, handleGeneratorCliRequest } from '../lib/cli.js';

describe('generator CLI runtime', () => {
  it('generates a query from AST', ({ expect }) => {
    const parser = new Parser();
    const runtime = createGeneratorCliRuntime();
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o }');

    const output = handleGeneratorCliRequest(runtime, { ast });
    expect(output).toContain('SELECT');
    expect(output).toContain('?s ?p ?o');
  });
});
