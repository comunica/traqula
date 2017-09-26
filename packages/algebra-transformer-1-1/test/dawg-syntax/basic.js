
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
describe('DAWG-syntax-basic', () => {
    // TODO: different from jena. Based on 18.2.2.6: GroupGraphPattern it should be a bgp representing the empty set
    // TODO: depending on interpretation from 18.2.2.5 and 18.2.2.6 it could be an empty bgp or undefined
    it('syntax-basic-01', () => {
        let sparql = `SELECT *
                          WHERE { }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, []), [] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-basic-02', () => {
        let sparql = `SELECT * {}`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, []), [] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-basic-03', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          WHERE { ?x ?y ?z }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z') ]), [ '?x', '?y', '?z' ]]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-basic-04', () => {
        let sparql = `SELECT *
                          WHERE { ?x ?y ?z . }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z') ]), [ '?x', '?y', '?z' ]]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-basic-05', () => {
        let sparql = `SELECT *
                          WHERE { ?x ?y ?z . ?a ?b ?c }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z'), T('?a', '?b', '?c') ]), [ '?x', '?y', '?z', '?a', '?b', '?c' ]]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-basic-06', () => {
        let sparql = `SELECT *
                          WHERE { ?x ?y ?z . ?a ?b ?c . }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z'), T('?a', '?b', '?c') ]), [ '?x', '?y', '?z', '?a', '?b', '?c' ]]);
        Util.compareAlgebras(expected, algebra);
    });
});