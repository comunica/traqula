
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

describe('DAWG-syntax-bnodes', () => {
    it('syntax-bnodes-01', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [:p :q ] }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('_:b0', 'http://example.org/ns#p', 'http://example.org/ns#q') ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-bnodes-02', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [] :p :q }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, [  T('_:b0', 'http://example.org/ns#p', 'http://example.org/ns#q') ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-bnodes-03', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [ ?x ?y ] :p [ ?pa ?b ] }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [
                    T('_:b0', '?x', '?y'),
                    T('_:b1', '?pa', '?b'),
                    T('_:b0', 'http://example.org/ns#p', '_:b1')
                ]), [ '?x', '?y', '?pa', '?b' ]]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-bnodes-04', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { [ :p :q ; ] }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, [  T('_:b0', 'http://example.org/ns#p', 'http://example.org/ns#q') ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-bnodes-05', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { _:a :p1 :q1 .
                                           _:a :p2 :q2 .
                                         }`;
        let algebra = translate(sparql);
        let expected = AE(A.PROJECT, [ AE(A.BGP, [ T('_:a', 'http://example.org/ns#p1', 'http://example.org/ns#q1'), T('_:a', 'http://example.org/ns#p2', 'http://example.org/ns#q2') ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
});