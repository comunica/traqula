/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, it } from 'vitest';
import { translate } from '../lib/index';
import LibUtil from '../lib/util';
import Util from './util';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('algebra output', () => {
  const rootSparql = path.join(__dirname, 'sparql');
  const rootJson = path.join(__dirname, 'algebra');
  const rootJsonBlankToVariable = path.join(__dirname, 'algebra-blank-to-var');

  const canon = Util.getCanonicalizerInstance();
  const parser = new Parser();

  function testPath(fileName: string, testName: string, blankToVariable: boolean): void {
    const fullTestPath = path.join(rootSparql, fileName);
    const algebraRoot = blankToVariable ? rootJsonBlankToVariable : rootJson;

    if (fs.lstatSync(fullTestPath).isDirectory()) {
      // If it's, a dir, read files and recurse.
      for (const sub of fs.readdirSync(fullTestPath)) {
        testPath(path.join(fileName, sub), `${testName}/${sub}`, blankToVariable);
      }
    } else if (fileName.endsWith('.sparql')) {
      const name = testName.replace(/\.sparql$/u, '');
      const jsonPath = path.join(algebraRoot, fileName.replace(/\.sparql$/u, '.json'));
      // Not all tests need a blank version
      if (!fs.existsSync(jsonPath) && blankToVariable) {
        return;
      }
      it(`${name}${blankToVariable ? ' (no blanks)' : ''}`, ({ expect }) => {
        const query = fs.readFileSync(fullTestPath, 'utf8').replaceAll(/\r?\n/gu, '\n');
        const ast = parser.parse(query);
        const algebra = LibUtil.objectify(
          translate(ast, {
            quads: name.endsWith('-quads'),
            blankToVariable,
          }),
        );
        const expected = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        expect(canon.canonicalizeQuery(algebra, blankToVariable))
          .toEqual(canon.canonicalizeQuery(expected, blankToVariable));
      });
    }
  }

  const subfolders = fs.readdirSync(rootSparql);
  for (const subfolder of subfolders) {
    testPath(subfolder, subfolder, false);
    testPath(subfolder, subfolder, true);
  }
});
