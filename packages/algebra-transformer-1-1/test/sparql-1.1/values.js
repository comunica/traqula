
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 bind', () => {
    it('bind01 - BIND', () => {
        let sparql = `PREFIX dc: <http://purl.org/dc/elements/1.1/>
                        PREFIX : <http://example.org/book/>
                        PREFIX ns: <http://example.org/ns#>
                        
                        SELECT ?book ?title ?price
                        {
                            VALUES ?book { :book1 }
                            ?book dc:title ?title ;
                            ns:price ?price .
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.TABLE, [
                            AE(A.VARS, [ '?book' ]),
                            AE(A.ROW, [ [ '?book', 'http://example.org/book/book1' ] ])
                        ]),
                        AE(A.BGP, [ T('?book', 'http://purl.org/dc/elements/1.1/title', '?title'), T('?book', 'http://example.org/ns#price', '?price') ])
                    ]),
                    [ '?book', '?title', '?price' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Post-subquery VALUES', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT ?s ?o {
                        {
                            SELECT * WHERE {
                                ?s ?p ?o .
                            }
                            VALUES (?o) { (:b) }
                        }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.PROJECT, [
                        AE(A.JOIN, [
                            AE(A.BGP, [ T('?s', '?p', '?o') ]),
                            AE(A.TABLE, [ AE(A.VARS, [ '?o' ]), AE(A.ROW, [ [ '?o', 'http://example.org/b' ] ]) ])
                        ]),
                        [ '?s', '?p', '?o' ] ]),
                    [ '?s', '?o' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Post-query VALUES with subj-var, 1 row', () => {
        let sparql = `PREFIX dc: <http://purl.org/dc/elements/1.1/>
                        PREFIX : <http://example.org/book/>
                        PREFIX ns: <http://example.org/ns#>
                        
                        SELECT ?book ?title ?price
                        {
                            ?book dc:title ?title ;
                            ns:price ?price .
                        }
                        VALUES ?book {
                            :book1
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.BGP, [ T('?book', 'http://purl.org/dc/elements/1.1/title', '?title'), T('?book', 'http://example.org/ns#price', '?price') ]),
                        AE(A.TABLE, [ AE(A.VARS, [ '?book' ]), AE(A.ROW, [ [ '?book', 'http://example.org/book/book1' ] ]) ])
                    ]),
                    [ '?book', '?title', '?price' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Post-query VALUES with 2 obj-vars, 1 row with UNDEF', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT ?s ?o1 ?o2
                        {
                            ?s ?p1 ?o1 .
                            ?s ?p2 ?o2 .
                        } VALUES (?o1 ?o2) {
                            ("Alan" UNDEF)
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.BGP, [ T('?s', '?p1', '?o1'), T('?s', '?p2', '?o2') ]),
                        AE(A.TABLE, [ AE(A.VARS, [ '?o1', '?o2' ]), AE(A.ROW, [ [ '?o1', '"Alan"' ] ]) ])
                    ]),
                    [ '?s', '?o1', '?o2' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Post-query VALUES with 2 obj-vars, 2 rows with UNDEF', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT ?s ?o1 ?o2
                        {
                            ?s ?p1 ?o1 .
                            ?s ?p2 ?o2 .
                        } VALUES (?o1 ?o2) {
                            (UNDEF "Alan")
                            (:b UNDEF)
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.BGP, [ T('?s', '?p1', '?o1'), T('?s', '?p2', '?o2') ]),
                        AE(A.TABLE, [ AE(A.VARS, [ '?o1', '?o2' ]), AE(A.ROW, [ [ '?o2', '"Alan"' ] ]), AE(A.ROW, [ [ '?o1', 'http://example.org/b' ] ]) ])
                    ]),
                    [ '?s', '?o1', '?o2' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Post-query VALUES with (OPTIONAL) obj-var, 1 row', () => {
        let sparql = `PREFIX : <http://example.org/>
                        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
                        SELECT ?s ?o1 ?o2
                        {
                            ?s ?p1 ?o1
                            OPTIONAL { ?s foaf:knows ?o2 }
                        } VALUES (?o2) {
                            (:b)
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.LEFT_JOIN, [
                            AE(A.BGP, [ T('?s', '?p1', '?o1') ]),
                            AE(A.BGP, [ T('?s', 'http://xmlns.com/foaf/0.1/knows', '?o2') ]),
                            true ]),
                        AE(A.TABLE, [ AE(A.VARS, [ '?o2' ]), AE(A.ROW, [ [ '?o2', 'http://example.org/b' ] ]) ])
                    ]),
                    [ '?s', '?o1', '?o2' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
});