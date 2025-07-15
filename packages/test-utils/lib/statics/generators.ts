/* eslint-disable import/no-nodejs-modules,no-sync */
import * as fs from 'node:fs';
import fsp from 'node:fs/promises';
import * as path from 'node:path';

interface PositiveTest {
  name: string;
  statics: () => Promise<{
    query: string;
    ast: unknown;
    autoGen: string;
  }>;
}

export function* positiveTest(
  type: 'paths' | 'sparql-1-1' | 'sparql-1-2',
  filter?: (name: string) => boolean,
): Generator<PositiveTest> {
  const dir = path.join(__dirname, type);
  const statics = fs.readdirSync(dir);
  for (const file of statics) {
    if (file.endsWith('.json')) {
      if (filter && !filter(file.replace('.json', ''))) {
        continue;
      }
      yield {
        name: file.replace(/\.json$/u, ''),
        statics: async() => {
          const query = await fsp.readFile(`${dir}/${file.replace('.json', '.sparql')}`, 'utf-8');
          const result = await fsp.readFile(`${dir}/${file}`, 'utf-8');
          let autoGen: string;
          try {
            autoGen = await fsp.readFile(`${dir}/${file.replace('.json', '-generated.sparql')}`, 'utf-8');
          } catch {
            autoGen = query;
          }
          const json: unknown = JSON.parse(result);
          return {
            query,
            ast: json,
            autoGen,
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

export function* negativeTest(
  type: 'sparql-1-2-invalid',
  filter?: (name: string) => boolean,
): Generator<NegativeTest> {
  const dir = path.join(__dirname, type);
  const statics = fs.readdirSync(dir);
  for (const file of statics) {
    if (file.endsWith('.sparql')) {
      if (filter && !filter(file.replace('.sparql', ''))) {
        continue;
      }
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
