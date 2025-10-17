/* eslint-disable import/no-nodejs-modules */
import { readdirSync } from 'node:fs';
import { readFile } from '../fileUtils.js';
import { getStaticFilePath } from './utils.js';

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
  const dir = getStaticFilePath(type);
  const statics = readdirSync(dir);
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
  type: 'sparql-1-1-invalid' | 'sparql-1-2-invalid',
  filter?: (name: string) => boolean,
): Generator<NegativeTest> {
  const dir = getStaticFilePath(type);
  const statics = readdirSync(dir);
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
