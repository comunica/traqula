
const _ = require('lodash');
const algebra = require('../lib/sparqlAlgebra');
const AlgebraElement = algebra.AlgebraElement;

let count = 0;

class Util
{
    static algebraElement (key, args)
    {
        return new AlgebraElement(key, args || []);
    }
    
    static triple (subject, predicate, object)
    {
        return { subject, predicate, object };
    }
    
    static extractVariables (triples)
    {
        return triples.reduce((acc, triple) =>
        {
            for (let pos of ['subject', 'predicate', 'object'])
                if (triple[pos][0] === '?' && acc.indexOf(triple[pos]) < 0)
                    acc.push(triple[pos]);
            return acc;
        }, []);
    }
}

module.exports = Util;