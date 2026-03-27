import { Readable } from 'node:stream';
import type { Algebra } from '@traqula/algebra-transformations-1-1';
import type { JsonlResponse } from '@traqula/cli-utils';
import { runJsonlService } from '@traqula/cli-utils';
import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, it, expect } from 'vitest';
import { createAlgebraCliRuntime, handleAlgebraCliRequest } from '../lib/cli.js';

function makeStream(lines: string[]): Readable {
  return Readable.from(`${lines.join('\n')}\n`);
}

function makeOutput(): { write: (chunk: string) => void; lines: () => JsonlResponse[] } {
  const chunks: string[] = [];
  return {
    write(chunk: string) {
      chunks.push(chunk);
    },
    lines() {
      return chunks.join('').split('\n').filter(l => l.length > 0).map(l => <JsonlResponse> JSON.parse(l));
    },
  };
}

const parser = new Parser();

describe('algebra CLI runtime', () => {
  it('converts AST to algebra and back', () => {
    const runtime = createAlgebraCliRuntime();
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o }');

    const algebra = <Algebra.Operation> handleAlgebraCliRequest(runtime, {
      mode: 'toAlgebra',
      input: ast,
    });

    expect(algebra).toHaveProperty('type');

    const astAgain = <{ where?: unknown; loc?: unknown }> handleAlgebraCliRequest(runtime, {
      mode: 'toAst',
      input: algebra,
    });

    expect(astAgain.where).toBeDefined();
    expect(astAgain.loc).toBeDefined();
  });

  it('converts AST to algebra with quads option', () => {
    const runtime = createAlgebraCliRuntime();
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o }');

    const algebra = <Algebra.Operation> handleAlgebraCliRequest(runtime, {
      mode: 'toAlgebra',
      input: ast,
      options: { quads: true },
    });

    expect(algebra).toHaveProperty('type');
  });

  it('converts AST to algebra with blank-to-variable option', () => {
    const runtime = createAlgebraCliRuntime();
    const ast = parser.parse('SELECT * WHERE { _:b0 ?p ?o }');

    const algebra = <Algebra.Operation> handleAlgebraCliRequest(runtime, {
      mode: 'toAlgebra',
      input: ast,
      options: { blankToVariable: true },
    });

    expect(algebra).toHaveProperty('type');
  });

  it('throws on invalid input for toAst', () => {
    const runtime = createAlgebraCliRuntime();
    expect(() => handleAlgebraCliRequest(runtime, {
      mode: 'toAst',
      input: <Algebra.Operation> <unknown> { type: 'UNKNOWN_OP' },
    })).toThrow();
  });
});

describe('algebra service mode', () => {
  it('converts AST to algebra via JSONL service', async() => {
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o }');
    const input = makeStream([ JSON.stringify({ id: '1', mode: 'toAlgebra', input: ast }) ]);
    const output = makeOutput();
    const runtime = createAlgebraCliRuntime();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ mode: 'toAlgebra'; input: never }> request;
        return handleAlgebraCliRequest(runtime, { mode: data.mode, input: data.input });
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0].ok).toBe(true);
    expect(lines[0].result).toHaveProperty('type');
  });

  it('converts algebra to AST via JSONL service', async() => {
    const runtime = createAlgebraCliRuntime();
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o }');
    const algebra = handleAlgebraCliRequest(runtime, { mode: 'toAlgebra', input: ast });

    const input = makeStream([ JSON.stringify({ id: '2', mode: 'toAst', input: algebra }) ]);
    const output = makeOutput();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ mode: 'toAst'; input: never }> request;
        return handleAlgebraCliRequest(runtime, { mode: data.mode, input: data.input });
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines[0]).toMatchObject({ id: '2', ok: true });
    expect((<Record<string, unknown>> lines[0].result).where).toBeDefined();
  });

  it('returns error when mode is missing or invalid', async() => {
    const input = makeStream([ '{"id":"x","input":{}}' ]);
    const output = makeOutput();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ mode?: unknown }> request;
        if (data.mode !== 'toAlgebra' && data.mode !== 'toAst') {
          throw new Error('Service request must include mode: toAlgebra | toAst');
        }
        return 'ok';
      },
      { input, output },
    );

    expect(output.lines()[0]).toMatchObject({ id: 'x', ok: false });
    expect(output.lines()[0].error?.message).toContain('mode');
  });

  it('returns error when input is missing', async() => {
    const input = makeStream([ '{"id":"y","mode":"toAlgebra"}' ]);
    const output = makeOutput();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ mode: string; input?: unknown }> request;
        if (data.input === undefined) {
          throw new Error('Service request must include property: input');
        }
        return 'ok';
      },
      { input, output },
    );

    expect(output.lines()[0]).toMatchObject({ id: 'y', ok: false });
    expect(output.lines()[0].error?.message).toContain('input');
  });

  it('processes a batch of toAlgebra requests', async() => {
    const runtime = createAlgebraCliRuntime();
    const queries = [
      'SELECT * WHERE { ?s ?p ?o }',
      'ASK { ?x ?y ?z }',
      'SELECT ?name WHERE { ?s <http://example.org/name> ?name }',
    ];
    const asts = queries.map((q, i) => JSON.stringify({
      id: String(i),
      mode: 'toAlgebra',
      input: parser.parse(q),
    }));

    const inputStream = makeStream(asts);
    const outputStream = makeOutput();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ mode: 'toAlgebra'; input: never }> request;
        return handleAlgebraCliRequest(runtime, { mode: data.mode, input: data.input });
      },
      { input: inputStream, output: outputStream },
    );

    const lines = outputStream.lines();
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.ok).toBe(true);
    }
  });
});
