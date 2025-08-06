/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, it } from 'vitest';
import { translate } from '../index';
import LibUtil from '../lib/util';
import Util from './util';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('algebra output', () => {
  const rootSparql = path.join(__dirname, 'sparql');
  const rootJson = path.join(__dirname, 'algebra');
  const rootJsonBlankToVariable = path.join(__dirname, 'algebra-blank-to-var');

  console.error(rootSparql);

  const canon = Util.getCanonicalizerInstance();
  const parser = new Parser();

  function testPath(root: string, fileName: string, testName: string, blankToVariable: boolean): void {
    const sparqlName = path.join(rootSparql, fileName);
    if (fs.lstatSync(sparqlName).isDirectory()) {
      for (const sub of fs.readdirSync(sparqlName)) {
        testPath(root, path.join(fileName, sub), `${testName}/${sub}`, blankToVariable);
      }
    } else if (fileName.endsWith('.sparql')) {
      const name = `${root}/${testName.replace(/\.sparql$/u, '')}`;
      const jsonPath = path.join(root, fileName.replace(/\.sparql$/u, '.json'));
      // Not all tests need a blank version
      if (!fs.existsSync(jsonPath) && blankToVariable) {
        return;
      }
      it (`${name.replace(rootJson, '')}${blankToVariable ? ' (no blanks)' : ''}`, ({ expect }) => {
        const query = fs.readFileSync(sparqlName, 'utf8');
        const ast = parser.parse(query);
        const algebra = LibUtil.objectify(
          translate(ast, {
            quads: name.endsWith('(quads)'),
            blankToVariable,
          }),
        );
        const expected = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        expect(canon.canonicalizeQuery(algebra, blankToVariable))
          .toEqual(canon.canonicalizeQuery(expected, blankToVariable));
      });
    }
  }

  // Dawg/sparql
  const subfolders = fs.readdirSync(rootSparql);

  for (const subfolder of subfolders) {
    testPath(rootJson, subfolder, subfolder, false);
    testPath(rootJsonBlankToVariable, subfolder, subfolder, true);
  }
});
