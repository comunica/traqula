/**
 * Created by joachimvh on 26/02/2015.
 */

var assert = require('assert');

// http://www.w3.org/TR/sparql11-query/#sparqlQuery

// global set of all variables in the query
var VARIABLES = {};

var input =
    {
        "type": "query",
        "prefixes": {
            "dc": "http://purl.org/dc/elements/1.1/",
            "ns": "http://example.org/ns#"
        },
        "queryType": "SELECT",
        "variables": [
            "?title",
            "?price"
        ],
        "where": [
            {
                "type": "bgp",
                "triples": [
                    {
                        "subject": "?x",
                        "predicate": "http://purl.org/dc/elements/1.1/title",
                        "object": "?title"
                    }
                ]
            },
            {
                "type": "optional",
                "patterns": [
                    {
                        "type": "bgp",
                        "triples": [
                            {
                                "subject": "?x",
                                "predicate": "http://example.org/ns#price",
                                "object": "?price"
                            }
                        ]
                    },
                    {
                        "type": "filter",
                        "expression": {
                            "type": "operation",
                            "operator": "<",
                            "args": [
                                "?price",
                                "\"30\"^^http://www.w3.org/2001/XMLSchema#integer"
                            ]
                        }
                    }
                ]
            }
        ]
    };

// TODO: embed simplify and translate in same function
console.log(JSON.stringify(simplify(translate(input)), null, 4));

// TODO: maybe use same casing as w3.org

function createAlgebraElement (symbol, args)
{
    return {symbol:symbol, args:(args.constructor === Array ? args : [args])};
}

function generateFreshVar ()
{
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var v = '?var';
    for (var i = 0; i < 5; ++i)
        v += chars[Math.floor(Math.random()*chars.length)];
    if (VARIABLES[v])
        return generateFreshVar();
    return v;
}

// TODO: other stuff (select, limit, order, etc. etc.)
function translate (thingy)
{
    if (typeof thingy === 'string' || thingy.constructor === String)
    {
        if (thingy[0] === '?')
            VARIABLES[thingy[0]] = true;
        return thingy;
    }

    // need group object here
    if (thingy.where)
        return translate({type:'group', patterns:thingy.where});
    // make sure optional and minus have group subelement
    if (thingy.type === 'optional' || thingy.type === 'minus')
        thingy = createAlgebraElement(thingy.type, [translate({type:'group', patterns:thingy.patterns})]); // sparqljs format so it can be translated

    for (var key in thingy)
    {
        if (thingy[key].constructor === Array)
            thingy[key].forEach(function (subthingy, idx)
            {
                thingy[key][idx] = translate(subthingy);
            });
        else
            thingy[key] = translate(thingy[key]);
    }

    // update expressions to algebra format (done here since they are used in both filters and binds)
    if (thingy.type === 'operation')
        thingy = createAlgebraElement(thingy.operator, thingy.args);

    // 18.2.2.1
    // already done by sparql parser

    // 18.2.2.2
    var filters = [];
    var nonfilters = [];
    if (thingy.type === 'filter' && thingy.expression.symbol === 'notexists')
    {
        thingy.expression.args = [createAlgebraElement('exists', thingy.expression.args)];
        thingy.expression.symbol = 'fn:not';
    }
    else if (thingy.patterns)
    {
        thingy.patterns.forEach(function (subthingy)
        {
            (subthingy.type === 'filter' ? filters : nonfilters).push(subthingy);
        });
        thingy.patterns = nonfilters;
    }

    // 18.2.2.3
    if (thingy.type === 'path')
        thingy = translatePathExpression(thingy);

    // 18.2.2.4
    // need to do this at BGP level so seq paths can be merged into BGP
    if (thingy.type === 'bgp')
    {
        var newTriples = [];
        thingy.triples.forEach(function (subthingy)
        {
            newTriples.push.apply(newTriples, translatePath(subthingy));
        });
        thingy.triples = newTriples;
    }

    // 18.2.2.5
    if (thingy.type === 'bgp')
        thingy = createAlgebraElement('bgp', thingy.triples);

    // 18.2.2.6
    if (thingy.type === 'union')
        thingy = translateGroupOrUnionGraphPattern(thingy);
    if (thingy.type === 'graph')
        thingy = translateGraphGraphPattern(thingy);
    // object will have changed by now
    if (thingy.type === 'group')
    {
        thingy = translateGroupGraphPattern(thingy);
    }

    // TODO: InlineData
    // TODO: SubSelect

    // 18.2.2.7
    if (filters.length > 0)
        thingy = createAlgebraElement('filter', [translateFilters(filters), thingy]);


    // TODO: are there elements that won't have changed after a complete run? (optional, minus, bind get done in translateGroupGraphPattern)

    return thingy;
}

