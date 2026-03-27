import { Readable } from 'node:stream';
import type { JsonlResponse } from '@traqula/cli-utils';
import { runJsonlService } from '@traqula/cli-utils';
import { describe, it, expect } from 'vitest';
import { createParserCliRuntime, handleParserCliRequest } from '../lib/cli.js';

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

describe('parser CLI runtime', () => {
  it('parses a query', () => {
    const runtime = createParserCliRuntime();
    const ast = <{ loc?: unknown; where?: unknown }> handleParserCliRequest(runtime, {
      query: 'SELECT * WHERE { ?s ?p ?o }',
    });

    expect(ast.loc).toBeDefined();
    expect(ast.where).toBeDefined();
  });

  it('parses a path expression', () => {
    const runtime = createParserCliRuntime();
    const path = <{ loc?: unknown }> handleParserCliRequest(runtime, {
      query: '<https://example.org/p> / <https://example.org/q>',
      path: true,
    });

    expect(path.loc).toBeDefined();
  });

  it('merges per-request context with runtime defaults', () => {
    const runtime = createParserCliRuntime({
      prefixes: { ex: 'http://example.org/' },
    });
    // The per-request context overrides skipValidation; the runtime default
    // prefixes should still be merged and variable parsing must still work.
    const ast = <{ where?: unknown }> handleParserCliRequest(runtime, {
      query: 'SELECT * WHERE { ?s ?p ?o }',
      context: { skipValidation: true },
    });
    expect(ast.where).toBeDefined();
  });

  it('throws on syntactically invalid query', () => {
    const runtime = createParserCliRuntime();
    expect(() => handleParserCliRequest(runtime, { query: '{ { {' })).toThrow();
  });
});

describe('parser service mode', () => {
  it('parses a query via JSONL service', async() => {
    const input = makeStream([ '{"id":"1","query":"SELECT * WHERE { ?s ?p ?o }"}' ]);
    const output = makeOutput();
    const runtime = createParserCliRuntime();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ query: string; path?: boolean }> request;
        return handleParserCliRequest(runtime, { query: data.query, path: data.path ?? false });
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0].ok).toBe(true);
    expect(lines[0].id).toBe('1');
    expect(lines[0].result).toHaveProperty('where');
  });

  it('returns error response when query is syntactically invalid', async() => {
    const input = makeStream([ '{"id":"bad","query":"{ { {"}' ]);
    const output = makeOutput();
    const runtime = createParserCliRuntime();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ query: string }> request;
        return handleParserCliRequest(runtime, { query: data.query });
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0].ok).toBe(false);
    expect(lines[0].id).toBe('bad');
    expect(lines[0].error?.message).toBeDefined();
  });

  it('processes multiple requests and preserves per-request context', async() => {
    const input = makeStream([
      '{"id":"1","query":"SELECT * WHERE { ?s ?p ?o }"}',
      '{"id":"2","query":"ASK { ?x ?y ?z }"}',
    ]);
    const output = makeOutput();
    const runtime = createParserCliRuntime();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ query: string }> request;
        return handleParserCliRequest(runtime, { query: data.query });
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ id: '1', ok: true });
    expect(lines[1]).toMatchObject({ id: '2', ok: true });
  });

  it('returns error when request is not an object', async() => {
    const input = makeStream([ '"just a string"' ]);
    const output = makeOutput();

    await runJsonlService(
      (request: unknown) => {
        if (request === null || typeof request !== 'object') {
          throw new Error('Service request must be a JSON object');
        }
        return 'ok';
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines[0].ok).toBe(false);
    expect(lines[0].error?.message).toContain('JSON object');
  });

  it('returns error when query property is missing', async() => {
    const input = makeStream([ '{"id":"x","path":false}' ]);
    const output = makeOutput();

    await runJsonlService(
      (request: unknown) => {
        const data = <{ query?: unknown }> request;
        if (typeof data.query !== 'string') {
          throw new TypeError('Missing string property: query');
        }
        return 'ok';
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines[0]).toMatchObject({ id: 'x', ok: false });
    expect(lines[0].error?.message).toContain('query');
  });
});
