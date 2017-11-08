
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 syntax', () => {
    it('syntax-aggregate-15.rq', () => {
        let sparql = `SELECT (GROUP_CONCAT(?x; SEPARATOR=';') AS ?y) {}`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.EXTEND, [ AE(A.GROUP, [ [  ], [ AE(A.AGGREGATE, ['group_concat', '?x', ';', '?var0']) ], AE(A.BGP, [  ]) ]), '?y', '?var0' ]), [ '?y' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-subquery-02.rq', () => {
        let sparql = `SELECT * {
                            {}
                            {SELECT * { ?s ?p ?o } }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.PROJECT, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ '?s', '?p', '?o' ] ]), [  ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    // TODO: put this back when sparql.js gets updated
    // it('syntax-subquery-03.rq', () => {
    //     let sparql = `SELECT * { {} OPTIONAL { SELECT * { ?s ?p ?o }} }`;
    //     let algebra = translate(sparql);
    //     console.log(algebra + '');
    //     console.log(Util.testString(algebra));
    //     let expected =
    //             AE(A.PROJECT, [ AE(A.TO_MULTISET, [ AE(A.PROJECT, [ AE(A.BGP, [ T('?s', '?p', '?o') ]), [ '?s', '?p', '?o' ] ]) ]), [  ] ]);
    //     Util.compareAlgebras(expected, algebra);
    // });
    
    // TODO: notin has different parameters and gets simplified in Jena
    it('syntax-oneof-01.rq', () => {
        let sparql = `SELECT * { ?s ?p ?o FILTER(?o NOT IN(1,2,?s+57)) }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.FILTER, [ AE('notin', [ '?o', '"1"^^http://www.w3.org/2001/XMLSchema#integer',
                                                                   '"2"^^http://www.w3.org/2001/XMLSchema#integer',
                                                                   AE('+', [ '?s', '"57"^^http://www.w3.org/2001/XMLSchema#integer' ]) ]),
                                               AE(A.BGP, [ T('?s', '?p', '?o') ]) ]),
                                [ '?s', '?p', '?o' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-oneof-03.rq', () => {
        let sparql = `SELECT * { ?s ?p ?o FILTER(?o IN(1,<x:x>)) }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.FILTER, [ AE('in', [ '?o', '"1"^^http://www.w3.org/2001/XMLSchema#integer', 'x:x' ]),
                                               AE(A.BGP, [ T('?s', '?p', '?o') ]) ]),
                                [ '?s', '?p', '?o' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-BINDscope1.rq', () => {
        let sparql = `PREFIX : <http://www.example.org>
                        SELECT *
                        WHERE {
                            :s :p ?o .
                            BIND((1+?o) AS ?o1)
                            :s :q ?o1
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.JOIN, [ AE(A.EXTEND, [ AE(A.BGP, [ T('http://www.example.orgs', 'http://www.example.orgp', '?o') ]),
                                                            '?o1',
                                                            AE('+', [ '"1"^^http://www.w3.org/2001/XMLSchema#integer', '?o' ]) ]),
                                             AE(A.BGP, [ T('http://www.example.orgs', 'http://www.example.orgq', '?o1') ]) ]),
                                [ '?o', '?o1' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    // TODO: test currently fails due to simplifcation in SPARQL.js 1.5.2
    // it('syntax-BINDscope2.rq', () => {
    //     let sparql = `PREFIX : <http://www.example.org>
    //                     SELECT *
    //                     WHERE {
    //                         :s :p ?o .
    //                         :s :q ?o1
    //                         { BIND((1+?o) AS ?o1) }
    //                     }`;
    //     let algebra = translate(sparql);
    //     let expected =
    //             AE(A.PROJECT, [ AE(A.JOIN, [ AE(A.BGP, [ T('http://www.example.orgs', 'http://www.example.orgp', '?o'),
    //                                                        T('http://www.example.orgs', 'http://www.example.orgq', '?o1') ]),
    //                                          AE(A.EXTEND, [ AE(A.BGP, [ ]),
    //                                                         '?o1',
    //                                                         AE('+', [ '"1"^^http://www.w3.org/2001/XMLSchema#integer', '?o' ]) ]) ]),
    //                             [ '?o', '?o1' ] ]);
    //     Util.compareAlgebras(expected, algebra);
    // });
    
    // TODO: test currently fails due to simplifcation in SPARQL.js 1.5.2
    // it('syntax-BINDscope2.rq', () => {
    //     let sparql = ` PREFIX : <http://www.example.org>
    //                     SELECT *
    //                     WHERE {
    //                         {
    //                             :s :p ?o .
    //                             :s :q ?o1
    //                         }
    //                         { BIND((1+?o) AS ?o1) }
    //                     }`;
    //     let algebra = translate(sparql);
    //     let expected =
    //             AE(A.PROJECT, [ AE(A.JOIN, [ AE(A.BGP, [ T('http://www.example.orgs', 'http://www.example.orgp', '?o'),
    //                                                      T('http://www.example.orgs', 'http://www.example.orgq', '?o1') ]),
    //                                          AE(A.EXTEND, [ AE(A.BGP, [ ]),
    //                                                         '?o1',
    //                                                         AE('+', [ '"1"^^http://www.w3.org/2001/XMLSchema#integer', '?o' ]) ]) ]),
    //                             [ '?o', '?o1' ] ]);
    //     Util.compareAlgebras(expected, algebra);
    // });
});