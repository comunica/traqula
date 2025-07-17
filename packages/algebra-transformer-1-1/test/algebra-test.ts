/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { translate } from '../index';
import LibUtil from '../lib/util';
import Util from './util';

const rootSparql = 'test/sparql';
const rootJson = 'test/algebra';
const rootJsonBlankToVariable = 'test/algebra-blank-to-var';
const canon = Util.getCanonicalizerInstance();

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('Algebra output', () => {
  // Dawg/sparql
  const subfolders = fs.readdirSync(rootSparql);

  for (const subfolder of subfolders) {
    testPath(rootJson, subfolder, subfolder, false);
    testPath(rootJsonBlankToVariable, subfolder, subfolder, true);
  }
});

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
    it (`${name}${blankToVariable ? ' (no blanks)' : ''}`, () => {
      const query = fs.readFileSync(sparqlName, 'utf8');
      const algebra = LibUtil.objectify(
        translate(query, {
          quads: name.endsWith('(quads)'),
          blankToVariable,
          sparqlStar: testName.includes('sparqlstar'),
        }),
      );
      const expected = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      expect(canon.canonicalizeQuery(algebra, blankToVariable))
        .toEqual(canon.canonicalizeQuery(expected, blankToVariable));
    });
  }
}
