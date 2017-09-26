
const _ = require('lodash');
const assert = require('assert');
const algebra = require('../lib/sparqlAlgebra');
const AlgebraElement = algebra.AlgebraElement;
const Triple = algebra.Triple;

let count = 0;

class Util
{
    static algebraElement (key, args)
    {
        return new AlgebraElement(key, args || []);
    }
    
    static triple (subject, predicate, object)
    {
        return new Triple(subject, predicate, object);
    }
    
    static compareAlgebras (a1, a2)
    {
        let result = Util._compareAlgebrasRecursive(a1, a2, {});
        if (!result)
            assert.deepEqual(a1, a2); // just to provide readable output
        return result;
    }
    
    static _compareAlgebrasRecursive (a1, a2, blanks)
    {
        if (_.isString(a1) || _.isSymbol(a1) || _.isBoolean(a1) || _.isInteger(a2))
            return a1 === a2;
        
        if (a1 instanceof Triple)
        {
            if (!(a2 instanceof Triple))
                return false;
            
            let cloned = false;
            return ['subject', 'predicate', 'object'].every(pos =>
            {
                let v1 = a1[pos];
                let v2 = a2[pos];
                if (a1[pos].startsWith('_:'))
                {
                    if (!a2[pos].startsWith('_:'))
                        return false;
                    if (blanks[v1])
                        return blanks[v1] === v2;
                    
                    blanks[v1] = v2;
                    return true;
                }
                else
                    return v1 === v2;
            });
        }
        
        if (_.isArray(a1))
        {
            if (!_.isArray(a2) || a1.length !== a2.length)
                return false;
            
            if (a1.length === 0)
                return true;
            for (let i = 0; i < a2.length; ++i)
            {
                let newBlanks = _.clone(blanks);
                let match = Util._compareAlgebrasRecursive(a1[0], a2[i], newBlanks);
                if (match)
                {
                    // make sure no entries of a2 get used twice
                    let a2Clone = _.clone(a2);
                    a2Clone.splice(i, 1);
                    let subMatch = Util._compareAlgebrasRecursive(a1.slice(1), a2Clone, newBlanks);
                    if (subMatch)
                    {
                        _.assign(blanks, newBlanks);
                        return true;
                    }
                }
            }
            return false;
        }
        
        let keys1 = Object.keys(a1);
        let keys2 = Object.keys(a2);
        if (keys1.length !== keys2.length)
            return false;
        
        return keys1.every(key =>
        {
            if (a2[key] === undefined)
                return false;
            return Util._compareAlgebrasRecursive(a1[key], a2[key], blanks);
        });
    }
}

module.exports = Util;