
const _ = require('lodash');
const algebra = require('../../lib/sparqlAlgebra');
const Util = require('../util');

const A = algebra.Algebra;
const translate = algebra.translate;

const AE = Util.algebraElement;
const T = Util.triple;

describe('DAWG-syntax-forms', () => {
    it('syntax-forms-01', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { ( [ ?x ?y ] ) :p ( [ ?pa ?b ] 57 ) }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [
                    T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'),
                    T('_:b1', '?x', '?y'),
                    T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                
                    T('_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b3'),
                    T('_:b3', '?pa', '?b'),
                    T('_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b4'),
                    T('_:b4', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"57"^^http://www.w3.org/2001/XMLSchema#integer'),
                    T('_:b4', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                
                    T('_:b0', 'http://example.org/ns#p', '_:b2')
                ]), [ '?x', '?y', '?pa', '?b' ]]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-forms-02', () => {
        let sparql = `PREFIX : <http://example.org/ns#>
                          SELECT * WHERE { ( [] [] ) }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [ AE(A.BGP, [
                    T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'),
                    T('_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2'),
                    T('_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b3'),
                    T('_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
});