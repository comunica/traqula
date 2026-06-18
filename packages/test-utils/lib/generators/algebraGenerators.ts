/* eslint-disable import/no-nodejs-modules */
import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readFile, readFileSync } from '../fileUtils.js';
import type { NegativeTest } from './generators.js';
import { getStaticFilePath } from './utils.js';

// Computed lazily inside each generator so that getStaticFilePath() is not
// called at module-evaluation time.  This avoids an ESM initialisation-order
// issue where algebraGenerators.js would execute before index.ts has had a
// chance to call _initStaticsRoot().
function getRootDir(): string {
  return getStaticFilePath('algebra');
}
function getRootSparql(): string {
  return join(getRootDir(), 'sparql');
}
function getRootJson(): string {
  return join(getRootDir(), 'algebra');
}
function getRootJsonBlankToVariable(): string {
  return join(getRootDir(), 'algebra-blank-to-var');
}
function getRootCanonicalSparql(): string {
  return join(getRootDir(), 'canonical-sparql', 'base');
}
function getRootCanonicalSparqlBlankToVar(): string {
  return join(getRootDir(), 'canonical-sparql', 'blank-to-var');
}

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
  // Relative path starting from roots declared above.
  function* subGen(relativePath: string): Generator<algebraTestGen> {
    const absolutePath = join(blankToVariable ? getRootJsonBlankToVariable() : getRootJson(), relativePath);
    if (lstatSync(absolutePath).isDirectory()) {
      // Recursion
      for (const sub of readdirSync(absolutePath)) {
        yield* subGen(join(relativePath, sub));
      }
    } else {
      const name = relativePath.replace(/\.json$/u, '');
      const sparqlPath = join(getRootSparql(), relativePath.replace(/\.json/u, '.sparql'));
      const canonicalSparqlPath = join(
        blankToVariable ? getRootCanonicalSparqlBlankToVar() : getRootCanonicalSparql(),
        relativePath.replace(/\.json/u, '.sparql'),
      );
      yield {
        name,
        json: JSON.parse(readFileSync(absolutePath)),
        sparql: getSPARQL ? readFileSync(sparqlPath, 'utf8') : undefined,
        canonicalSparql: getSPARQL ? readFileSync(canonicalSparqlPath, 'utf-8') : undefined,
        quads: name.endsWith('-quads'),
      };
    }
  }

  const subfolders = readdirSync(blankToVariable ? getRootJsonBlankToVariable() : getRootJson());
  if (subfolders.includes(suite)) {
    yield* subGen(suite);
  }
}

type GenQuery = { query: string; name: string };
/**
 * Yields raw SPARQL query strings from the static test fixtures for a given suite.
 * @param suite - The test suite to iterate.
 */
export function* sparqlQueries(suite: AlgebraTestSuite): Generator<GenQuery> {
  function* subGen(relativePath: string): Generator<GenQuery> {
    const absolutePath = join(getRootSparql(), relativePath);
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

  const subfolders = readdirSync(getRootSparql());
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
