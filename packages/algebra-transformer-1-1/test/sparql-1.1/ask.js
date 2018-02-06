
const Util = require('../util');

const translate = Util.translate;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 ask', () => {
    it('GROUP_CONCAT 1', () => {
        let sparql = `PREFIX : <http://www.example.org/>
ASK {
{SELECT (GROUP_CONCAT(?o) AS ?g) WHERE {
[] :p1 ?o
}}
FILTER(?g = "1 22" || ?g = "22 1")
}`;
        let algebra = translate(sparql);
        let expected = { type: 'ask',
            input:
                { type: 'filter',
                    input:
                        { type: 'project',
                            input:
                                { type: 'extend',
                                    input:
                                        { type: 'group',
                                            input:
                                                { type: 'bgp',
                                                    patterns:
                                                        [ { subject: { termType: 'BlankNode', value: 'b0' },
                                                            predicate: { termType: 'NamedNode', value: 'http://www.example.org/p1' },
                                                            object: { termType: 'Variable', value: 'o' },
                                                            graph: { termType: 'DefaultGraph', value: '' },
                                                            type: 'pattern' } ] },
                                            variables: [],
                                            aggregates:
                                                [ { type: 'expression',
                                                    expressionType: 'aggregate',
                                                    aggregator: 'group_concat',
                                                    expression:
                                                        { type: 'expression',
                                                            expressionType: 'term',
                                                            term: { termType: 'Variable', value: 'o' } },
                                                    distinct: false,
                                                    separator: ' ',
                                                    variable: { termType: 'Variable', value: 'var0' } } ] },
                                    variable: { termType: 'Variable', value: 'g' },
                                    expression:
                                        { type: 'expression',
                                            expressionType: 'term',
                                            term: { termType: 'Variable', value: 'var0' } } },
                            variables: [ { termType: 'Variable', value: 'g' } ] },
                    expression:
                        { type: 'expression',
                            expressionType: 'operator',
                            operator: '||',
                            args:
                                [ { type: 'expression',
                                    expressionType: 'operator',
                                    operator: '=',
                                    args:
                                        [ { type: 'expression',
                                            expressionType: 'term',
                                            term: { termType: 'Variable', value: 'g' } },
                                          { type: 'expression',
                                              expressionType: 'term',
                                              term:
                                                  { termType: 'Literal',
                                                      value: '1 22',
                                                      datatype:
                                                          { termType: 'NamedNode',
                                                              value: 'http://www.w3.org/2001/XMLSchema#string' } } } ] },
                                  { type: 'expression',
                                      expressionType: 'operator',
                                      operator: '=',
                                      args:
                                          [ { type: 'expression',
                                              expressionType: 'term',
                                              term: { termType: 'Variable', value: 'g' } },
                                            { type: 'expression',
                                                expressionType: 'term',
                                                term:
                                                    { termType: 'Literal',
                                                        value: '22 1',
                                                        datatype:
                                                            { termType: 'NamedNode',
                                                                value: 'http://www.w3.org/2001/XMLSchema#string' } } } ] } ] } } };
        Util.compareAlgebras(expected, algebra);
    });

    it('sparqldl-05.rq: simple undistinguished variable test.', () => {
        let sparql = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX : <http://example.org/test#>

ASK
WHERE
{_:a rdf:type :Person .}`;
        let algebra = translate(sparql);
        let expected = { type: 'ask',
            input:
                { type: 'bgp',
                    patterns:
                        [ { subject: { termType: 'BlankNode', value: 'a' },
                            predicate:
                                { termType: 'NamedNode',
                                    value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
                            object:
                                { termType: 'NamedNode',
                                    value: 'http://example.org/test#Person' },
                            graph: { termType: 'DefaultGraph', value: '' },
                            type: 'pattern' } ] } };
        Util.compareAlgebras(expected, algebra);
    });

    it('sparqldl-06.rq: cycle of undistinguished variables', () => {
        let sparql = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX : <http://example.org/test#>

ASK
WHERE
{
:a :p _:aa.
_:aa :r _:dd.
_:dd :t _:bb.
_:bb :s :a.
}`;
        let algebra = translate(sparql);
        let expected = { type: 'ask',
            input:
                { type: 'bgp',
                    patterns:
                        [ { subject: { termType: 'NamedNode', value: 'http://example.org/test#a' },
                            predicate: { termType: 'NamedNode', value: 'http://example.org/test#p' },
                            object: { termType: 'BlankNode', value: 'aa' },
                            graph: { termType: 'DefaultGraph', value: '' },
                            type: 'pattern' },
                          { subject: { termType: 'BlankNode', value: 'aa' },
                              predicate: { termType: 'NamedNode', value: 'http://example.org/test#r' },
                              object: { termType: 'BlankNode', value: 'dd' },
                              graph: { termType: 'DefaultGraph', value: '' },
                              type: 'pattern' },
                          { subject: { termType: 'BlankNode', value: 'dd' },
                              predicate: { termType: 'NamedNode', value: 'http://example.org/test#t' },
                              object: { termType: 'BlankNode', value: 'bb' },
                              graph: { termType: 'DefaultGraph', value: '' },
                              type: 'pattern' },
                          { subject: { termType: 'BlankNode', value: 'bb' },
                              predicate: { termType: 'NamedNode', value: 'http://example.org/test#s' },
                              object: { termType: 'NamedNode', value: 'http://example.org/test#a' },
                              graph: { termType: 'DefaultGraph', value: '' },
                              type: 'pattern' } ] } };
        Util.compareAlgebras(expected, algebra);
    });

    it('IN 1', () => {
        let sparql = `ASK {
FILTER(2 IN (1, 2, 3))
}`;
        let algebra = translate(sparql);
        let expected = { type: 'ask',
            input:
                { type: 'filter',
                    input: { type: 'bgp', patterns: [] },
                    expression:
                        { type: 'expression',
                            expressionType: 'operator',
                            operator: 'in',
                            args:
                                [ { type: 'expression',
                                    expressionType: 'term',
                                    term:
                                        { termType: 'Literal',
                                            value: '2',
                                            datatype:
                                                { termType: 'NamedNode',
                                                    value: 'http://www.w3.org/2001/XMLSchema#integer' } } },
                                  { type: 'expression',
                                      expressionType: 'term',
                                      term:
                                          { termType: 'Literal',
                                              value: '1',
                                              datatype:
                                                  { termType: 'NamedNode',
                                                      value: 'http://www.w3.org/2001/XMLSchema#integer' } } },
                                  { type: 'expression',
                                      expressionType: 'term',
                                      term:
                                          { termType: 'Literal',
                                              value: '2',
                                              datatype:
                                                  { termType: 'NamedNode',
                                                      value: 'http://www.w3.org/2001/XMLSchema#integer' } } },
                                  { type: 'expression',
                                      expressionType: 'term',
                                      term:
                                          { termType: 'Literal',
                                              value: '3',
                                              datatype:
                                                  { termType: 'NamedNode',
                                                      value: 'http://www.w3.org/2001/XMLSchema#integer' } } } ] } } };
        Util.compareAlgebras(expected, algebra);
    });

    it('NOT IN 1', () => {
        let sparql = `ASK {
FILTER(2 NOT IN ())
}`;
        let algebra = translate(sparql);
        let expected = { type: 'ask',
            input:
                { type: 'filter',
                    input: { type: 'bgp', patterns: [] },
                    expression:
                        { type: 'expression',
                            expressionType: 'operator',
                            operator: 'notin',
                            args:
                                [ { type: 'expression',
                                    expressionType: 'term',
                                    term:
                                        { termType: 'Literal',
                                            value: '2',
                                            datatype:
                                                { termType: 'NamedNode',
                                                    value: 'http://www.w3.org/2001/XMLSchema#integer' } } } ] } } };
        Util.compareAlgebras(expected, algebra);
    });

    it('syn-pname-01', () => {
        let sparql = `PREFIX : <http://example/>
ASK{}`;
        let algebra = translate(sparql);
        let expected = { type: 'ask', input: { type: 'bgp', patterns: [] } };
        Util.compareAlgebras(expected, algebra);
    });
});