
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 exists', () => {
    it('Exists within graph pattern', () => {
        let sparql = `prefix ex: <http://www.example.org/>
                        select * where {
                        graph ex:graph {
                            ?s ?p ex:o1
                            filter exists { ?s ?p ex:o2 }
                        }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.GRAPH, [
                        'http://www.example.org/graph',
                        AE(A.FILTER, [
                            AE(A.EXISTS, [ AE(A.BGP, [ T('?s', '?p', 'http://www.example.org/o2') ]) ]),
                            AE(A.BGP, [ T('?s', '?p', 'http://www.example.org/o1') ])
                        ])
                    ]),
                    [ '?s', '?p' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Nested positive exists', () => {
        let sparql = `prefix ex: <http://www.example.org/>
                        select * where {
                            ?s ?p ex:o
                            filter exists { ?s ?p ex:o1 filter exists { ?s ?p ex:o2 } }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.FILTER, [
                        AE(A.EXISTS, [ AE(A.FILTER, [
                            AE(A.EXISTS, [ AE(A.BGP, [ T('?s', '?p', 'http://www.example.org/o2') ]) ]),
                            AE(A.BGP, [ T('?s', '?p', 'http://www.example.org/o1') ])
                        ]) ]),
                        AE(A.BGP, [ T('?s', '?p', 'http://www.example.org/o') ])
                    ]),
                    [ '?s', '?p' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('Nested positive exists', () => {
        let sparql = `prefix ex: <http://www.example.org/>
                        select * where {
                            ?s ?p ex:o
                            filter exists { ?s ?p ex:o1 filter not exists { ?s ?p ex:o2 } }
                        }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.FILTER, [
                        AE(A.EXISTS, [ AE(A.FILTER, [
                            AE(A.FN_NOT, [ AE(A.EXISTS, [ AE(A.BGP, [ T('?s', '?p', 'http://www.example.org/o2') ]) ]) ]),
                            AE(A.BGP, [ T('?s', '?p', 'http://www.example.org/o1') ]) ]) ]),
                        AE(A.BGP, [ T('?s', '?p', 'http://www.example.org/o') ])
                    ]), 
                    [ '?s', '?p' ]
                ]);
        Util.compareAlgebras(expected, algebra);
    });
});