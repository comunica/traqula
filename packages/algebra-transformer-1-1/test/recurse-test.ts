
import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import TestUtil from './util';
import Util from '../lib/util';
import {Operation, Project} from "../lib/algebra";
import Factory from "../lib/factory";
import {toSparqlJs} from "../lib/sparql";
import translate from "../lib/sparqlAlgebra";

const rootJson = 'test/algebra';
const factory = new Factory();

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('Util funtions', () =>
{
    let subfolders = fs.readdirSync(rootJson);

    for (let subfolder of subfolders)
        testPath(subfolder, subfolder);
});

function testPath(fileName: string, testName: string): void
{
    let jsonName = path.join(rootJson, fileName);
    if (fs.lstatSync(jsonName).isDirectory())
    {
        for (let sub of fs.readdirSync(jsonName))
            testPath(path.join(fileName, sub), testName + '/' + sub);
    } else {
        let name = testName.replace(/\.json$/, '');
        it (name, () =>
        {
            let expected: any = JSON.parse(fs.readFileSync(jsonName, 'utf8'));
            let clone: Operation = Util.mapOperation(expected, {});
            if (clone.type === 'project')
            {
                let input = (<Project> clone).input;
                let scope = Util.inScopeVariables(input);
                let project = <Project> translate(toSparqlJs(factory.createProject(input, [])));
                for (let v of project.variables.map(v => v.value))
                    expect(scope.map(v => v.value)).to.contain(v);
            }
            expect(TestUtil.objectify(clone)).to.deep.equal(expected);
        });
    }
}