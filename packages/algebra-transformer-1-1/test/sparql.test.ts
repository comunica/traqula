/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, it } from 'vitest';
import { translate, toSparql } from '../lib/index';
import LibUtil from '../lib/util';
import Util from './util';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('sparql output', () => {
  const rootJson = path.join(__dirname, 'algebra');
  const canon = Util.getCanonicalizerInstance();
  const parser = new Parser();

  function testPath(fileName: string, testName: string): void {
    const jsonName = path.join(rootJson, fileName);
    if (fs.lstatSync(jsonName).isDirectory()) {
      for (const sub of fs.readdirSync(jsonName)) {
        testPath(path.join(fileName, sub), `${testName}/${sub}`);
      }
    } else if (fileName.endsWith('.json')) {
      const name = testName.replace(/\.json$/u, '');
      it (name, ({ expect }) => {
        const expected = JSON.parse(fs.readFileSync(jsonName, 'utf8'));
        const query = toSparql(expected, { sparqlStar: testName.includes('sparqlstar') });
        const ast = parser.parse(query);
        const algebra = LibUtil.objectify(translate(ast, {
          quads: name.endsWith('(quads)'),
        }));
        expect(canon.canonicalizeQuery(algebra, false)).toEqual(canon.canonicalizeQuery(expected, false));
      });
    }
  }

  // Dawg/sparql
  const subfolders = fs.readdirSync(rootJson);
  for (const subfolder of subfolders) {
    testPath(subfolder, subfolder);
  }
});
