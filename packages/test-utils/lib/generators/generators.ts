/* eslint-disable import/no-nodejs-modules */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readFile } from '../fileUtils.js';
import { getStaticFilePath } from './utils.js';

interface PositiveTest {
  name: string;
  statics: () => Promise<{
    query: string;
    astWithSource: unknown;
    astNoSource: unknown;
    autoGen: string;
    autoGenCompact: string;
  }>;
}

/**
 * Yields test cases for positive SPARQL parser tests.
 * Each test provides the query string, expected ASTs (with and without source tracking),
 * and auto-generated query strings (pretty-printed and compact).
 * @param type - The test suite to use.
 * @param filter - Optional filter predicate applied to the test file name (without extension).
 */
export function* positiveTest(
  type: 'paths' | 'sparql-1-1' | 'sparql-1-2',
  filter?: (name: string) => boolean,
): Generator<PositiveTest> {
  const astDir = getStaticFilePath('ast');
  const jsonSourceTrackedDir = join(astDir, 'ast-source-tracked', type);
  const jsonNonSourceTrackedDir = join(astDir, 'ast-no-source-tracked', type);
  const sparqlDir = join(astDir, 'sparql', type);
  const sparqlGeneratedDir = join(astDir, 'sparql-generated', type);
  const sparqlGenCompactDir = join(astDir, 'sparql-generated-compact', type);
  const statics = readdirSync(jsonSourceTrackedDir);
  for (const file of statics) {
    if (filter && !filter(file.replace('.json', ''))) {
      continue;
    }
    const name = file.replace(/\.json$/u, '');
    yield {
      name,
      statics: async() => {
        const query = await readFile(join(sparqlDir, `${name}.sparql`));
        const sourceTracked = await readFile(join(jsonSourceTrackedDir, file));
        let noSourceTracked: string;
        try {
          noSourceTracked = await readFile(join(jsonNonSourceTrackedDir, file));
        } catch {
          noSourceTracked = '{}';
        }
        let autoGen = '';
        try {
          autoGen = await readFile(join(sparqlGeneratedDir, `${name}.sparql`));
        } catch { /* Already initialized */ }
        let autoGenCompact = '';
        try {
          autoGenCompact = await readFile(join(sparqlGenCompactDir, `${name}.sparql`));
        } catch { /* Already initialized */ }
        return {
          query,
          astWithSource: JSON.parse(sourceTracked),
          astNoSource: JSON.parse(noSourceTracked),
          autoGen,
          autoGenCompact,
        };
      },
    };
  }
}

export interface NegativeTest {
  name: string;
  statics: () => Promise<{
    query: string;
  }>;
}

/**
 * Yields test cases for negative (invalid) SPARQL parser tests.
 * Each test provides a query string that should fail to parse.
 * @param type - The test suite to use.
 * @param filter - Optional filter predicate applied to the test file name (without extension).
 */
export function* negativeTest(
  type: 'sparql-1-1-invalid' | 'sparql-1-2-invalid',
  filter?: (name: string) => boolean,
): Generator<NegativeTest> {
  const astDir = getStaticFilePath('ast');
  const sparqlGeneratedDir = join(astDir, 'sparql', type);
  const statics = readdirSync(sparqlGeneratedDir).filter(f => f.endsWith('.sparql'));
  for (const file of statics) {
    if (filter && !filter(file.replace('.sparql', ''))) {
      continue;
    }
    const name = file.replace(/\.sparql$/u, '');
    yield {
      name,
      statics: async() => {
        const query = await readFile(join(sparqlGeneratedDir, file));
        return {
          query,
        };
      },
    };
  }
}
