
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

describe('DAWG-syntax-lists', () => {
    it('syntax-lists-01', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          WHERE { ( ?x ) :p ?z }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [
                    T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '?x'),
                    T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                    T('_:b', 'http://example.org/ns#p', '?z'),
                ]), ['?x', '?z'] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lists-02', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT *
                          WHERE { ?x :p ( ?z ) }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [
                    T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '?z'),
                    T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                    T('?x', 'http://example.org/ns#p', '_:b'),
                ]), ['?x', '?z'] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lists-03', () => {
        let sparql = `SELECT * WHERE { ( ?z ) }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [
                    T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '?z'),
                    T('_:b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                ]), ['?z'] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lists-04', () => {
        let sparql = `SELECT * WHERE { ( ( ?z ) ) }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [
                    T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'),
                    T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                    T('_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '?z'),
                    T('_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                ]), ['?z'] ]);
        Util.compareAlgebras(expected, algebra);
    });
    
    // () is shorthand for 'nil'
    it('syntax-lists-05', () => {
        let sparql = `SELECT * WHERE { ( ( ) ) }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [
                    T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                    T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')
                ]), [] ]);
        Util.compareAlgebras(expected, algebra);
    });
});