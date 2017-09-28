
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 bind', () => {
    it('bind01 - BIND', () => {
        let sparql = `PREFIX : <http://example.org/>
                      SELECT ?z
                      {
                          ?s ?p ?o .
                          BIND(?o+10 AS ?z)
                      }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.BGP, [ T('?s', '?p', '?o') ]),
                        '?z',
                        AE('+', [ '?o', '"10"^^http://www.w3.org/2001/XMLSchema#integer' ])
                    ]),
                    [ '?z' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('bind02 - BIND', () => {
        let sparql = `PREFIX : <http://example.org/>
                      SELECT ?o ?z ?z2
                      {
                          ?s ?p ?o .
                          BIND(?o+10 AS ?z)
                          BIND(?o+100 AS ?z2)
                      }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.EXTEND, [
                            AE(A.BGP, [ T('?s', '?p', '?o') ]),
                            '?z',
                            AE('+', [ '?o', '"10"^^http://www.w3.org/2001/XMLSchema#integer' ])
                        ]),
                        '?z2',
                        AE('+', [ '?o', '"100"^^http://www.w3.org/2001/XMLSchema#integer' ])
                    ]),
                    [ '?o', '?z', '?z2' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('bind03 - BIND', () => {
        let sparql = `PREFIX : <http://example.org/>
                      SELECT ?z ?s1
                      {
                          ?s ?p ?o .
                          BIND(?o+1 AS ?z)
                          ?s1 ?p1 ?z
                      }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.EXTEND, [
                            AE(A.BGP, [ T('?s', '?p', '?o') ]),
                            '?z',
                            AE('+', [ '?o', '"1"^^http://www.w3.org/2001/XMLSchema#integer' ])
                        ]),
                        AE(A.BGP, [ T('?s1', '?p1', '?z') ])
                    ]),
                    [ '?z', '?s1' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('bind04 - BIND', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT *
                        {
                            ?s ?p ?o .
                            BIND(?nova AS ?z)
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.BGP, [ T('?s', '?p', '?o') ]),
                        '?z',
                        '?nova'
                    ]),
                    [ '?z', '?s', '?p', '?o' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('bind05 - BIND', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT ?s ?p ?o ?z
                        {
                            ?s ?p ?o .
                            BIND(?o+1 AS ?z)
                            FILTER(?z = 3 )
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.FILTER, [
                        AE('=', [ '?z', '"3"^^http://www.w3.org/2001/XMLSchema#integer' ]),
                        AE(A.EXTEND, [
                            AE(A.BGP, [ T('?s', '?p', '?o') ]),
                            '?z',
                            AE('+', [ '?o', '"1"^^http://www.w3.org/2001/XMLSchema#integer' ])
                        ])
                    ]),
                    [ '?s', '?p', '?o', '?z' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('bind07 - BIND', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT ?s ?p ?o ?z
                        {
                            ?s ?p ?o .
                            { BIND(?o+1 AS ?z) } UNION { BIND(?o+2 AS ?z) }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.BGP, [ T('?s', '?p', '?o') ]),
                        AE(A.UNION, [
                            AE(A.EXTEND, [
                                AE(A.BGP, [  ]),
                                '?z',
                                AE('+', [ '?o', '"1"^^http://www.w3.org/2001/XMLSchema#integer' ])
                            ]),
                            AE(A.EXTEND, [
                                AE(A.BGP, [  ]),
                                '?z',
                                AE('+', [ '?o', '"2"^^http://www.w3.org/2001/XMLSchema#integer' ])
                            ])
                        ])
                    ]),
                    [ '?s', '?p', '?o', '?z' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('bind08 - BIND', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT ?s ?p ?o ?z
                        {
                            ?s ?p ?o .
                            FILTER(?z = 3 )
                            BIND(?o+1 AS ?z)
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.FILTER, [
                        AE('=', [ '?z', '"3"^^http://www.w3.org/2001/XMLSchema#integer' ]),
                        AE(A.EXTEND, [
                            AE(A.BGP, [ T('?s', '?p', '?o') ]),
                            '?z',
                            AE('+', [ '?o', '"1"^^http://www.w3.org/2001/XMLSchema#integer' ])
                        ])
                    ]),
                    [ '?s', '?p', '?o', '?z' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('bind10 - BIND', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT ?s ?v ?z
                        {
                            BIND(4 AS ?z)
                            {
                                # ?z is not in-scope at the time of filter execution.
                                ?s :p ?v . FILTER(?v = ?z)
                            }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.JOIN, [
                        AE(A.EXTEND, [
                            AE(A.BGP, []),
                            '?z',
                            '"4"^^http://www.w3.org/2001/XMLSchema#integer'
                        ]),
                        AE(A.FILTER, [
                            AE('=', [ '?v', '?z' ]),
                            AE(A.BGP, [ T('?s', 'http://example.org/p', '?v') ])
                        ])
                    ]),
                    [ '?s', '?v', '?z' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('bind11 - BIND', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT ?s ?v ?z
                        {
                            BIND(4 AS ?z)
                            # ?z is in scope at the time of filter execution.
                            ?s :p ?v .
                            FILTER(?v = ?z)
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.FILTER, [
                        AE('=', [ '?v', '?z' ]),
                        AE(A.JOIN, [
                            AE(A.EXTEND, [
                                AE(A.BGP, []),
                                '?z',
                                '"4"^^http://www.w3.org/2001/XMLSchema#integer'
                            ]),
                            AE(A.BGP, [ T('?s', 'http://example.org/p', '?v') ])
                        ])
                    ]),
                    [ '?s', '?v', '?z' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
});