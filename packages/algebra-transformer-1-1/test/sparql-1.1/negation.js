
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 negation', () => {
    it('Subtraction with MINUS from a fully bound minuend', () => {
        let sparql = `prefix : <http://example/>
                        select ?a ?b ?c {
                            ?a :p1 ?b; :p2 ?c
                            MINUS {
                                ?d a :Sub
                                OPTIONAL { ?d :q1 ?b }
                                OPTIONAL { ?d :q2 ?c }
                            }
                        }
                        order by ?a`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.ORDER_BY, [
                        AE(A.MINUS, [
                            AE(A.BGP, [ T('?a', 'http://example/p1', '?b'), T('?a', 'http://example/p2', '?c') ]),
                            AE(A.LEFT_JOIN, [
                                AE(A.LEFT_JOIN, [
                                    AE(A.BGP, [ T('?d', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example/Sub') ]),
                                    AE(A.BGP, [ T('?d', 'http://example/q1', '?b') ]),
                                    true
                                ]),
                                AE(A.BGP, [ T('?d', 'http://example/q2', '?c') ]),
                                true
                            ])
                        ]),
                        [ '?a' ]
                    ]),
                    [ '?a', '?b', '?c' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Subtraction with MINUS from a partially bound minuend', () => {
        let sparql = `prefix : <http://example/>
                        select ?a ?b ?c {
                            ?a a :Min
                            OPTIONAL { ?a :p1 ?b }
                            OPTIONAL { ?a :p2 ?c }
                            MINUS {
                                ?d a :Sub
                                OPTIONAL { ?d :q1 ?b }
                                OPTIONAL { ?d :q2 ?c }
                            }
                        }
                        order by ?a`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.ORDER_BY, [
                        AE(A.MINUS, [
                            AE(A.LEFT_JOIN, [
                                AE(A.LEFT_JOIN, [
                                    AE(A.BGP, [ T('?a', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example/Min') ]),
                                    AE(A.BGP, [ T('?a', 'http://example/p1', '?b') ]),
                                    true
                                ]),
                                AE(A.BGP, [ T('?a', 'http://example/p2', '?c') ]),
                                true
                            ]),
                            AE(A.LEFT_JOIN, [
                                AE(A.LEFT_JOIN, [
                                    AE(A.BGP, [ T('?d', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example/Sub') ]),
                                    AE(A.BGP, [ T('?d', 'http://example/q1', '?b') ]),
                                    true
                                ]),
                                AE(A.BGP, [ T('?d', 'http://example/q2', '?c') ]),
                                true
                            ])
                        ]),
                        [ '?a' ] ]),
                    [ '?a', '?b', '?c' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Calculate which sets have the same elements', () => {
        let sparql = `PREFIX : <http://example/>
                        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                        SELECT DISTINCT ?s1 ?s2
                        WHERE
                        {
                            ?s2 rdf:type :Set .
                            ?s1 rdf:type :Set .
                            FILTER(str(?s1) < str(?s2))
                            MINUS
                            {
                                ?s1 rdf:type :Set .
                                ?s2 rdf:type :Set .
                                ?s1 :member ?x .
                                FILTER NOT EXISTS { ?s2 :member ?x . }
                            }
                            MINUS
                            {
                                ?s1 rdf:type :Set .
                                ?s2 rdf:type :Set .
                                ?s2 :member ?x .
                                FILTER NOT EXISTS { ?s1 :member ?x . }
                            }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.DISTINCT, [
                    AE(A.PROJECT, [
                        AE(A.FILTER, [
                            AE('<', [ AE('str', [ '?s1' ]), AE('str', [ '?s2' ]) ]),
                            AE(A.MINUS, [
                                AE(A.MINUS, [
                                    AE(A.BGP, [ T('?s2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example/Set'),
                                                T('?s1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example/Set') ]),
                                    AE(A.FILTER, [ AE('notexists', [ AE(A.BGP, [ T('?s2', 'http://example/member', '?x') ]) ]),
                                                   AE(A.BGP, [ T('?s1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example/Set'),
                                                               T('?s2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example/Set'),
                                                               T('?s1', 'http://example/member', '?x') ]) ]) ]),
                                AE(A.FILTER, [ AE('notexists', [ AE(A.BGP, [ T('?s1', 'http://example/member', '?x') ]) ]),
                                               AE(A.BGP, [ T('?s1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example/Set'),
                                                           T('?s2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example/Set'),
                                                           T('?s2', 'http://example/member', '?x') ]) ]) ]) ]),
                        [ '?s1', '?s2' ] ]) ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Medical, temporal proximity by exclusion (NOT EXISTS)', () => {
        let sparql = `PREFIX ex: <http://www.w3.org/2009/sparql/docs/tests/data-sparql11/negation#>
                        PREFIX dc: <http://purl.org/dc/elements/1.1/>
                        # The closest pre-operative physical examination
                        SELECT ?exam ?date {
                            ?exam a ex:PhysicalExamination;
                            dc:date ?date;
                            ex:precedes ex:operation1 .
                            ?op a ex:SurgicalProcedure; dc:date ?opDT .
                            FILTER NOT EXISTS {
                                ?otherExam a ex:PhysicalExamination;
                                ex:follows ?exam;
                                ex:precedes ex:operation1
                            }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.FILTER, [
                        AE('notexists', [
                            AE(A.BGP, [ T('?otherExam', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/negation#PhysicalExamination'),
                                        T('?otherExam', 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/negation#follows', '?exam'),
                                        T('?otherExam', 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/negation#precedes', 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/negation#operation1') ]) ]),
                        AE(A.BGP, [ T('?exam', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/negation#PhysicalExamination'),
                                    T('?exam', 'http://purl.org/dc/elements/1.1/date', '?date'),
                                    T('?exam', 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/negation#precedes', 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/negation#operation1'),
                                    T('?op', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/negation#SurgicalProcedure'),
                                    T('?op', 'http://purl.org/dc/elements/1.1/date', '?opDT') ]) ]),
                    [ '?exam', '?date' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
});