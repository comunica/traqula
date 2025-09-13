/* eslint-disable import/no-nodejs-modules,no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readFileSync } from '../fileUtils';

const rootDir = path.join(__dirname, 'algebra');
const rootSparql = path.join(rootDir, 'sparql');
const rootJson = path.join(rootDir, 'algebra');
const rootJsonBlankToVariable = path.join(rootDir, 'algebra-blank-to-var');

export interface algebraTestGen {
  name: string;
  json: unknown;
  quads: boolean;
  sparql: string | undefined;
}

export type AlgebraTestSuite = 'dawg-syntax' | 'sparql-1.1' | 'sparql11-query' | 'sparql12';

export function sparqlAlgebraTests(suites: AlgebraTestSuite[], blankToVariable: boolean, getSPARQL: true):
Generator<algebraTestGen & { sparql: string }>;
export function sparqlAlgebraTests(suites: AlgebraTestSuite[], blankToVariable: boolean, getSPARQL: boolean):
Generator<algebraTestGen>;
export function* sparqlAlgebraTests(suites: AlgebraTestSuite[], blankToVariable: boolean, getSPARQL: boolean):
Generator<algebraTestGen> {
  // Relative path starting from roots declared above.
  function* subGen(relativePath: string): Generator<algebraTestGen> {
    const absolutePath = path.join(blankToVariable ? rootJsonBlankToVariable : rootJson, relativePath);
    if (fs.lstatSync(absolutePath).isDirectory()) {
      // Recursion
      for (const sub of fs.readdirSync(absolutePath)) {
        yield* subGen(path.join(relativePath, sub));
      }
    } else {
      const name = relativePath.replace(/\.json$/u, '');
      const sparqlPath = path.join(rootSparql, relativePath.replace(/\.json/u, '.sparql'));
      yield {
        name,
        json: JSON.parse(readFileSync(absolutePath)),
        sparql: getSPARQL ? readFileSync(sparqlPath, 'utf8') : undefined,
        quads: name.endsWith('-quads'),
      };
    }
  }

  const subfolders = fs.readdirSync(blankToVariable ? rootJsonBlankToVariable : rootJson);
  for (const subfolder of subfolders) {
    if ((<string[]> suites).includes(subfolder)) {
      yield* subGen(subfolder);
    }
  }
}

type GenQuery = { query: string; name: string };
export function* sparqlQueries(suites: AlgebraTestSuite[]): Generator<GenQuery> {
  function* subGen(relativePath: string): Generator<GenQuery> {
    const absolutePath = path.join(rootSparql, relativePath);
    if (fs.lstatSync(absolutePath).isDirectory()) {
      // Recursion
      for (const sub of fs.readdirSync(absolutePath)) {
        yield* subGen(path.join(relativePath, sub));
      }
    } else {
      const name = relativePath.replace(/\.sparql$/u, '');
      const content = fs.readFileSync(absolutePath, 'utf-8');
      yield {
        name,
        query: content.replaceAll(/\r?\n/gu, '\n'),
      };
    }
  }

  const subfolders = fs.readdirSync(rootSparql);
  for (const subfolder of subfolders) {
    if ((<string[]> suites).includes(subfolder)) {
      yield* subGen(subfolder);
    }
  }
}
