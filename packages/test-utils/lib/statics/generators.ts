/* eslint-disable import/no-nodejs-modules,no-sync */
import * as fs from 'node:fs';
import fsp from 'node:fs/promises';
import * as path from 'node:path';

interface PositiveTest {
  name: string;
  statics: () => Promise<{
    query: string;
    ast: unknown;
  }>;
}

export function* positiveTest(type: 'paths' | 'sparql-1-1' | 'sparql-1-2'): Generator<PositiveTest> {
  const dir = path.join(__dirname, type);
  const statics = fs.readdirSync(dir);
  for (const file of statics) {
    if (file.endsWith('.json')) {
      yield {
        name: file.replace(/\.json$/u, ''),
        statics: async() => {
          const query = await fsp.readFile(`${dir}/${file.replace('.json', '.sparql')}`, 'utf-8');
          const result = await fsp.readFile(`${dir}/${file}`, 'utf-8');
          const json: unknown = JSON.parse(result);
          return {
            query,
            ast: json,
          };
        },
      };
    }
  }
}

interface NegativeTest {
  name: string;
  statics: () => Promise<{
    query: string;
  }>;
}

export function* negativeTest(type: 'sparql-1-2-invalid'): Generator<NegativeTest> {
  const dir = path.join(__dirname, type);
  const statics = fs.readdirSync(dir);
  for (const file of statics) {
    if (file.endsWith('.sparql')) {
      yield {
        name: file.replace(/\.sparql$/u, ''),
        statics: async() => {
          const query = await fsp.readFile(`${dir}/${file}`, 'utf-8');
          return {
            query,
          };
        },
      };
    }
  }
}
