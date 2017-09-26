
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

describe('DAWG-syntax-order', () => {
    it('syntax-order-01', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * { ?s ?p ?o }
                          ORDER BY ?o`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ '?o' ] ]), ['?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-order-02', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * { ?s ?p ?o }
                          ORDER BY (?o+5)`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ AE('+', ['?o', '"5"^^http://www.w3.org/2001/XMLSchema#integer']) ] ]), ['?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-order-03', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * { ?s ?p ?o }
                          ORDER BY ASC(?o)`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ '?o' ] ]), ['?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-order-04', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * { ?s ?p ?o }
                          ORDER BY DESC(?o)`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ AE(A.DESC, ['?o']) ] ]), ['?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-order-05', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * { ?s ?p ?o }
                          ORDER BY DESC(:func(?s, ?o))`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ AE(A.DESC, [ AE('http://example.org/ns#func', [ '?s', '?o' ]) ]) ] ]), ['?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-order-06', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * { ?s ?p ?o }
                          ORDER BY
                            DESC(?o+57) :func2(?o) ASC(?s)`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [
                    AE(A.DESC, [ AE('+', [ '?o', '"57"^^http://www.w3.org/2001/XMLSchema#integer' ]) ]),
                    AE('http://example.org/ns#func2', [ '?o' ]),
                    '?s',
                ] ]), ['?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-order-07', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          { ?s ?p ?o }
                          ORDER BY str(?o)`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ AE('str', [ '?o' ]) ] ]), ['?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
});