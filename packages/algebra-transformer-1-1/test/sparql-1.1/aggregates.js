
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 tests', () => {
    it('AVG', () => {
        let sparql = `PREFIX : <http://www.example.org/>
                      SELECT (AVG(?o) AS ?avg)
                      WHERE {
                            ?s :dec ?o
                      }`;
        let algebra = translate(sparql);
        // TODO: different Jena ordering
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.GROUP, [
                            [],
                            [ AE('?v', [ AE('avg', [ '?o' ]) ]) ],
                            AE(A.BGP, [ T('?s', 'http://www.example.org/dec', '?o') ])
                        ]),
                        '?avg',
                        '?v',
                    ]),
                    [ '?avg' ]]);
        Util.compareAlgebras(expected, algebra);
    });

    it('AVG with GROUP BY', () => {
        let sparql = `PREFIX : <http://www.example.org/>
                      SELECT ?s (AVG(?o) AS ?avg)
                      WHERE {
                            ?s ?p ?o
                      }
                      GROUP BY ?s
                      HAVING (AVG(?o) <= 2.0)`;
        let algebra = translate(sparql);
        // TODO: different filter/extend ordering than Jena
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.FILTER, [
                            AE('<=', [ '?v', '"2.0"^^http://www.w3.org/2001/XMLSchema#decimal' ]),
                            AE(A.GROUP, [
                                [ '?s' ],
                                [ AE('?v', [ AE('avg', [ '?o' ]) ]) ],
                                AE(A.BGP, [ T('?s', '?p', '?o') ])
                            ]),
                        ]),
                        '?avg',
                        '?v',
                    ]),
                    [ '?s', '?avg' ]]);
        Util.compareAlgebras(expected, algebra);
    });

    it('agg empty group', () => {
        let sparql = `PREFIX ex: <http://example.com/>
                      SELECT ?x (MAX(?value) AS ?max)
                      WHERE {
                            ?x ex:p ?value
                      } GROUP BY ?x`;
        let algebra = translate(sparql);
        // TODO: different Jena ordering
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.GROUP, [
                            [ '?x' ],
                            [ AE('?v', [ AE('max', [ '?value' ]) ]) ],
                            AE(A.BGP, [ T('?x', 'http://example.com/p', '?value') ])
                        ]),
                        '?max',
                        '?v',
                    ]),
                    [ '?max', '?x' ]]);
        Util.compareAlgebras(expected, algebra);
    });

    it('Error in AVG', () => {
        let sparql = `PREFIX : <http://example.com/data/#>
                      SELECT ?g (AVG(?p) AS ?avg) ((MIN(?p) + MAX(?p)) / 2 AS ?c)
                      WHERE {
                            ?g :p ?p .
                      }
                      GROUP BY ?g`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.EXTEND, [
                            AE(A.GROUP, [
                                [ '?g' ],
                                [
                                    AE('?v0', [ AE('avg', [ '?p' ]) ]),
                                    AE('?vMin', [ AE('min', [ '?p' ]) ]),
                                    AE('?vMax', [ AE('max', [ '?p' ]) ]),
                                ],
                                AE(A.BGP, [ T('?g', 'http://example.com/data/#p', '?p') ])
                            ]),
                            '?avg',
                            '?v0'
                        ]),
                        '?c',
                        AE('/', [ AE('+', [ '?vMin', '?vMax' ]), '"2"^^http://www.w3.org/2001/XMLSchema#integer' ]),
                    ]),
                    [ '?g', '?avg', '?c' ]]);
        Util.compareAlgebras(expected, algebra);
    });

    it('Protect from error in AVG', () => {
        let sparql = `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                      PREFIX : <http://example.com/data/#>
                      SELECT ?g
                      (AVG(IF(isNumeric(?p), ?p, COALESCE(xsd:double(?p),0))) AS ?avg)
                      WHERE {
                            ?g :p ?p .
                      }
                      GROUP BY ?g`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.GROUP, [
                            [ '?g' ],
                            [
                                AE('?v', [ AE('avg', [ AE('if', [
                                    AE('isnumeric', [ '?p' ]),
                                    '?p',
                                    AE('coalesce', [ AE('http://www.w3.org/2001/XMLSchema#double', [ '?p' ]), '"0"^^http://www.w3.org/2001/XMLSchema#integer' ])
                                ]) ]) ]),
                            ],
                            AE(A.BGP, [ T('?g', 'http://example.com/data/#p', '?p') ])
                        ]),
                        '?avg',
                        '?v'
                    ]),
                    [ '?g', '?avg' ]]);
        Util.compareAlgebras(expected, algebra);
    });

    it('Protect from error in AVG', () => {
        let sparql = `PREFIX : <http://www.example.org/>
                      ASK {
                          {SELECT (GROUP_CONCAT(?o) AS ?g) WHERE {
                                [] :p1 ?o
                          }}
                          FILTER(?g = "1 22" || ?g = "22 1")
                      }`;
        let algebra = translate(sparql);
        // TODO: technically there is no definition on what to do with non-SELECT queries in sparql algebra
        let expected =
                AE(A.PROJECT, [
                    AE(A.FILTER, [
                        AE('||', [ AE('=', [ '?g', '"1 22"']), AE('=', [ '?g', '"22 1"']) ]),
                        AE(A.TO_MULTISET, [
                            AE(A.PROJECT, [
                                AE(A.EXTEND, [
                                    AE(A.GROUP, [
                                        [],
                                        [ AE('?v1', [ AE('group_concat', [ '?o' ]) ]) ],
                                        AE(A.BGP, [ T('_:b', 'http://www.example.org/p1', '?o')])
                                    ]),
                                    '?g',
                                    '?v1'
                                ]),
                                [ '?g' ]
                            ])
                        ])
                    ]),
                    [ '?g' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });

    it('Protect from error in AVG', () => {
        let sparql = `PREFIX : <http://www.example.org/>
                      SELECT (COUNT(*) AS ?c) {
                          {SELECT ?p (GROUP_CONCAT(?o) AS ?g) WHERE {
                              [] ?p ?o
                          } GROUP BY ?p}
                          FILTER(
                              (?p = :p1 && (?g = "1 22" || ?g = "22 1"))
                              || (?p = :p2 && (?g = "aaa bb c" || ?g = "aaa c bb" || ?g = "bb aaa c" || ?g = "bb c aaa" || ?g = "c aaa bb" || ?g = "c bb aaa"))
                          )
                      }`;
        let algebra = translate(sparql);
        console.log(algebra + '');
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.GROUP, [
                            [],
                            [ AE('?vCount', [ AE('count', [ '*' ]) ]) ],
                            AE(A.FILTER, [
                                AE('||', [
                                    AE('&&', [ AE('=', [ '?p', 'http://www.example.org/p1' ]), AE('||', [ AE('=', [ '?g', '"1 22"' ]), AE('=', [ '?g', '"22 1"' ]) ]) ]),
                                    AE('&&', [ AE('=', [ '?p', 'http://www.example.org/p2' ]), AE('||', [
                                        AE('||', [ AE('||', [ AE('||', [ AE('||', [AE('=', [ '?g', '"aaa bb c"' ]),
                                                                                   AE('=', [ '?g', '"aaa c bb"' ])]),
                                                                         AE('=', [ '?g', '"bb aaa c"' ]) ]),
                                                              AE('=', [ '?g', '"bb c aaa"' ]) ]),
                                                   AE('=', [ '?g', '"c aaa bb"' ]) ]),
                                        AE('=', [ '?g', '"c bb aaa"' ]) ]) ]),
                                ]),
                                AE(A.TO_MULTISET, [
                                    AE(A.PROJECT, [
                                        AE(A.EXTEND, [
                                            AE(A.GROUP, [
                                                [ '?p' ],
                                                [ AE('?vGroup', [ AE('group_concat', '?o') ])],
                                                AE(A.BGP, [ T('_:b', '?p', '?o') ])
                                            ]),
                                            '?g',
                                            '?vGroup'
                                        ]),
                                        [ '?g', '?p' ]
                                    ])
                                ])
                            ])
                        ]),
                        '?c',
                        '?vCount'
                    ]),
                    [ '?c' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
});
