/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { algebraUtils } from '@traqula/algebra-transformations-1-1';
import { Parser } from '@traqula/parser-sparql-1-2';
import { type AlgebraTestSuite, sparqlQueries } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { toAlgebra } from '../lib/index.js';

// WARNING: use this script with caution!
// After running this script, manual inspection of the output is needed to make sure that conversion happened correctly.
const parser = new Parser();
const rootDir = path.join(__dirname, '..', '..', '..', 'packages', 'test-utils', 'lib', 'statics', 'algebra');
const rootJson = path.join(rootDir, 'algebra');
const rootJsonBlankToVariable = path.join(rootDir, 'algebra-blank-to-var');

const suites: AlgebraTestSuite[] = [ 'sparql12' ];

describe('algebra 1.2 test generate', () => {
  for (const suite of suites) {
    describe(suite, () => {
      for (const { query, name } of sparqlQueries(suite)) {
        for (const blankToVariable of [ false, true ]) {
          it(`${name} - blankToVar: ${blankToVariable}`, ({ expect }) => {
            expect(() => {
              const ast = parser.parse(query);
              const algebra = algebraUtils.objectify(toAlgebra(ast, {
                quads: name.endsWith('-quads'),
                blankToVariable,
              }));
              const algebraFileName = `${name}.json`;
              let newPath = blankToVariable ? rootJsonBlankToVariable : rootJson;
              for (const piece of name.split(path.sep).slice(0, -1)) {
                newPath = path.join(newPath, piece);
                if (!fs.existsSync(newPath)) {
                  fs.mkdirSync(newPath);
                }
              }

              fs.writeFileSync(
                path.join(blankToVariable ? rootJsonBlankToVariable : rootJson, algebraFileName),
                JSON.stringify(algebra, null, 2),
              );
            }).not.toThrow();
          });
        }
      }
    });
  }
});
