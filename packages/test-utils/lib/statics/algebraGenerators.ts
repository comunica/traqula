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

export function sparqlAlgebraTests(blankToVariable: boolean, getSPARQL: true):
Generator<algebraTestGen & { sparql: string }>;
export function sparqlAlgebraTests(blankToVariable: boolean, getSPARQL: boolean): Generator<algebraTestGen>;
export function* sparqlAlgebraTests(blankToVariable: boolean, getSPARQL: boolean): Generator<algebraTestGen> {
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
    yield* subGen(subfolder);
  }
}