// 18.2.2.8
function simplify(thingy)
{
    if (thingy.args)
        thingy.args.forEach(function (subthingy, idx)
        {
           thingy.args[idx] = simplify(subthingy);
        });
    // TODO: what with leftjoin?
    if (thingy.symbol === 'join')
    {
        assert(thingy.args.length === 2, "Expected 2 args for 'join' element.");
        if (thingy.args[0].symbol === 'bgp' && thingy.args[0].args.length === 0)
            thingy = thingy.args[1];
        else if (thingy.args[1].symbol === 'bgp' && thingy.args[1].args.length === 0)
            thingy = thingy.args[0];
    }
    return thingy;
}

function translatePathExpression (pathExp)
{
    // iri
    pathExp.items.forEach(function (item, idx)
    {
        if (typeof item === 'string' || item.constructor === String)
            pathExp.items[idx] = createAlgebraElement('link', [item]);
    });

    if (pathExp.pathType === '^')
        pathExp.pathType = 'inv';

    else if (pathExp.pathType === '!')
    {
        var normals = [];
        var inverted = [];
        assert(pathExp.items.length === 1, "Expected exactly 1 item for '!' path operator.");
        var item = pathExp.items[0];

        if (!item.pathType)
            normals.push(item);
        else if (item.pathType === '^')
        {
            assert(item.items.length === 1, "Expected exactly 1 item for '^' path operator.");
            inverted.push(item.items[0]);
        }
        else if (item.pathType === '|')
        {
            item.items.forEach(function (subitem)
            {
                if (subitem.pathType === '^')
                {
                    assert(subitem.items.length === 1, "Expected exactly 1 item for '^' path operator.");
                    inverted.push(subitem.items[0]);
                }
                else
                    normals.push(subitem);
            });
        }

        var normalElement = createAlgebraElement('NPS', normals);
        var invertedElement = createAlgebraElement('inv', [createAlgebraElement('NPS', inverted)]);

        if (inverted.length === 0)
            pathExp = normalElement;
        else if (normals.length === 0)
            pathExp = invertedElement;
        else
            pathExp = createAlgebraElement('alt', [normalElement, invertedElement]);
    }

    else if (pathExp.pathType === '/')
    {
        assert(pathExp.items.length >= 2, "Expected at least 2 items for '/' path operator.");
        pathExp.pathType = 'seq';
        var result = pathExp.items[0];
        for (var i = 1; i < pathExp.items.length; ++i)
            result = createAlgebraElement('seq', [result, pathExp.items[i]]);
        pathExp = result;
    }
    else if (pathExp.pathType === '|')
        pathExp.pathType = 'alt';
    else if (pathExp.pathType === '*')
        pathExp.pathType = 'ZeroOrMorePath';
    else if (pathExp.pathType === '+')
        pathExp.pathType = 'OneOrMorePath';
    else if (pathExp.pathType === '?')
        pathExp.pathType = 'ZeroOrOnePath';

    if (pathExp.pathType)
        pathExp = createAlgebraElement(pathExp.pathType, pathExp.items);
    return pathExp;
}

