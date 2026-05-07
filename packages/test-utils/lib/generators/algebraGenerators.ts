/* eslint-disable import/no-nodejs-modules */
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readFile, readFileSync } from '../fileUtils.js';
import type { NegativeTest } from './generators.js';
import { getStaticFilePath } from './utils.js';

const rootDir = getStaticFilePath('algebra');
const rootSparql = join(rootDir, 'sparql');
const rootJson = join(rootDir, 'algebra');
const rootJsonBlankToVariable = join(rootDir, 'algebra-blank-to-var');
const rootCanonicalSparql = join(rootDir, 'canonical-sparql', 'base');
const rootCanonicalSparqlBlankToVar = join(rootDir, 'canonical-sparql', 'blank-to-var');

export interface algebraTestGen {
  name: string;
  json: unknown;
  quads: boolean;
  sparql: string | undefined;
  canonicalSparql: string | undefined;
}

export type AlgebraTestSuite = 'dawg-syntax' | 'sparql-1.1' | 'sparql11-query' | 'sparql12';

/**
 * Yields algebra-level test cases from the static test fixtures.
 * Each test provides a SPARQL query, expected algebra JSON, and optionally a canonical SPARQL string.
 * For each unique base test name, yields both a `quads: false` and a `quads: true` variant
 * when the corresponding expected algebra fixture exists.
 * @param suite - The test suite to iterate.
 * @param blankToVariable - Whether to use the blank-to-variable fixture variant.
 * @param getSPARQL - Whether to load the SPARQL and canonical SPARQL strings.
 */
export function sparqlAlgebraTests(suite: AlgebraTestSuite, blankToVariable: boolean, getSPARQL: true):
Generator<algebraTestGen & { sparql: string; canonicalSparql: string }>;
export function sparqlAlgebraTests(suite: AlgebraTestSuite, blankToVariable: boolean, getSPARQL: boolean):
Generator<algebraTestGen>;
export function* sparqlAlgebraTests(suite: AlgebraTestSuite, blankToVariable: boolean, getSPARQL: boolean):
Generator<algebraTestGen> {
  const jsonRoot = blankToVariable ? rootJsonBlankToVariable : rootJson;
  const canonicalRoot = blankToVariable ? rootCanonicalSparqlBlankToVar : rootCanonicalSparql;

  // Collect all unique base names (relative paths without `-quads` suffix and `.json` extension)
  // that have a base (non-quads) JSON file
  function collectBaseNames(relativePath: string, result: Set<string>): void {
    const absolutePath = join(jsonRoot, relativePath);
    if (lstatSync(absolutePath).isDirectory()) {
      for (const sub of readdirSync(absolutePath)) {
        collectBaseNames(join(relativePath, sub), result);
      }
    } else if (!relativePath.endsWith('-quads.json')) {
      result.add(relativePath.replace(/\.json$/u, ''));
    }
  }

  function* yieldForBase(baseName: string): Generator<algebraTestGen> {
    const quadsJsonPath = join(jsonRoot, `${baseName}-quads.json`);
    const sparqlPath = join(rootSparql, `${baseName}.sparql`);
    const canonicalPath = join(canonicalRoot, `${baseName}.sparql`);

    // Yield quads: false variant (base JSON always exists since collectBaseNames filters for it)
    yield {
      name: baseName,
      json: JSON.parse(readFileSync(join(jsonRoot, `${baseName}.json`))),
      quads: false,
      sparql: getSPARQL ? readFileSync(sparqlPath, 'utf-8') : undefined,
      canonicalSparql: getSPARQL ? readFileSync(canonicalPath, 'utf-8') : undefined,
    };

    // Yield quads: true variant if the quads JSON exists
    if (existsSync(quadsJsonPath)) {
      const canonicalQuadsPath = join(canonicalRoot, `${baseName}-quads.sparql`);
      yield {
        name: `${baseName}-quads`,
        json: JSON.parse(readFileSync(quadsJsonPath)),
        quads: true,
        sparql: getSPARQL ? readFileSync(sparqlPath, 'utf-8') : undefined,
        canonicalSparql: getSPARQL ? readFileSync(canonicalQuadsPath, 'utf-8') : undefined,
      };
    }
  }

  const subfolders = readdirSync(jsonRoot);
  if (subfolders.includes(suite)) {
    const baseNames = new Set<string>();
    collectBaseNames(suite, baseNames);
    const sorted = [ ...baseNames ].sort();
    for (const baseName of sorted) {
      yield* yieldForBase(baseName);
    }
  }
}

type GenQuery = { query: string; name: string };
/**
 * Yields raw SPARQL query strings from the static test fixtures for a given suite.
 * @param suite - The test suite to iterate.
 */
export function* sparqlQueries(suite: AlgebraTestSuite): Generator<GenQuery> {
  function* subGen(relativePath: string): Generator<GenQuery> {
    const absolutePath = join(rootSparql, relativePath);
    if (lstatSync(absolutePath).isDirectory()) {
      // Recursion
      for (const sub of readdirSync(absolutePath)) {
        yield* subGen(join(relativePath, sub));
      }
    } else {
      const name = relativePath.replace(/\.sparql$/u, '');
      const content = readFileSync(absolutePath, 'utf-8');
      yield {
        name,
        query: content.replaceAll(/\r?\n/gu, '\n'),
      };
    }
  }

  const subfolders = readdirSync(rootSparql);
  if (subfolders.includes(suite)) {
    yield* subGen(suite);
  }
}

export type NegativeAlgebraSuite = 'sparql-1.1-negative' | 'sparql-1.2-negative';

/**
 * Yields test cases for negative (invalid) algebra-level tests.
 * Each test provides a SPARQL query that should fail during algebra transformation.
 * @param suite - The negative test suite to iterate.
 * @param filter - Optional filter predicate applied to the test file name.
 */
export function* sparqlAlgebraNegativeTests(
  suite: NegativeAlgebraSuite,
  filter?: (name: string) => boolean,
): Generator<NegativeTest> {
  const astDir = getStaticFilePath('algebra');
  const sparqlDir = join(astDir, 'sparql', suite);
  const statics = readdirSync(sparqlDir);
  for (const file of statics.filter(f => f.endsWith('.sparql'))) {
    if (filter && !filter(file.replace('.sparql', ''))) {
      continue;
    }
    const name = file.replace(/\.sparql$/u, '');
    yield {
      name,
      statics: async() => {
        const query = await readFile(join(sparqlDir, file));
        return {
          query,
        };
      },
    };
  }
}
