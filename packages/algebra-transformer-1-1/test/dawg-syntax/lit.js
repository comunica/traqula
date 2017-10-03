
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

describe('DAWG-syntax-lit', () => {
    it('syntax-lit-01', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p "x" }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', '"x"'),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-02', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p 'x' }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', '"x"'),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    // TODO: based on sparql.js syntax
    it('syntax-lit-03', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p "x\\"y'z" }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"x"y'z"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-04', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p 'x"y\\'z' }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"x"y'z"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-05', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p "x\\"" }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"x""`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-06', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p 'x\\'' }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"x'"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-07', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p 123 }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"123"^^http://www.w3.org/2001/XMLSchema#integer`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-08', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p 123. . }`;
        // 123. is no longer a valid way to write a decimal in sparql 1.1
    });
    
    it('syntax-lit-09', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p """Long
""
Literal
""" }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long\n""\nLiteral\n"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-10', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p '''Long
'' """
Literal
''' }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long\n'' """\nLiteral\n"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-11', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p """Long""\\"Literal""" }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long"""Literal"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-12', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p '''Long''\\'Literal''' }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long'''Literal"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-13', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p """Long\\"""Literal""" }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long"""Literal"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-14', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p '''Long\\'''Literal''' }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long'''Literal"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-15', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p '''Long '' Literal''' }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long '' Literal"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-16', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p '''Long ' Literal''' }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long ' Literal"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-17', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p '''Long''\\\\Literal with '\\\\ single quotes ''' }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long''\\Literal with '\\ single quotes "`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-18', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p """Long "" Literal""" }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long "" Literal"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-19', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p """Long " Literal""" }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long " Literal"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
    
    it('syntax-lit-20', () => {
        let sparql = `BASE <http://example.org/>
                          PREFIX : <#>
                          SELECT * WHERE { :x :p """Long""\\\\Literal with "\\\\ single quotes""" }`;
        let algebra = translate(sparql);
        let expected =
                AE(A.PROJECT, [AE(A.BGP, [
                    T('http://example.org/#x', 'http://example.org/#p', `"Long""\\Literal with "\\ single quotes"`),
                ]), []]);
        Util.compareAlgebras(expected, algebra);
    });
});