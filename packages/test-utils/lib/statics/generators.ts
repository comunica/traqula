/* eslint-disable import/no-nodejs-modules,no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readFile } from '../fileUtils';

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
          const query = await readFile(`${dir}/${file.replace('.json', '.sparql')}`);
          const result = await readFile(`${dir}/${file}`);
          let autoGen: string;
          try {
            autoGen = await readFile(`${dir}/${file.replace('.json', '-generated.sparql')}`);
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
          const query = await readFile(`${dir}/${file}`);
          return {
            query,
          };
        },
      };
    }
  }
}
