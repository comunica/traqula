
import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {translate} from '../index';
import Util from './util';

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL Parser', () =>
{
    let rootSparql = 'test2/sparql';
    let rootJson = 'test2/algebra';
    // dawg/sparql
    let subfolders = fs.readdirSync(rootSparql);

    // TODO: support different folder structures
    for (let subfolder of subfolders)
    {
        // aggregates, bind, etc.
        let types = fs.readdirSync(path.join(rootSparql, subfolder));
        for (let type of types)
        {
            describe(subfolder + '/' + type, () =>
            {
                let queries = fs.readdirSync(path.join(rootSparql, subfolder, type));
                for (let queryName of queries)
                {
                    it(queryName, () => {
                        let query = fs.readFileSync(path.join(rootSparql, subfolder, type, queryName), 'utf8');
                        let name = queryName.replace(/\.sparql$/, '');
                        let jsonName = name + '.json';
                        let expected = JSON.parse(fs.readFileSync(path.join(rootJson, subfolder, type, jsonName), 'utf8'));
                        let algebra = Util.objectify(translate(query, { quads: name.endsWith('(quads)') }));
                        expect(algebra).to.deep.equal(expected);
                    })
                }
            });
        }
    }
});