/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
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
        console.log(JSON.stringify(genAst, null, 2));
        const genQuery = generator.generate(genAst);
        console.log(genQuery);
        const ast = parser.parse(genQuery);
        const algebra = LibUtil.objectify(translate(ast, {
          quads: name.endsWith('-quads'),
        }));
        expect(canon.canonicalizeQuery(algebra, false)).toEqual(canon.canonicalizeQuery(expected, false));
      });
    }
  }

  describe('sparqlAlgebraTests', () => {
    const subfolders = fs.readdirSync(rootJson);
    for (const subfolder of subfolders) {
      testPath(subfolder, subfolder);
    }
  });

  describe('static paths', () => {
    for (const { name, statics } of positiveTest('sparql-1-1', x => ![
      // 2x Sequence path introduces new variable that is then scoped in projection
      'sequence-paths-in-anonymous-node',
      'sparql-9-3c',
    ].includes(x))) {
      it(`can algebra circle ${name}`, async({ expect }) => {
        const { query } = await statics();
        const path = parser.parse(query);
        // Console.log(JSON.stringify(path, null, 2));
        const algebra = LibUtil.objectify(translate(path, { quads: true }));
        console.log(JSON.stringify(algebra, null, 2));
        const pathFromAlg = toSparql(algebra);
        console.log(JSON.stringify(pathFromAlg, null, 2));
        const queryGen = generator.generate(pathFromAlg);
        console.log(queryGen);
        const parsedGen = parser.parse(queryGen);
        const astFromGen = LibUtil.objectify(translate(parsedGen, { quads: true }));
        expect(canon.canonicalizeQuery(astFromGen, false)).toEqual(canon.canonicalizeQuery(algebra, false));
      });
    }
  });
});
