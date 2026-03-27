import { Readable } from 'node:stream';
import { describe, it, expect } from 'vitest';
import type { JsonlResponse } from '../lib/index.js';
import { runJsonlService } from '../lib/index.js';

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

describe('runJsonlService', () => {
  it('processes a single valid request', async() => {
    const input = makeStream([ '{"id":"1","value":42}' ]);
    const output = makeOutput();

    await runJsonlService(
      async(req: unknown) => ({ echo: (<{ value: number }> req).value }),
      { input, output },
    );

    const lines = output.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ id: '1', ok: true, result: { echo: 42 }});
  });

  it('processes multiple requests in order', async() => {
    const input = makeStream([
      '{"id":1,"n":10}',
      '{"id":2,"n":20}',
      '{"id":3,"n":30}',
    ]);
    const output = makeOutput();

    await runJsonlService(
      async(req: unknown) => (<{ n: number }> req).n * 2,
      { input, output },
    );

    const lines = output.lines();
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ id: 1, ok: true, result: 20 });
    expect(lines[1]).toEqual({ id: 2, ok: true, result: 40 });
    expect(lines[2]).toEqual({ id: 3, ok: true, result: 60 });
  });

  it('returns error response for invalid JSON lines', async() => {
    const input = makeStream([ 'not valid json' ]);
    const output = makeOutput();

    await runJsonlService(async() => 'should not reach', { input, output });

    const lines = output.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ ok: false, error: { message: 'Invalid JSON request' }});
  });

  it('returns error response when handler throws', async() => {
    const input = makeStream([ '{"id":"err-1"}' ]);
    const output = makeOutput();

    await runJsonlService(
      async() => {
        throw new Error('processing failed');
      },
      { input, output },
    );

    const lines = output.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ id: 'err-1', ok: false, error: { message: 'processing failed' }});
  });

  it('includes id from request in error response', async() => {
    const input = makeStream([ '{"id":"abc","bad":true}' ]);
    const output = makeOutput();

    await runJsonlService(
      async() => {
        throw new Error('boom');
      },
      { input, output },
    );

    expect(output.lines()[0].id).toBe('abc');
  });

  it('omits id from response when request has no id', async() => {
    const input = makeStream([ '{"value":1}' ]);
    const output = makeOutput();

    await runJsonlService(async() => 'ok', { input, output });

    const response = output.lines()[0];
    expect(response.id).toBeUndefined();
    expect(response.ok).toBe(true);
  });

  it('supports numeric ids', async() => {
    const input = makeStream([ '{"id":99}' ]);
    const output = makeOutput();

    await runJsonlService(async() => 'done', { input, output });

    expect(output.lines()[0].id).toBe(99);
  });

  it('skips blank lines', async() => {
    const input = makeStream([ '', '   ', '{"id":"1"}' ]);
    const output = makeOutput();

    await runJsonlService(async() => 'ok', { input, output });

    expect(output.lines()).toHaveLength(1);
  });

  it('handles a non-Error thrown value', async() => {
    const input = makeStream([ '{}' ]);
    const output = makeOutput();

    const nonError: unknown = 'string error';
    await runJsonlService(async() => {
      throw <Error> nonError;
    }, { input, output });

    expect(output.lines()[0]).toEqual({ ok: false, error: { message: 'Unknown error' }});
  });

  it('handles a mix of valid and invalid lines', async() => {
    const input = makeStream([
      '{"id":"1"}',
      'bad json',
      '{"id":"2"}',
    ]);
    const output = makeOutput();

    await runJsonlService(async() => 'result', { input, output });

    const lines = output.lines();
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ id: '1', ok: true });
    expect(lines[1]).toMatchObject({ ok: false });
    expect(lines[2]).toMatchObject({ id: '2', ok: true });
  });

  it('defaults to process.stdin and process.stdout when no streams provided', () => {
    // Verify the function signature accepts no streams argument
    expect(() => runJsonlService(async() => {})).not.toThrow();
  });
});