function translatePath (path)
{
    // assume path expressions have already been updated
    if (!path.predicate.symbol)
        return [path];
    var pred = path.predicate;
    if (pred.symbol === 'link')
    {
        assert(pred.args.length === 1, "Expected exactly 1 argument for 'link' symbol.");
        path.predicate = pred.args[0];
    }
    else if (pred.symbol === 'inv') // TODO: I think this applies to inv(path) instead of inv(iri) like the spec says, I might be wrong
    {
        assert(pred.args.length === 1, "Expected exactly 1 argument for 'inv' symbol.");
        path.predicate = pred.args[0];
        var temp = path.subject;
        path.subject = path.object;
        path.object = temp;
        path = translatePath(path);
    }
    else if (pred.symbol === 'seq')
    {
        assert(pred.args.length === 2, "Expected exactly 2 arguments for 'seq' symbol.");
        var v = generateFreshVar();
        var triple1 = {subject:path.subject, predicate:pred.args[0], object:v};
        var triple2 = {subject:v, predicate:pred.args[1], object:path.object};
        path = translatePath(triple1).concat(translatePath(triple2));
    }
    else
        path = createAlgebraElement('path', [path.subject, path.predicate, path.object]);

    if (path.constructor !== Array)
        path = [path];

    return path;
}

function translateGroupOrUnionGraphPattern (group)
{
    // TODO: can there be a problem with the removed filters?
    assert(group.patterns.length >= 1, "Expected at least one item in GroupOrUnionGraphPattern.");
    var accumulator = null;
    group.patterns.forEach(function (pattern)
    {
        if (!accumulator)
            accumulator = pattern;
        else
            accumulator = createAlgebraElement('union', [accumulator, pattern]);
    });

    return accumulator;
}

function translateGraphGraphPattern (group)
{
    assert(group.patterns.length === 1, "Expected exactly 1 item for GraphGraphPattern.");
    return createAlgebraElement('graph', group.patterns[0]);
}

function translateGroupGraphPattern (group)
{
    //assert(group.symbol && group.args, "Expected input to already be in algebra format.");
    var g = createAlgebraElement('bgp', []);

    group.patterns.forEach(function (arg, idx)
    {
        assert(arg.symbol !== 'filter', "Filters should have been removed previously.");
        if (arg.symbol === 'optional')
        {
            assert(arg.args.length === 1, "Expected exactly 1 arg for 'optional'.");
            var a = arg.args[0];
            if (a.symbol === 'filter')
            {
                assert(a.args.length === 2, "Expected exactly 2 args for 'filter'.");
                g = createAlgebraElement('leftjoin', [g, a.args[1], a.args[0]]);
            }
            else
                g = createAlgebraElement('leftjoin', [g, a, 'true']);
        }
        else if (arg.symbol === 'minus')
        {
            assert(arg.args.length === 1, "minus element should only have 1 arg at this point.");
            g = createAlgebraElement('minus', [g, arg.args[0]]);
        }
        // TODO: sure bind won't have been updated by now?
        else if (arg.type === 'bind')
            g = createAlgebraElement('extend', [g, arg.variable, arg.expression]);
        else
            g = createAlgebraElement('join', [g, arg]);
    });

    return g;
}

function translateInlineData (values)
{
    // TODO: ...
}

function translateSubSeletct (select)
{
    return {type:'tomultiset', items:[select]};
}

function translateFilters (filters)
{
    filters.forEach(function (filter, idx)
    {
        assert(filter.expression && filter.expression.symbol, "Expected filter to already have an updated expression.");
        // TODO: is it correct to make these correspond to algebra elements?
        filters[idx] = createAlgebraElement(filter.expression.symbol, filter.expression.args);
    });
    if (filters.length === 1)
        return filters[0];
    else
        return createAlgebraElement('&&', filters);
}