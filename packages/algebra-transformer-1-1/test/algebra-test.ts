
import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {translate} from '../index';
import Util from './util';

const rootSparql = 'test/sparql';
const rootJson = 'test/algebra';
const rootJsonBlankToVariable = 'test/algebra-blank-to-var';
const canon = Util.getCanonicalizerInstance();

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('Algebra output', () =>
{
    // dawg/sparql
    let subfolders = fs.readdirSync(rootSparql);

    for (let subfolder of subfolders) {
      testPath(rootJson, subfolder, subfolder, false);
      testPath(rootJsonBlankToVariable, subfolder, subfolder, true);
    }
});

function testPath(root: string, fileName: string, testName: string, blankToVariable: boolean): void
{
    let sparqlName = path.join(rootSparql, fileName);
    if (fs.lstatSync(sparqlName).isDirectory())
    {
        for (let sub of fs.readdirSync(sparqlName))
            testPath(root, path.join(fileName, sub), testName + '/' + sub, blankToVariable);
    } else {
        let name = root + '/' + testName.replace(/\.sparql$/, '');
        it (name + (blankToVariable ? ' (no blanks)' : ''), () =>
        {
            let query = fs.readFileSync(sparqlName, 'utf8');
            let algebra = Util.objectify(translate(query, { quads: name.endsWith('(quads)'), blankToVariable }));
            let expected = JSON.parse(fs.readFileSync(path.join(root, fileName.replace(/\.sparql$/, '.json')), 'utf8'));
            expect(canon.canonicalizeQuery(algebra, blankToVariable)).to.deep.equal(canon.canonicalizeQuery(expected, blankToVariable));
        });
    }
}
