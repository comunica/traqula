/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Generator } from '@traqula/generator-sparql-1-1';
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
  const generator = new Generator();

  function testPath(fileName: string, testName: string): void {
    const jsonName = path.join(rootJson, fileName);
    if (fs.lstatSync(jsonName).isDirectory()) {
      // Recursion
      for (const sub of fs.readdirSync(jsonName)) {
        testPath(path.join(fileName, sub), `${testName}/${sub}`);
      }
    } else if (fileName.endsWith('.json')) {
      const name = testName.replace(/\.json$/u, '');
      it (name, ({ expect }) => {
        const expected = JSON.parse(fs.readFileSync(jsonName, 'utf8'));
        const genAst = toSparql(expected);
        // Console.log(JSON.stringify(genAst, null, 2));
        const genQuery = generator.generate(genAst);
        // Console.log(genQuery);
        const ast = parser.parse(genQuery);
        const algebra = LibUtil.objectify(translate(ast, {
          quads: name.endsWith('-quads'),
        }));
        expect(canon.canonicalizeQuery(algebra, false)).toEqual(canon.canonicalizeQuery(expected, false));
      });
    }
  }

  const subfolders = fs.readdirSync(rootJson);
  for (const subfolder of subfolders) {
    testPath(subfolder, subfolder);
  }
});
