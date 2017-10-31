
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 group', () => {
    it('Group-1', () => {
        let sparql = `PREFIX : <http://example/>
                        SELECT ?s
                        {
                            ?s :p ?v .
                        }
                        GROUP BY ?s`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.GROUP, [
                        [ '?s' ],
                        [],
                        AE(A.BGP, [ T('?s', 'http://example/p', '?v') ])
                    ]),
                    [ '?s' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Group-3', () => {
        let sparql = `PREFIX : <http://example/>
                        SELECT ?w (SAMPLE(?v) AS ?S)
                        {
                            ?s :p ?v .
                            OPTIONAL { ?s :q ?w }
                        }
                        GROUP BY ?w`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.GROUP, [
                            [ '?w' ],
                            [ AE(A.AGGREGATE, ['sample', '?v', '?var0']) ],
                            AE(A.LEFT_JOIN, [
                                AE(A.BGP, [ T('?s', 'http://example/p', '?v') ]),
                                AE(A.BGP, [ T('?s', 'http://example/q', '?w') ]),
                                true
                            ])
                        ]),
                        '?S',
                        '?var0'
                    ]),
                    [ '?w', '?S' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Group-4', () => {
        let sparql = `PREFIX : <http://example/>
                        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                        SELECT ?X (SAMPLE(?v) AS ?S)
                        {
                            ?s :p ?v .
                            OPTIONAL { ?s :q ?w }
                        }
                        GROUP BY (COALESCE(?w, "1605-11-05"^^xsd:date) AS ?X) `;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.EXTEND, [
                            AE(A.GROUP, [
                                [ AE('coalesce', [ '?w', '"1605-11-05"^^http://www.w3.org/2001/XMLSchema#date' ]) ],
                                [ AE(A.AGGREGATE, ['sample', '?v', '?var0']) ],
                                AE(A.LEFT_JOIN, [ AE(A.BGP, [ T('?s', 'http://example/p', '?v') ]), AE(A.BGP, [ T('?s', 'http://example/q', '?w') ]), true ])
                            ]),
                            '?X',
                            AE('coalesce', [ '?w', '"1605-11-05"^^http://www.w3.org/2001/XMLSchema#date' ])
                        ]),
                        '?S',
                        '?var0'
                    ]),
                    [ '?X', '?S' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
});