
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

describe('DAWG-syntax-pat', () => {
    it('syntax-pat-01', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                      SELECT * { }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, []), [] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-pat-02', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                      SELECT *
                      { ?a :b :c OPTIONAL{:x :y :z} :x ?y ?z }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.JOIN, [
                    AE(A.LEFT_JOIN, [
                        AE(A.BGP, [ T('?a', 'http://example.org/ns#b', 'http://example.org/ns#c') ]),
                        AE(A.BGP, [ T('http://example.org/ns#x', 'http://example.org/ns#y', 'http://example.org/ns#z') ]),
                        true
                    ]),
                    AE(A.BGP, [ T('http://example.org/ns#x', '?y', '?z') ]),
                ]), [ '?a', '?y', '?z' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-pat-03', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                      SELECT *
                      { ?a :b :c
                        OPTIONAL{:x :y :z}
                        { :x1 :y1 :z1 } UNION { :x2 :y2 :z2 }
                      }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.JOIN, [
                    AE(A.LEFT_JOIN, [
                        AE(A.BGP, [ T('?a', 'http://example.org/ns#b', 'http://example.org/ns#c') ]),
                        AE(A.BGP, [ T('http://example.org/ns#x', 'http://example.org/ns#y', 'http://example.org/ns#z') ]),
                        true
                    ]),
                    AE(A.UNION, [
                        AE(A.BGP, [ T('http://example.org/ns#x1', 'http://example.org/ns#y1', 'http://example.org/ns#z1') ]),
                        AE(A.BGP, [ T('http://example.org/ns#x2', 'http://example.org/ns#y2', 'http://example.org/ns#z2') ]),
                    ]),
                ]), [ '?a' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-pat-03', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                      SELECT *
                      {
                        OPTIONAL{:x :y :z}
                        ?a :b :c
                        { :x1 :y1 :z1 } UNION { :x2 :y2 :z2 }
                      }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.JOIN, [
                    AE(A.JOIN, [
                        AE(A.LEFT_JOIN, [
                            AE(A.BGP, [ ]),
                            AE(A.BGP, [ T('http://example.org/ns#x', 'http://example.org/ns#y', 'http://example.org/ns#z') ]),
                            true
                        ]),
                        AE(A.BGP, [ T('?a', 'http://example.org/ns#b', 'http://example.org/ns#c') ]),
                    ]),
                    AE(A.UNION, [
                        AE(A.BGP, [ T('http://example.org/ns#x1', 'http://example.org/ns#y1', 'http://example.org/ns#z1') ]),
                        AE(A.BGP, [ T('http://example.org/ns#x2', 'http://example.org/ns#y2', 'http://example.org/ns#z2') ]),
                    ]),
                ]), [ '?a' ] ]);
        Util.compareAlgebras(expected, algebra);
    });
});