import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { readTextInput, writeTextOutput, readJsonInput, writeJsonOutput } from '../lib/index.js';

const tmpDir = os.tmpdir();

async function withTempFile(
  content: string,
  fn: (filePath: string) => Promise<void>,
): Promise<void> {
  const filePath = path.join(tmpDir, `traqula-test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  await fs.writeFile(filePath, content, 'utf8');
  try {
    await fn(filePath);
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

async function withEmptyTempFile(fn: (filePath: string) => Promise<void>): Promise<void> {
  const filePath = path.join(tmpDir, `traqula-out-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  try {
    await fn(filePath);
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

describe('readTextInput', () => {
  it('reads content from a file', async() => {
    await withTempFile('hello world', async(filePath) => {
      const result = await readTextInput(filePath);
      expect(result).toBe('hello world');
    });
  });

  it('reads UTF-8 content including special characters', async() => {
    const text = 'prefix rdf: <http://www.w3.org/1999/02/rdf-syntax-ns#>';
    await withTempFile(text, async(filePath) => {
      expect(await readTextInput(filePath)).toBe(text);
    });
  });

  it('throws when file does not exist', async() => {
    await expect(readTextInput('/does/not/exist.txt')).rejects.toThrow();
  });
});

describe('writeTextOutput', () => {
  it('writes content to a file', async() => {
    await withEmptyTempFile(async(filePath) => {
      await writeTextOutput('SELECT * WHERE { ?s ?p ?o }', filePath);
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('SELECT * WHERE { ?s ?p ?o }');
    });
  });

  it('writes content that already ends with newline unchanged', async() => {
    await withEmptyTempFile(async(filePath) => {
      await writeTextOutput('line\n', filePath);
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('line\n');
    });
  });

  it('throws when output directory does not exist', async() => {
    await expect(writeTextOutput('data', '/no/such/dir/out.txt')).rejects.toThrow();
  });
});

describe('readJsonInput', () => {
  it('parses JSON from file', async() => {
    await withTempFile('{"key":"value"}', async(filePath) => {
      const result = await readJsonInput<{ key: string }>(filePath);
      expect(result).toEqual({ key: 'value' });
    });
  });

  it('parses an array from file', async() => {
    await withTempFile('[1,2,3]', async(filePath) => {
      const result = await readJsonInput<number[]>(filePath);
      expect(result).toEqual([ 1, 2, 3 ]);
    });
  });

  it('throws on invalid JSON', async() => {
    await withTempFile('{invalid}', async(filePath) => {
      await expect(readJsonInput(filePath)).rejects.toThrow();
    });
  });
});

describe('writeJsonOutput', () => {
  it('writes compact JSON to file', async() => {
    await withEmptyTempFile(async(filePath) => {
      await writeJsonOutput({ a: 1 }, false, filePath);
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('{"a":1}\n');
    });
  });

  it('writes pretty-printed JSON to file', async() => {
    await withEmptyTempFile(async(filePath) => {
      await writeJsonOutput({ a: 1 }, true, filePath);
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('{\n  "a": 1\n}\n');
    });
  });
});
