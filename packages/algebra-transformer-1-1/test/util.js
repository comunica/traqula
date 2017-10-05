
const _ = require('lodash');
const assert = require('assert');
const algebra = require('../lib/algebra');
const translate = require('../lib/sparqlAlgebra');
const Algebra = algebra.Algebra;
const AlgebraElement = algebra.AlgebraElement;
const Triple = algebra.Triple;

class Util
{
    static algebraElement (key, args)
    {
        switch (key)
        {
            case Algebra.BGP: return { name: key, patterns: args };
            case Algebra.DISTINCT: return { name: key, body: args[0] };
            case Algebra.EXTEND: return { name: key, body: args[0], var: args[1], expr: args[2] };
            case Algebra.FILTER: return { name: key, expr: args[0], body: args[1] };
            case Algebra.GRAPH: return { name: key, graph: args[0], body: args[1] };
            case Algebra.GROUP: return { name: key, vars: args[0], aggregates: args[1], body: args[2] };
            case Algebra.JOIN: return { name: key, left: args[0], right: args[1] };
            case Algebra.LEFT_JOIN: return args[2] === true ? { name: key, left: args[0], right: args[1] } : { name: key, left: args[0], right: args[1], expr: args[2] };
            case Algebra.MINUS: return { name: key, left: args[0], right: args[1] };
            case Algebra.ORDER_BY: return { name: key, body: args[0], conditions: args[1] };
            case Algebra.PROJECT: return { name: key, body: args[0], vars: args[1] };
            case Algebra.REDUCED: return { name: key, body: args[0] };
            case Algebra.SLICE: return args[1] === -1 ? { name: key, body: args[2], start: args[0] } : { name: key, body: args[2], start: args[0], length: args[1] };
            case Algebra.TRIPLE: return { name: key, subject: args[0], predicate: args[1], object: args[2] };
            case Algebra.UNION: return { name: key, left: args[0], right: args[1] };

            case Algebra.ALT: return { name: key, left: args[0], right: args[1] };
            case Algebra.INV: return { name: key, path: args[0] };
            case Algebra.LINK: return { name: key, iri: args[0] };
            case Algebra.NPS: return { name: key, iris: args };
            case Algebra.ONE_OR_MORE_PATH: return { name: key, path: args[0] };
            case Algebra.PATH: return { name: key, subject: args[0], predicate: args[1], object: args[2] };
            case Algebra.SEQ: return { name: key, left: args[0], right: args[1] };
            case Algebra.ZERO_OR_ONE_PATH: return { name: key, path: args[0] };
            case Algebra.ZERO_OR_MORE_PATH: return { name: key, path: args[0] };
        }

        if (key === Algebra.TABLE)
        {
            let vars = args[0].args;
            let bindings = [];
            for (let i = 1; i < args.length; ++i)
            {
                let binding = {};
                let row = args[i].args;
                for (let entry of row)
                    binding[entry[0]] = entry[1];
                bindings.push(binding);
            }
            return { name: Algebra.VALUES, vars, bindings };
        }

        // not returned -> probably operator
        return { operator: key, args};
    }
    
    static triple (subject, predicate, object)
    {
        return Util.algebraElement(Algebra.TRIPLE, [ subject, predicate, object ]);
    }
    
    static compareAlgebras (expected, actual)
    {
        let result = Util._compareAlgebrasRecursive(expected, actual, {});
        if (!result)
            assert.deepEqual(actual, expected);
        return result;
    }
    
    static _compareAlgebrasRecursive (a1, a2, blanks)
    {
        if (_.isString(a1) || _.isSymbol(a1) || _.isBoolean(a1) || _.isInteger(a2))
        {
            if (_.isString(a1) && (a1.startsWith('_:') || a1.startsWith('?')))
            {
                if (a2[0] !== a1[0])
                    return false;
                if (blanks[a1])
                    return blanks[a1] === a2;

                blanks[a1] = a2;
                return true;
            }

            return a1 === a2;
        }
        
        if (a1 instanceof Triple)
        {
            if (!(a2 instanceof Triple))
                return false;

            return ['subject', 'predicate', 'object'].every(pos => Util._compareAlgebrasRecursive(a1[pos], a2[pos], blanks));
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

    static testString (algebra)
    {
        if (algebra instanceof AlgebraElement)
        {
            let symbol = _.findKey(Algebra, val => val === algebra.symbol);
            symbol = symbol ? `A.${symbol}` : `'${algebra.symbol}'`;
            let args = algebra.args.map(Util.testString);
            return `AE(${symbol}, [ ${args.join(', ')} ])`;
        }
        else if (algebra instanceof Triple)
            return `T('${algebra.subject}', '${algebra.predicate}', '${algebra.object}')`;
        else if (algebra instanceof Array)
            return `[ ${algebra.map(Util.testString).join(', ')} ]`;
        else if (_.isString(algebra))
            return `'${algebra}'`;
        return algebra;
    }
}

Util.Algebra = Algebra;
Util.translate = translate;

module.exports = Util;