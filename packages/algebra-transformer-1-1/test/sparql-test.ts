/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { translate, toSparql } from '../index';
import LibUtil from '../lib/util';
import Util from './util';

const canon = Util.getCanonicalizerInstance();

const rootJson = 'test/algebra';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL output', () => {
  // Dawg/sparql
  const subfolders = fs.readdirSync(rootJson);

  for (const subfolder of subfolders) {
    testPath(subfolder, subfolder);
  }
});

function testPath(fileName: string, testName: string): void {
  const jsonName = path.join(rootJson, fileName);
  if (fs.lstatSync(jsonName).isDirectory()) {
    for (const sub of fs.readdirSync(jsonName)) {
      testPath(path.join(fileName, sub), `${testName}/${sub}`);
    }
  } else if (fileName.endsWith('.json')) {
    const name = testName.replace(/\.json$/u, '');
    it (name, () => {
      const expected = JSON.parse(fs.readFileSync(jsonName, 'utf8'));
      const query = toSparql(expected, { sparqlStar: testName.includes('sparqlstar') });
      const algebra = LibUtil.objectify(translate(query, {
        quads: name.endsWith('(quads)'),
        sparqlStar: testName.includes('sparqlstar'),
      }));
      expect(canon.canonicalizeQuery(algebra, false)).toEqual(canon.canonicalizeQuery(expected, false));
    });
  }
}
