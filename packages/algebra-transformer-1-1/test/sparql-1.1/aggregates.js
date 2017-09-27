
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

    it('AVG with GROUP BY', () => {
        let sparql = `PREFIX : <http://www.example.org/>
                      SELECT ?s (AVG(?o) AS ?avg)
                      WHERE {
                            ?s ?p ?o
                      }
                      GROUP BY ?s
                      HAVING (AVG(?o) <= 2.0)`;
        let algebra = translate(sparql);
        console.log(algebra + '');
        // TODO: different filter/extend ordering than Jena
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.FILTER, [
                            AE('<=', [ '?v', '"2.0"^^http://www.w3.org/2001/XMLSchema#decimal' ]),
                            AE(A.GROUP, [
                                [ '?s' ],
                                [ AE('?v', [ AE('avg', [ '?o' ]) ]) ],
                                AE(A.BGP, [ T('?s', '?p', '?o') ])
                            ]),
                        ]),
                        '?avg',
                        '?v',
                    ]),
                    [ '?s', '?avg' ]]);
        Util.compareAlgebras(expected, algebra);
    });
});
