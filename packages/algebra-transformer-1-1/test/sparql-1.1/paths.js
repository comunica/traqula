
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// TODO: Jena uses 'sequence' instead of bgp for paths <-> 18.2.2.5
// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 paths', () => {
    it('(pp01) Simple path', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        select * where {
                            in:a ex:p1/ex:p2/ex:p3 ?x
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.BGP, [ T('http://www.example.org/instance#a', 'http://www.example.org/schema#p1', '?var1'),
                                T('?var1', 'http://www.example.org/schema#p2', '?var0'),
                                T('?var0', 'http://www.example.org/schema#p3', '?x') ]),
                    [ '?x' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp02) Star path', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        select * where {
                            in:a (ex:p1/ex:p2/ex:p3)* ?x
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.PATH, [
                        'http://www.example.org/instance#a',
                        AE(A.ZERO_OR_MORE_PATH, [
                            AE(A.SEQ, [
                                AE(A.SEQ, [ AE(A.LINK, [ 'http://www.example.org/schema#p1' ]),
                                            AE(A.LINK, [ 'http://www.example.org/schema#p2' ]) ]),
                                AE(A.LINK, [ 'http://www.example.org/schema#p3' ]) ]) ]),
                        '?x' ]),
                    [ '?x' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp06) Path with two graphs', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        select ?x where {
                            graph ?g {in:a ex:p1/ex:p2 ?x}
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.GRAPH, [
                        '?g',
                        AE(A.BGP, [ T('http://www.example.org/instance#a', 'http://www.example.org/schema#p1', '?var0'),
                                    T('?var0', 'http://www.example.org/schema#p2', '?x') ]) ]),
                    [ '?x' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp08) Reverse path', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        ask {
                            in:b ^ex:p in:a
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [ T('http://www.example.org/instance#a', 'http://www.example.org/schema#p', 'http://www.example.org/instance#b') ]), [  ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp09) Reverse sequence path', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        select * where {
                            in:c ^(ex:p1/ex:p2) ?x
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [ T('?x', 'http://www.example.org/schema#p1', '?var0'), T('?var0', 'http://www.example.org/schema#p2', 'http://www.example.org/instance#c') ]), [ '?x' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp10) Path with negation', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        select * where {
                            in:a !(ex:p1|ex:p2) ?x
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.PATH, [ 'http://www.example.org/instance#a',
                                                         AE(A.NPS, [ AE(A.LINK, [ 'http://www.example.org/schema#p1' ]),
                                                                     AE(A.LINK, [ 'http://www.example.org/schema#p2' ]) ]),
                                                         '?x' ]),
                                [ '?x' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp12) Variable length path and two paths to same target node', () => {
        let sparql = `prefix ex: <http://www.example.org/schema#>
                        prefix in: <http://www.example.org/instance#>
                        
                        select * where {
                            in:a (ex:p1/ex:p2)+ ?x
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.PATH, [ 'http://www.example.org/instance#a',
                                 AE(A.ONE_OR_MORE_PATH, [ AE(A.SEQ, [ AE(A.LINK, [ 'http://www.example.org/schema#p1' ]), AE(A.LINK, [ 'http://www.example.org/schema#p2' ]) ]) ]),
                                 '?x' ]),
                    [ '?x' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp14) Star path over foaf:knows', () => {
        let sparql = `PREFIX : <http://example.org/>
                        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
                        
                        SELECT *
                        WHERE { ?X foaf:knows* ?Y }
                        ORDER BY ?X ?Y`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.ORDER_BY, [ AE(A.PATH, [ '?X',
                                                  AE(A.ZERO_OR_MORE_PATH, [ AE(A.LINK, [ 'http://xmlns.com/foaf/0.1/knows' ]) ]),
                                                  '?Y' ]),
                                     [ '?X', '?Y' ] ]),
                    [ '?X', '?Y' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp28a) Diamond, with loop -- (:p/:p)?', () => {
        let sparql = `prefix : <http://example/>
                        select * where {
                            :a (:p/:p)? ?t
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.PATH, [ 'http://example/a',
                                             AE(A.ZERO_OR_ONE_PATH, [ AE(A.SEQ, [ AE(A.LINK, [ 'http://example/p' ]), AE(A.LINK, [ 'http://example/p' ]) ]) ]),
                                             '?t' ]),
                                [ '?t' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp30) Operator precedence 1', () => {
        let sparql = `prefix : <http://www.example.org/>
                        select ?t
                        where {
                            :a :p1|:p2/:p3|:p4 ?t
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.PATH, [ 'http://www.example.org/a',
                                             AE(A.ALT, [ AE(A.ALT, [ AE(A.LINK, [ 'http://www.example.org/p1' ]),
                                                                     AE(A.SEQ, [ AE(A.LINK, [ 'http://www.example.org/p2' ]), AE(A.LINK, [ 'http://www.example.org/p3' ]) ]) ]),
                                                         AE(A.LINK, [ 'http://www.example.org/p4' ]) ]),
                                             '?t' ]),
                                [ '?t' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp31) Operator precedence 2', () => {
        let sparql = `prefix : <http://www.example.org/>
                        select ?t
                        where {
                            :a (:p1|:p2)/(:p3|:p4) ?t
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.JOIN, [ AE(A.PATH, [ 'http://www.example.org/a',
                                                         AE(A.ALT, [ AE(A.LINK, [ 'http://www.example.org/p1' ]), AE(A.LINK, [ 'http://www.example.org/p2' ]) ]),
                                                         '?var0' ]),
                                            AE(A.PATH, [ '?var0',
                                                         AE(A.ALT, [ AE(A.LINK, [ 'http://www.example.org/p3' ]), AE(A.LINK, [ 'http://www.example.org/p4' ]) ]),
                                                         '?t' ]) ]),
                                [ '?t' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp32) Operator precedence 3', () => {
        let sparql = `prefix : <http://www.example.org/>
                        select ?t
                        where {
                            :a :p0|^:p1/:p2|:p3 ?t
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.PATH, [ 'http://www.example.org/a',
                                             AE(A.ALT, [ AE(A.ALT, [ AE(A.LINK, [ 'http://www.example.org/p0' ]),
                                                                     AE(A.SEQ, [ AE(A.INV, [ AE(A.LINK, [ 'http://www.example.org/p1' ]) ]),
                                                                                 AE(A.LINK, [ 'http://www.example.org/p2' ]) ]) ]),
                                                         AE(A.LINK, [ 'http://www.example.org/p3' ]) ]),
                                             '?t' ]),
                                [ '?t' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp33) Operator precedence 4', () => {
        let sparql = `prefix : <http://www.example.org/>
                        select ?t
                        where {
                            :a (:p0|^:p1)/:p2|:p3 ?t
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.PATH, [ 'http://www.example.org/a',
                                             AE(A.ALT, [ AE(A.SEQ, [ AE(A.ALT, [ AE(A.LINK, [ 'http://www.example.org/p0' ]),
                                                                                 AE(A.INV, [ AE(A.LINK, [ 'http://www.example.org/p1' ]) ]) ]),
                                                                     AE(A.LINK, [ 'http://www.example.org/p2' ]) ]),
                                                         AE(A.LINK, [ 'http://www.example.org/p3' ]) ]),
                                             '?t' ]),
                                [ '?t' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('(pp37) Nested (*)*', () => {
        let sparql = `prefix : <http://example.org/>
                        select ?X where { :A0 ((:P)*)* ?X }
                        order by ?X`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.ORDER_BY, [ AE(A.PATH, [ 'http://example.org/A0',
                                                              AE(A.ZERO_OR_MORE_PATH, [ AE(A.ZERO_OR_MORE_PATH, [ AE(A.LINK, [ 'http://example.org/P' ]) ]) ]),
                                                              '?X' ]),
                                                 [ '?X' ] ]),
                                [ '?X' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
});