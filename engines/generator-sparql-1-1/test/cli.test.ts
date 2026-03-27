import { Readable } from 'node:stream';
import type { JsonlResponse } from '@traqula/cli-utils';
import { runJsonlService } from '@traqula/cli-utils';
import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, it, expect } from 'vitest';
import { createGeneratorCliRuntime, handleGeneratorCliRequest } from '../lib/cli.js';

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

describe('generator CLI runtime', () => {
  it('generates a query from AST', () => {
    const runtime = createGeneratorCliRuntime();
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o }');

    const output = handleGeneratorCliRequest(runtime, { ast });
    expect(output).toContain('SELECT');
    expect(output).toContain('?s ?p ?o');
  });

  it('generates a path expression from AST', () => {
    const parserForPath = new Parser({ defaultContext: { parseMode: new Set([ 'canParseVars' ]) }});
    const runtime = createGeneratorCliRuntime();
    const pathAst = parserForPath.parsePath('<http://example.org/p> / <http://example.org/q>');

    const output = handleGeneratorCliRequest(runtime, { ast: pathAst, path: true });
    expect(output).toContain('http://example.org/p');
  });

  it('throws on an invalid AST object', () => {
    const runtime = createGeneratorCliRuntime();
    expect(() => handleGeneratorCliRequest(runtime, { ast: <never> { invalid: true }})).toThrow();
  });
});

describe('generator service mode', () => {
  it('generates SPARQL from AST via JSONL service', async() => {
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o }');
    const input = makeStream([ JSON.stringify({ id: '1', ast }) ]);
    const output = makeOutput();
    const runtime = createGeneratorCliRuntime();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ ast: unknown }> request;
        return handleGeneratorCliRequest(runtime, { ast: <never> data.ast });
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0].ok).toBe(true);
    expect(lines[0].result).toContain('SELECT');
  });

  it('returns error when ast property is missing', async() => {
    const input = makeStream([ '{"id":"x"}' ]);
    const output = makeOutput();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ ast?: unknown }> request;
        if (data.ast === undefined) {
          throw new Error('Missing property: ast');
        }
        return 'ok';
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines[0]).toMatchObject({ id: 'x', ok: false });
    expect(lines[0].error?.message).toContain('ast');
  });

  it('processes multiple generate requests in sequence', async() => {
    const ast1 = parser.parse('SELECT * WHERE { ?s ?p ?o }');
    const ast2 = parser.parse('ASK { ?x ?y ?z }');

    const input = makeStream([
      JSON.stringify({ id: '1', ast: ast1 }),
      JSON.stringify({ id: '2', ast: ast2 }),
    ]);
    const output = makeOutput();
    const runtime = createGeneratorCliRuntime();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ ast: never }> request;
        return handleGeneratorCliRequest(runtime, { ast: data.ast });
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ id: '1', ok: true });
    expect(lines[1]).toMatchObject({ id: '2', ok: true });
    expect(lines[1].result).toContain('ASK');
  });

  it('returns error when handler throws', async() => {
    const input = makeStream([ '{"id":"bad","ast":{"type":"invalid"}}' ]);
    const output = makeOutput();
    const runtime = createGeneratorCliRuntime();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ ast: never }> request;
        return handleGeneratorCliRequest(runtime, { ast: data.ast });
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines[0]).toMatchObject({ id: 'bad', ok: false });
    expect(lines[0].error?.message).toBeDefined();
  });
});
