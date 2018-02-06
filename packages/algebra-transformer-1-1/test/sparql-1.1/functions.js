
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 functions', () => {
    it('BNODE(str)', () => {
        let sparql = `PREFIX : <http://example.org/>
                        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                        SELECT ?s1 ?s2
                        (BNODE(?s1) AS ?b1) (BNODE(?s2) AS ?b2)
                        WHERE {
                            ?a :str ?s1 .
                            ?b :str ?s2 .
                            FILTER (?a = :s1 || ?a = :s3)
                            FILTER (?b = :s1 || ?b = :s3)
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.EXTEND, [
                            AE(A.FILTER, [ // TODO: Jena uses exprlist here instead of &&
                                AE('&&', [
                                    AE('||', [ AE('=', [ '?a', 'http://example.org/s1' ]), AE('=', [ '?a', 'http://example.org/s3' ]) ]),
                                    AE('||', [ AE('=', [ '?b', 'http://example.org/s1' ]), AE('=', [ '?b', 'http://example.org/s3' ]) ])
                                ]),
                                AE(A.BGP, [ T('?a', 'http://example.org/str', '?s1'), T('?b', 'http://example.org/str', '?s2') ])
                            ]),
                            '?b1',
                            AE('BNODE', [ '?s1' ])
                        ]),
                        '?b2',
                        AE('BNODE', [ '?s2' ])
                    ]),
                    [ '?s1', '?s2', '?b1', '?b2' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('NOW()', () => {
        let sparql = `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                        ASK {
                            BIND(NOW() AS ?n)
                            FILTER(DATATYPE(?n) = xsd:dateTime)
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.ASK, [
                    AE(A.FILTER, [
                        AE('=', [ AE('datatype', [ '?n' ]), 'http://www.w3.org/2001/XMLSchema#dateTime' ]),
                        AE(A.EXTEND, [ AE(A.BGP, []), '?n', AE('now', []) ])
                    ])
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('STRLANG(STR())', () => {
        let sparql = `PREFIX : <http://example.org/>
                        SELECT ?s (STRLANG(STR(?str),"en-US") AS ?s2) WHERE {
                            ?s :str ?str
                            FILTER(LANGMATCHES(LANG(?str), "en"))
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.EXTEND, [
                        AE(A.FILTER, [
                            AE('langmatches', [ AE('lang', [ '?str' ]), '"en"' ]),
                            AE(A.BGP, [ T('?s', 'http://example.org/str', '?str') ])
                        ]),
                        '?s2',
                        AE('strlang', [ AE('str', [ '?str' ]), '"en-US"' ])
                    ]),
                    [ '?s', '?s2' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
});