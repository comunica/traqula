
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 tests', () => {
    it('AVG', () => {
        let sparql = `PREFIX : <http://www.example.org/>
                      SELECT (AVG(?o) AS ?avg)
                      WHERE {
                      ?s :dec ?o
                      }`;
        let algebra = translate(sparql);
        console.log(algebra + '');
        // TODO: different Jena ordering
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.GROUP, [
                            [],
                            [ AE('?v', [ AE('avg', [ '?o' ]) ]) ],
                            AE(A.BGP, [ T('?s', 'http://www.example.org/dec', '?o') ])
                        ]),
                        '?avg',
                        '?v',
                    ]),
                    [ '?avg' ]]);
        Util.compareAlgebras(expected, algebra);
    });
});
