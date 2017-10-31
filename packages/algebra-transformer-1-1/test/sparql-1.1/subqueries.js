
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 subqueries', () => {
    it('sq01 - Subquery within graph pattern', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        select ?x ?p where {
                            graph ?g {
                                {select * where {?x ?p ?y}}
                            }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.GRAPH, [ '?g', AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?p', '?y') ]), [ '?x', '?p', '?y' ] ]) ]), [ '?x', '?p' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('sq06 - Subquery', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        select ?x
                        where {
                            {select * where {?x ?p ?y}}
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.PROJECT, [ AE(A.BGP, [ T('?x', '?p', '?y') ]), [ '?x', '?p', '?y' ] ]), [ '?x' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('sq07 - Subquery with from', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        select ?x
                        where {
                            {select * where {graph ?g {?x ?p ?y}}}
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.PROJECT, [ AE(A.GRAPH, [ '?g', AE(A.BGP, [ T('?x', '?p', '?y') ]) ]), [ '?x', '?p', '?y', '?g' ] ]), [ '?x' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('sq08 - Subquery with aggregate', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        select ?x ?max where {
                            {select (max(?y) as ?max) where {?x ex:p ?y} }
                            ?x ex:p ?max
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.PROJECT, [
                            AE(A.EXTEND, [
                                AE(A.GROUP, [
                                    [],
                                    [ AE(A.AGGREGATE, ['max', '?y', '?var0']) ],
                                    AE(A.BGP, [ T('?x', 'http://www.example.org/schema#p', '?y') ]) ]),
                                '?max',
                                '?var0' ]),
                            [ '?max' ] ]),
                        AE(A.BGP, [ T('?x', 'http://www.example.org/schema#p', '?max') ]) ]),
                    [ '?x', '?max' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('sq09 - Nested Subqueries', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        select * where {
                            {select * where {
                                {select ?x where {?x ex:q ?t}}
                            }}
                            ?x ex:p ?y
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.PROJECT, [
                            AE(A.PROJECT, [
                                AE(A.BGP, [ T('?x', 'http://www.example.org/schema#q', '?t') ]),
                                [ '?x' ] ]),
                            [ '?x' ] ]),
                        AE(A.BGP, [ T('?x', 'http://www.example.org/schema#p', '?y') ]) ]),
                    [ '?x', '?y' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('sq11 - Subquery limit per resource', () => {
        let sparql = `PREFIX : <http://www.example.org>
                        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                        SELECT ?L
                        WHERE {
                            ?O :hasItem [ rdfs:label ?L ] .
                            {
                                SELECT DISTINCT ?O
                                WHERE { ?O a :Order }
                                ORDER BY ?O
                                LIMIT 2
                            }
                        } ORDER BY ?L`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.ORDER_BY, [
                        AE(A.JOIN, [
                            AE(A.BGP, [ T('?O', 'http://www.example.orghasItem', '_:b0'), T('_:b0', 'http://www.w3.org/2000/01/rdf-schema#label', '?L') ]),
                            AE(A.SLICE, [
                                0,
                                2,
                                AE(A.DISTINCT, [ AE(A.PROJECT, [
                                    AE(A.ORDER_BY, [
                                        AE(A.BGP, [ T('?O', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.example.orgOrder') ]),
                                        [ '?O' ] ]),
                                    [ '?O' ] ]) ]) ]) ]),
                        [ '?L' ] ]),
                    [ '?L' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
});