/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'vitest';
import { toSparql } from '../lib';
import type { Operation, Project } from '../lib/algebra';
import Factory from '../lib/factory';
import translate from '../lib/sparqlAlgebra';
import Util from '../lib/util';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('util functions', () => {
  const rootJson = path.join(__dirname, 'algebra');
  const factory = new Factory();

  function testPath(fileName: string, testName: string): void {
    const jsonName = path.join(rootJson, fileName);
    if (fs.lstatSync(jsonName).isDirectory()) {
      for (const sub of fs.readdirSync(jsonName)) {
        testPath(path.join(fileName, sub), `${testName}/${sub}`);
      }
    } else if (fileName.endsWith('.json')) {
      const name = testName.replace(/\.json$/u, '');
      it (name, ({ expect }) => {
        const expected: any = JSON.parse(fs.readFileSync(jsonName, 'utf8'));
        const clone: Operation = Util.mapOperation(expected, {});
        if (clone.type === 'project') {
          // Const scope = Util.inScopeVariables(clone.input);
          const project = <Project> translate(toSparql(factory.createProject(clone.input, [])));
          for (const _v of project.variables.map(v => v.value)) {
            // Expect(scope.map(v => v.value)).toContain(v);
          }
        }
        expect(Util.objectify(clone)).toEqual(expected);
      });
    }
  }

  const subfolders = fs.readdirSync(rootJson);

  for (const subfolder of subfolders) {
    testPath(subfolder, subfolder);
  }
});
