/* eslint-disable import/no-nodejs-modules */
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';

export interface JsonlResponse {
  readonly id?: number | string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: { readonly message: string };
}

export interface JsonlServiceStreams {
  readonly input?: Readable;
  readonly output?: { write: (chunk: string) => void };
}

/**
 * Run a JSONL request/response service over stdio (or injected streams).
 *
 * Each line of input must be a JSON object. The handler is called with the
 * parsed object and its return value is sent back as a JSONL response.
 * Malformed JSON and handler errors are reported as error responses.
 *
 * @param handler - Async or sync function that processes a single request.
 * @param streams - Optional stream overrides for testing (defaults to process.stdin / process.stdout).
 */
export async function runJsonlService(
  handler: (request: unknown) => Promise<unknown> | unknown,
  streams: JsonlServiceStreams = {},
): Promise<void> {
  const input = streams.input ?? process.stdin;
  const output = streams.output ?? process.stdout;

  const rl = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  for await (const lineRaw of rl) {
    const line = lineRaw.trim();
    if (line.length === 0) {
      continue;
    }
    let request: unknown;
    try {
      request = JSON.parse(line);
    } catch {
      output.write(`${JSON.stringify({ ok: false, error: { message: 'Invalid JSON request' }})}\n`);
      continue;
    }

    const id =
      typeof request === 'object' && request !== null ? (<Record<string, unknown>> request).id : undefined;
    try {
      const result = await handler(request);
      const response: JsonlResponse = {
        id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
        ok: true,
        result,
      };
      output.write(`${JSON.stringify(response)}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const response: JsonlResponse = {
        id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
        ok: false,
        error: { message },
      };
      output.write(`${JSON.stringify(response)}\n`);
    }
  }
}
