
const _ = require('lodash');

// TODO: add aggregates?
const Algebra = Object.freeze({
    ALT:                'alt',
    BGP:                'bgp',
    DESC:               'desc',
    DISTINCT:           'distinct',
    EXISTS:             'exists',
    EXTEND:             'extend',
    FILTER:             'filter',
    FN_NOT:             'fn:not',
    GRAPH:              'graph',
    GROUP:              'group',
    INV:                'inv',
    JOIN:               'join',
    LEFT_JOIN:          'leftjoin',
    LINK:               'link',
    MINUS:              'minus',
    NPS:                'nps',
    ONE_OR_MORE_PATH:   'OneOrMorePath',
    ORDER_BY:           'orderby',
    PATH:               'path',
    PROJECT:            'project',
    REDUCED:            'reduced',
    ROW:                'row',
    SEPARATOR:          'separator',
    SEQ:                'seq',
    SLICE:              'slice',
    TABLE:              'table',
    TO_MULTISET:        'tomultiset',
    UNION:              'union',
    VARS:               'vars',
    ZERO_OR_MORE_PATH:  'ZeroOrMorePath',
    ZERO_OR_ONE_PATH:   'ZeroOrOnePath',
});


class AlgebraElement
{
    constructor (symbol, args)
    {
        this.symbol = symbol;
        this.args = _.isArray(args) ? args : [args];
    }

    toString ()
    {
        function mapArg (arg)
        {
            if (_.isArray(arg))
                return '[' + _.map(arg, function (subArg) { return subArg.toString(); }).join(', ') + ']';
            return arg + '';
        }

        let symbol = this.symbol;
        if (_.isSymbol(symbol))
            symbol = symbol.toString().match(/^Symbol\((.*)\)$/)[1];

        return symbol + '(' + _.map(this.args, mapArg).join(', ') + ')';
    }
}

class Triple
{
    constructor (subject, predicate, object)
    {
        this.subject = subject;
        this.predicate = predicate;
        this.object = object;
    }

    toString ()
    {
        function handleURI (obj) {
            if (_.startsWith(obj, 'http://'))
                return '<' + obj + '>';
            return obj;
        }
        return handleURI(this.subject) + ' ' + handleURI(this.predicate) + ' ' + handleURI(this.object) + '.';
    }
}

module.exports = {
    Algebra,
    AlgebraElement,
    Triple
};