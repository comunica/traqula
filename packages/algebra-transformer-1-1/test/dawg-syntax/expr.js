
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

describe('DAWG-syntax-expr', () => {
    it('syntax-expr-01', () => {
        let sparql = `SELECT *
                          WHERE { ?s ?p ?o . FILTER (?o) }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.FILTER, [ '?o', AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-expr-02', () => {
        let sparql = `SELECT *
                          WHERE { ?s ?p ?o . FILTER REGEX(?o, "foo") }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.FILTER, [ AE('regex', [ '?o', '"foo"']), AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-expr-03', () => {
        let sparql = `SELECT *
                          WHERE { ?s ?p ?o . FILTER REGEX(?o, "foo", "i") }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.FILTER, [ AE('regex', [ '?o', '"foo"', '"i"']), AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-expr-04', () => {
        let sparql = `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                          SELECT *
                          WHERE { ?s ?p ?o . FILTER xsd:integer(?o) }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.FILTER, [ AE('http://www.w3.org/2001/XMLSchema#integer', [ '?o' ]), AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-expr-05', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                          SELECT * WHERE { ?s ?p ?o . FILTER :myFunc(?s,?o) }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.FILTER, [ AE('http://example.org/ns#myFunc', [ '?s', '?o' ]), AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
        Util.compareAlgebras(expected, algebra);
    });
});