
const _ = require('lodash');
const assert = require('assert');
const algebra = require('../lib/sparqlAlgebra');
const Util = require('./Util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
// note that in the case of blank nodes the triples get copied from the parsed sparql object to have identical blank node names
describe('DAWG Syntax tests', () =>
{
    describe('basic', () => {
        // TODO: different from jena. Based on 18.2.2.6: GroupGraphPattern it should be a bgp representing the empty set
        // TODO: depending on interpretation from 18.2.2.5 and 18.2.2.6 it could be an empty bgp or undefined
        it('syntax-basic-01.rq', () => {
            let sparql = `SELECT *
                          WHERE { }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, []), [] ]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-basic-02.rq', () => {
            let sparql = `SELECT * {}`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, []), [] ]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-basic-03.rq', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          WHERE { ?x ?y ?z }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z') ]), [ '?x', '?y', '?z' ]]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-basic-04.rq', () => {
            let sparql = `SELECT *
                          WHERE { ?x ?y ?z . }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z') ]), [ '?x', '?y', '?z' ]]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-basic-05.rq', () => {
            let sparql = `SELECT *
                          WHERE { ?x ?y ?z . ?a ?b ?c }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z'), T('?a', '?b', '?c') ]), [ '?x', '?y', '?z', '?a', '?b', '?c' ]]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-basic-06.rq', () => {
            let sparql = `SELECT *
                          WHERE { ?x ?y ?z . ?a ?b ?c . }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z'), T('?a', '?b', '?c') ]), [ '?x', '?y', '?z', '?a', '?b', '?c' ]]);
            Util.compareAlgebras(expected, algebra);
        });
    });
    
    describe('bnodes', () => {
        it('syntax-bnodes-01', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [:p :q ] }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('_:b0', 'http://example.org/ns#p', 'http://example.org/ns#q') ]), []]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-bnodes-02', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [] :p :q }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [  T('_:b0', 'http://example.org/ns#p', 'http://example.org/ns#q') ]), []]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-bnodes-03', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [ ?x ?y ] :p [ ?pa ?b ] }`;
            let algebra = translate(sparql);
            let expected =
                    AE(A.PROJECT, [ AE(A.BGP, [
                        T('_:b0', '?x', '?y'),
                        T('_:b1', '?pa', '?b'),
                        T('_:b0', 'http://example.org/ns#p', '_:b1')
                    ]), [ '?x', '?y', '?pa', '?b' ]]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-bnodes-04', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [ :p :q ; ] }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [  T('_:b0', 'http://example.org/ns#p', 'http://example.org/ns#q') ]), []]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-bnodes-05', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { _:a :p1 :q1 .
                                           _:a :p2 :q2 .
                                         }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('_:a', 'http://example.org/ns#p1', 'http://example.org/ns#q1'), T('_:a', 'http://example.org/ns#p2', 'http://example.org/ns#q2') ]), []]);
            Util.compareAlgebras(expected, algebra);
        });
    });
    
    describe('expr', () => {
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
    
    describe('forms', () => {
        it('syntax-forms-01', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { ( [ ?x ?y ] ) :p ( [ ?pa ?b ] 57 ) }`;
            let algebra = translate(sparql);
            let expected =
                    AE(A.PROJECT, [ AE(A.BGP, [
                        T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'),
                        T('_:b1', '?x', '?y'),
                        T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                        
                        T('_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b3'),
                        T('_:b3', '?pa', '?b'),
                        T('_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b4'),
                        T('_:b4', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"57"^^http://www.w3.org/2001/XMLSchema#integer'),
                        T('_:b4', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                        
                        T('_:b0', 'http://example.org/ns#p', '_:b2')
                    ]), [ '?x', '?y', '?pa', '?b' ]]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-forms-02', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { ( [] [] ) }`;
            let algebra = translate(sparql);
            let expected =
                    AE(A.PROJECT, [ AE(A.BGP, [
                        T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'),
                        T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2'),
                        T('_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b3'),
                        T('_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                    ]), []]);
            Util.compareAlgebras(expected, algebra);
        });
    });
    
    describe('limit-offset', () => {
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
    
    describe('lists', () => {
        it('syntax-lists-01', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          WHERE { ( ?x ) :p ?z }`;
            let algebra = translate(sparql);
            let expected =
                    AE(A.PROJECT, [ AE(A.BGP, [
                        T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '?x'),
                        T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                        T('_:b', 'http://example.org/ns#p', '?z'),
                    ]), ['?x', '?z'] ]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-lists-02', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          WHERE { ?x :p ( ?z ) }`;
            let algebra = translate(sparql);
            let expected =
                    AE(A.PROJECT, [ AE(A.BGP, [
                        T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '?z'),
                        T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                        T('?x', 'http://example.org/ns#p', '_:b'),
                    ]), ['?x', '?z'] ]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-lists-03', () => {
            let sparql = `SELECT * WHERE { ( ?z ) }`;
            let algebra = translate(sparql);
            let expected =
                    AE(A.PROJECT, [ AE(A.BGP, [
                        T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '?z'),
                        T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                    ]), ['?z'] ]);
            Util.compareAlgebras(expected, algebra);
        });
    
        it('syntax-lists-04', () => {
            let sparql = `SELECT * WHERE { ( ( ?z ) ) }`;
            let algebra = translate(sparql);
            let expected =
                    AE(A.PROJECT, [ AE(A.BGP, [
                        T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'),
                        T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                        T('_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '?z'),
                        T('_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                    ]), ['?z'] ]);
            Util.compareAlgebras(expected, algebra);
        });
    
        // () is shorthand for 'nil'
        it('syntax-lists-05', () => {
            let sparql = `SELECT * WHERE { ( ( ) ) }`;
            let algebra = translate(sparql);
            let expected =
                    AE(A.PROJECT, [ AE(A.BGP, [
                        T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                        T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')
                    ]), [] ]);
            Util.compareAlgebras(expected, algebra);
        });
    });
});