
const _ = require('lodash');
const assert = require('assert');
const SparqlParser = require('sparqljs').Parser;
const algebra = require('../lib/sparqlAlgebra');
const Util = require('./Util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2001/sw/DataAccess/tests/r2#syntax-basic-01
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
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-basic-02.rq', () => {
            let sparql = `SELECT * {}`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, []), [] ]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-basic-03.rq', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          WHERE { ?x ?y ?z }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z') ]), [ '?x', '?y', '?z' ]]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-basic-04.rq', () => {
            let sparql = `SELECT *
                          WHERE { ?x ?y ?z . }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z') ]), [ '?x', '?y', '?z' ]]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-basic-05.rq', () => {
            let sparql = `SELECT *
                          WHERE { ?x ?y ?z . ?a ?b ?c }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z'), T('?a', '?b', '?c') ]), [ '?x', '?y', '?z', '?a', '?b', '?c' ]]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-basic-06.rq', () => {
            let sparql = `SELECT *
                          WHERE { ?x ?y ?z . ?a ?b ?c . }`;
            let algebra = translate(sparql);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?y', '?z'), T('?a', '?b', '?c') ]), [ '?x', '?y', '?z', '?a', '?b', '?c' ]]);
            assert.deepEqual(algebra, expected);
        });
    });
    
    describe('bnodes', () => {
        it('syntax-bnodes-01', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [:p :q ] }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [  T(parsed.where[0].triples[0].subject, 'http://example.org/ns#p', 'http://example.org/ns#q') ]), []]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-bnodes-02', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [] :p :q }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [  T(parsed.where[0].triples[0].subject, 'http://example.org/ns#p', 'http://example.org/ns#q') ]), []]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-bnodes-03', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [ ?x ?y ] :p [ ?pa ?b ] }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.BGP, parsed.where[0].triples), Util.extractVariables(parsed.where[0].triples)]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-bnodes-04', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [ :p :q ; ] }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [  T(parsed.where[0].triples[0].subject, 'http://example.org/ns#p', 'http://example.org/ns#q') ]), []]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-bnodes-05', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { _:a :p1 :q1 .
                                           _:a :p2 :q2 .
                                         }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('_:a', 'http://example.org/ns#p1', 'http://example.org/ns#q1'), T('_:a', 'http://example.org/ns#p2', 'http://example.org/ns#q2') ]), []]);
            assert.deepEqual(algebra, expected);
        });
    });
    
    describe('expr', () => {
        it('syntax-expr-01', () => {
            let sparql = `SELECT *
                          WHERE { ?s ?p ?o . FILTER (?o) }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.FILTER, [ '?o', AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-expr-02', () => {
            let sparql = `SELECT *
                          WHERE { ?s ?p ?o . FILTER REGEX(?o, "foo") }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.FILTER, [ AE('regex', [ '?o', '"foo"']), AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-expr-03', () => {
            let sparql = `SELECT *
                          WHERE { ?s ?p ?o . FILTER REGEX(?o, "foo", "i") }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.FILTER, [ AE('regex', [ '?o', '"foo"', '"i"']), AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-expr-04', () => {
            let sparql = `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                          SELECT *
                          WHERE { ?s ?p ?o . FILTER xsd:integer(?o) }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.FILTER, [ AE('http://www.w3.org/2001/XMLSchema#integer', [ '?o' ]), AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
            assert.deepEqual(algebra, expected);
        });
    
        it('syntax-expr-05', () => {
            let sparql = `PREFIX : <http://example.org/ns#>
                          PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                          SELECT * WHERE { ?s ?p ?o . FILTER :myFunc(?s,?o) }`;
            let parsed = (new SparqlParser).parse(sparql);
            let algebra = translate(parsed);
            let expected = AE(A.PROJECT, [ AE(A.FILTER, [ AE('http://example.org/ns#myFunc', [ '?s', '?o' ]), AE(A.BGP, [ T('?s', '?p', '?o') ]) ]), [ '?s', '?p', '?o']]);
            assert.deepEqual(algebra, expected);
        });
    });
});