
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

describe('DAWG-syntax-struct', () => {
    it('syntax-struct-01', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                      SELECT *
                      { OPTIONAL { } }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.LEFT_JOIN, [
                        AE(A.BGP, []),
                        AE(A.BGP, []),
                        true
                    ]),
                    [],
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-struct-02', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                      SELECT *
                      { OPTIONAL { :a :b :c } }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.LEFT_JOIN, [
                        AE(A.BGP, []),
                        AE(A.BGP, [ T('http://example.org/ns#a', 'http://example.org/ns#b', 'http://example.org/ns#c') ]),
                        true
                    ]),
                    [],
                ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-struct-13', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                      SELECT *
                      { :p :q :r . OPTIONAL { :a :b :c }
                        :p :q :r . OPTIONAL { :a :b :c }
                      }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [
                    AE(A.LEFT_JOIN, [
                        AE(A.JOIN, [
                            AE(A.LEFT_JOIN, [
                                AE(A.BGP, [ T('http://example.org/ns#p', 'http://example.org/ns#q', 'http://example.org/ns#r') ]),
                                AE(A.BGP, [ T('http://example.org/ns#a', 'http://example.org/ns#b', 'http://example.org/ns#c') ]),
                                true
                            ]),
                            AE(A.BGP, [ T('http://example.org/ns#p', 'http://example.org/ns#q', 'http://example.org/ns#r') ])
                        ]),
                        AE(A.BGP, [ T('http://example.org/ns#a', 'http://example.org/ns#b', 'http://example.org/ns#c') ]),
                        true
                    ]),
                    [],
                ]);
        Util.compareAlgebras(expected, algebra);
    });
});