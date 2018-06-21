
import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {translate} from '../index';
import Util from './util';

const rootSparql = 'test/sparql';
const rootJson = 'test/algebra';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL Parser', () =>
{
    // dawg/sparql
    let subfolders = fs.readdirSync(rootSparql);

    for (let subfolder of subfolders)
        testPath(subfolder, subfolder);
});

function testPath(fileName: string, testName: string): void
{
    let sparqlName = path.join(rootSparql, fileName);
    if (fs.lstatSync(sparqlName).isDirectory())
    {
        for (let sub of fs.readdirSync(sparqlName))
            testPath(path.join(fileName, sub), testName + '/' + sub);
    } else {
        let name = testName.replace(/\.sparql$/, '');
        it (name, () =>
        {
            let query = fs.readFileSync(sparqlName, 'utf8');
            let algebra = Util.objectify(translate(query, { quads: name.endsWith('(quads)') }));
            let expected = JSON.parse(fs.readFileSync(path.join(rootJson, fileName.replace(/\.sparql$/, '.json')), 'utf8'));
            expect(algebra).to.deep.equal(expected);
        });
    }
}