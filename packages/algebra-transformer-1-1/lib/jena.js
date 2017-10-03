
const _ = require('lodash');
const algebra = require('./algebra');
const Algebra = algebra.Algebra;
const AlgebraElement = algebra.AlgebraElement;

let synonyms = {};
synonyms[Algebra.ZERO_OR_MORE_PATH] = 'path*';
synonyms[Algebra.ONE_OR_MORE_PATH] = 'path+';
synonyms[Algebra.ZERO_OR_ONE_PATH] = 'path?';


function toJena(input)
{
    if (_.isArray(input))
        return input.map(toJena);

    if (!input.symbol || !input.args)
        return input;

    if (input.subject && input.predicate && input.object)
        return new AlgebraElement(Algebra.TRIPLE, [input.subject, input.predicate, input.object]);

    if (mappings[input.symbol])
        input = mappings[input.symbol](input);
    else
        input = new AlgebraElement(input.symbol, toJena(input.args));

    if (synonyms[input.symbol])
        input.symbol = synonyms[input.symbol];

    return input;
}

let mappings = {};

mappings[Algebra.BGP] = input =>
{
    // (table unit)
    if (input.args.length === 0)
        return new AlgebraElement(Algebra.TABLE, [Algebra.UNIT]);

    // triples will be changed to triple function with 3 parameters
    return new AlgebraElement(Algebra.BGP, input.args.map(toJena));
};

mappings[Algebra.EXTEND] = input =>
{
    let v = input.args[1];
    let val = toJena(input.args[2]);
    let extensions = [[v, [val]]];
    let body = toJena(input.args[0]);

    // combine nested extends
    if (body.symbol && body.symbol === Algebra.EXTEND)
    {
        extensions = extensions.concat(body.args[0]);
        body = body.args[1];
    }
    // extend ((?v VALUES)) BODY
    return new AlgebraElement(Algebra.EXTEND, [[new AlgebraElement(v, [val])], body])
};

mappings[Algebra.LINK] = input =>
{
    return toJena(input.args[0]);
};

mappings[Algebra.ORDER_BY] = input =>
{
    let args = input.args.map(toJena);
    return new AlgebraElement(Algebra.PROJECT, [args[1], args[0]]);
};

mappings[Algebra.PROJECT] = input =>
{
    let args = input.args.map(toJena);
    return new AlgebraElement(Algebra.PROJECT, [args[1], args[0]]);
};

module.exports = toJena;