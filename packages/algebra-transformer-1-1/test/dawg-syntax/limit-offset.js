
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

describe('DAWG-syntax-limit_offset', () => {
    it('syntax-limit-offset-01', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          { ?s ?p ?o }
                          ORDER BY ?o
                          LIMIT 5`;
        let algebra = translate(sparql);
        let expected =
                AE(A.SLICE, [ 0, 5, AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ '?o' ] ]), ['?s', '?p', '?o']])]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-limit-offset-02', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          { ?s ?p ?o }
                          ORDER BY ?o
                          LIMIT 5
                          OFFSET 3`;
        let algebra = translate(sparql);
        let expected =
                AE(A.SLICE, [ 3, 5, AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ '?o' ] ]), ['?s', '?p', '?o']])]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-limit-offset-03', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          { ?s ?p ?o }
                          ORDER BY ?o
                          OFFSET 3
                          LIMIT 5`;
        let algebra = translate(sparql);
        let expected =
                AE(A.SLICE, [ 3, 5, AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ '?o' ] ]), ['?s', '?p', '?o']])]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-limit-offset-04', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          { ?s ?p ?o }
                          ORDER BY ?o
                          OFFSET 3`;
        let algebra = translate(sparql);
        let expected =
                AE(A.SLICE, [ 3, -1, AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ '?o' ] ]), ['?s', '?p', '?o']])]);
        Util.compareAlgebras(expected, algebra);
    });
});