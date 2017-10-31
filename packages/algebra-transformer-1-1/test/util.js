
const _ = require('lodash');
const assert = require('assert');
const algebra = require('../lib/algebra');
const translate = require('../lib/sparqlAlgebra');
const Algebra = algebra.Algebra;

class Util
{
    static algebraElement (key, args)
    {
        switch (key)
        {
            case Algebra.BGP: return { type: key, patterns: args };
            case Algebra.DISTINCT: return { type: key, input: args[0] };
            case Algebra.EXTEND: return { type: key, input: args[0], variable: args[1], expression: args[2] };
            case Algebra.FILTER: return { type: key, expression: args[0], input: args[1] };
            case Algebra.GRAPH: return { type: key, graph: args[0], input: args[1] };
            case Algebra.GROUP: return { type: key, variables: args[0], aggregates: args[1], input: args[2] };
            case Algebra.JOIN: return { type: key, left: args[0], right: args[1] };
            case Algebra.LEFT_JOIN: return args[2] === true ? { type: key, left: args[0], right: args[1] } : { type: key, left: args[0], right: args[1], expression: args[2] };
            case Algebra.MINUS: return { type: key, left: args[0], right: args[1] };
            case Algebra.ORDER_BY: return { type: key, input: args[0], expressions: args[1] };
            case Algebra.PROJECT: return { type: key, input: args[0], variables: args[1] };
            case Algebra.REDUCED: return { type: key, input: args[0] };
            case Algebra.SLICE: return args[1] === -1 ? { type: key, input: args[2], start: args[0] } : { type: key, input: args[2], start: args[0], length: args[1] };
            case Algebra.TRIPLE: return { type: key, subject: args[0], predicate: args[1], object: args[2] };
            case Algebra.UNION: return { type: key, left: args[0], right: args[1] };

            case Algebra.ALT: return { type: key, left: args[0], right: args[1] };
            case Algebra.INV: return { type: key, path: args[0] };
            case Algebra.LINK: return { type: key, iri: args[0] };
            case Algebra.NPS: return { type: key, iris: args };
            case Algebra.ONE_OR_MORE_PATH: return { type: key, path: args[0] };
            case Algebra.PATH: return { type: key, subject: args[0], predicate: args[1], object: args[2] };
            case Algebra.SEQ: return { type: key, left: args[0], right: args[1] };
            case Algebra.ZERO_OR_ONE_PATH: return { type: key, path: args[0] };
            case Algebra.ZERO_OR_MORE_PATH: return { type: key, path: args[0] };
        }

        if (key === Algebra.TABLE)
        {
            let variables = args[0].args;
            let bindings = [];
            for (let i = 1; i < args.length; ++i)
            {
                let binding = {};
                let row = args[i].args;
                for (let entry of row)
                    binding[entry[0]] = entry[1];
                bindings.push(binding);
            }
            return { type: Algebra.VALUES, variables, bindings };
        }
        
        if (key === Algebra.AGGREGATE)
        {
            let result = { type: key, symbol: args[0], expression: args[1] };
            if (result.symbol === 'group_concat')
            {
                if (args.length === 4)
                {
                    result.separator = args[2];
                    result.variable = args[3];
                }
                else if (args[2][0] === '?')
                    result.variable = args[2];
                else
                    result.separator = args[2];
            }
            else if (args.length === 3)
                result.variable = args[2];
            
            return result;
        }

        // not returned -> probably expression
        return { type: 'expression', symbol: key, args};
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

    // TODO: will need to be rewritten if new tests get added
    // static testString (algebra)
    // {
    //     if (algebra instanceof AlgebraElement)
    //     {
    //         let symbol = _.findKey(Algebra, val => val === algebra.symbol);
    //         symbol = symbol ? `A.${symbol}` : `'${algebra.symbol}'`;
    //         let args = algebra.args.map(Util.testString);
    //         return `AE(${symbol}, [ ${args.join(', ')} ])`;
    //     }
    //     else if (algebra instanceof Triple)
    //         return `T('${algebra.subject}', '${algebra.predicate}', '${algebra.object}')`;
    //     else if (algebra instanceof Array)
    //         return `[ ${algebra.map(Util.testString).join(', ')} ]`;
    //     else if (_.isString(algebra))
    //         return `'${algebra}'`;
    //     return algebra;
    // }
}

Util.Algebra = Algebra;
Util.translate = translate;

module.exports = Util;