
const Util = require('../util');

const translate = Util.translate;

// https://www.w3.org/TR/sparql11-query/#describe
describe('SPARQL 1.1 describe', () => {
    it('16.4.1', () => {
        let sparql = `DESCRIBE <http://example.org/>`;
        let algebra = translate(sparql);
        let expected = { type: 'describe',
            input: { type: 'bgp', patterns: [] },
            terms: [ { termType: 'NamedNode', value: 'http://example.org/' } ] };
        Util.compareAlgebras(expected, algebra);
    });

    it('16.4.2a', () => {
        let sparql = `PREFIX foaf:   <http://xmlns.com/foaf/0.1/>
DESCRIBE ?x
WHERE    { ?x foaf:mbox <mailto:alice@org> }`;
        let algebra = translate(sparql);
        let expected = { type: 'describe',
            input:
                { type: 'bgp',
                    patterns:
                        [ { subject: { termType: 'Variable', value: 'x' },
                            predicate: { termType: 'NamedNode', value: 'http://xmlns.com/foaf/0.1/mbox' },
                            object: { termType: 'NamedNode', value: 'mailto:alice@org' },
                            graph: { termType: 'DefaultGraph', value: '' },
                            type: 'pattern' } ] },
            terms: [ { termType: 'Variable', value: 'x' } ] };
        Util.compareAlgebras(expected, algebra);
    });

    it('16.4.2c', () => {
        let sparql = `PREFIX foaf:   <http://xmlns.com/foaf/0.1/>
DESCRIBE ?x ?y <http://example.org/>
WHERE    {?x foaf:knows ?y}`;
        let algebra = translate(sparql);
        let expected = { type: 'describe',
            input:
                { type: 'bgp',
                    patterns:
                        [ { subject: { termType: 'Variable', value: 'x' },
                            predicate: { termType: 'NamedNode', value: 'http://xmlns.com/foaf/0.1/knows' },
                            object: { termType: 'Variable', value: 'y' },
                            graph: { termType: 'DefaultGraph', value: '' },
                            type: 'pattern' } ] },
            terms:
                [ { termType: 'Variable', value: 'x' },
                  { termType: 'Variable', value: 'y' },
                  { termType: 'NamedNode', value: 'http://example.org/' } ] };
        Util.compareAlgebras(expected, algebra);
    });
});