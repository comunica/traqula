/**
 * Created by joachimvh on 26/02/2015.
 */

var assert = require('assert');

// http://www.w3.org/TR/sparql11-query/#sparqlQuery
// http://www.sparql.org/query-validator.html

// global set of all variables in the query
var VARIABLES = {};

var input =
    {
        "type": "query",
        "prefixes": {
            "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        },
        "queryType": "SELECT",
        "variables": [
            {
                "expression": {
                    "expression": "?val",
                    "type": "aggregate",
                    "aggregation": "sum",
                    "distinct": false
                },
                "variable": "?sum"
            },
            {
                "expression": "COUNT",
                "variable": "?count"
            }
        ],
        "where": [
            {
                "type": "bgp",
                "triples": [
                    {
                        "subject": "?a",
                        "predicate": "http://www.w3.org/1999/02/22-rdf-syntax-ns#value",
                        "object": "?val"
                    }
                ]
            }
        ],
        "group": [
            {
                "expression": "?a"
            }
        ]
    };

// TODO: embed simplify and translateGraphPattern in same function
var result = translate(input);
console.log(JSON.stringify(result, null, 4));

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
    VARIABLES[v] = true;
    return v;
}

// TODO: other stuff (select, limit, order, etc. etc.)
function translate (query)
{
    assert(query.type === 'query', "Translate only works on complete query objects.");
    var group = {type:'group', patterns:query.where};
    var vars = inScopeVariables(group);
    var res = translateGraphPattern(group);
    assertTranslate(res);
    res = simplify(res);
    query.where = res;
    res = translateAggregates(query, vars);
    return res;
}

function mergeObjects (obj1, obj2)
{
    for (var key in obj2)
        obj1[key] = obj2[key];
}

function isString(s)
{
    return (typeof s === 'string' || s.constructor === String);
}

function inScopeVariables (thingy)
{
    var variables = {};

    if (isString(thingy) && thingy[0] === '?')
        variables[thingy] = true;
    else if (thingy.type === 'bgp')
    {
        thingy.triples.forEach(function (triple)
        {
            mergeObjects(variables, inScopeVariables(triple.subject));
            mergeObjects(variables, inScopeVariables(triple.predicate));
            mergeObjects(variables, inScopeVariables(triple.object));
        });
    }
    else if (thingy.type === 'path')
    {
        thingy.items.forEach(function (item)
        {
            mergeObjects(variables, inScopeVariables(item));
        });
    }
    // group, union, optional
    else if (thingy.patterns)
    {
        thingy.patterns.forEach(function (pattern)
        {
            mergeObjects(variables, inScopeVariables(pattern));
        });
        // graph
        if (thingy.name)
            mergeObjects(variables, inScopeVariables(thingy.name));
    }
    // bind, aggregates
    else if (thingy.variable)
    {
        mergeObjects(variables, inScopeVariables(thingy.variable));
    }
    else if (thingy.queryType === 'SELECT')
    {
        thingy.variables.forEach(function (v)
        {
            if (v === '*')
                mergeObjects(variables, inScopeVariables(thingy.where));
            else
                mergeObjects(variables, inScopeVariables(v));
        });
        // TODO: I'm not 100% sure if you always add these or only when '*' was selected
        thingy.group.forEach(function (v)
        {
            mergeObjects(variables, inScopeVariables(v));
        });
    }
    else if (thingy.type === 'values')
    {
        thingy.values.forEach(function (subthingy)
        {
            Object.keys(subthingy).forEach(function (v)
            {
                variables[v] = true;
            });
        });
    }

    return variables;
}

function assertTranslate (algebraQuery)
{
    if (typeof algebraQuery === 'string' || algebraQuery.constructor === String)
        return;
    assert(algebraQuery.symbol);
}

function translateGraphPattern (thingy)
{
    if (isString(thingy))
    {
        if (thingy[0] === '?')
            VARIABLES[thingy[0]] = true;
        return thingy;
    }

    // ignore if already parsed
    if (thingy.symbol)
        return thingy;

    // make sure optional and minus have group subelement
    // done before recursion!
    if (thingy.type === 'optional' || thingy.type === 'minus')
        thingy.patterns = [{type:'group', patterns:thingy.patterns}]; // sparqljs format so it can be translated

    // we postpone this for subqueries so the in scope variable calculation is correct
    if (thingy.type !== 'query')
    {
        for (var key in thingy)
        {
            if (thingy[key].constructor === Array)
                thingy[key].forEach(function (subthingy, idx)
                {
                    thingy[key][idx] = translateGraphPattern(subthingy);
                });
            else
                thingy[key] = translateGraphPattern(thingy[key]);
        }
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
    if (thingy.type === 'group')
        thingy = translateGroupGraphPattern(thingy);
    // TODO: InlineData (jena uses own 'table' entry?). Will have to make custom function combination that has the given values as a result?
    // (table (vars ?book ?title)
    // (row [?title "SPARQL Tutorial"])
    // (row [?book :book2])
    // )
    if (thingy.type === 'values')
        throw "VALUES is not supported yet.";
    if (thingy.type === 'query')
        thingy = translateSubSelect(thingy);

    // 18.2.2.7
    if (filters.length > 0)
        thingy = createAlgebraElement('filter', [translateFilters(filters), thingy]);

    return thingy;
}

// 18.2.2.8
function simplify (thingy)
{
    if (thingy.args)
        thingy.args.forEach(function (subthingy, idx)
        {
           thingy.args[idx] = simplify(subthingy);
        });
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

// ---------------------------------- TRANSLATE GRAPH PATTERN HELPER FUNCTIONS ----------------------------------
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
        if (arg.type === 'optional')
        {
            assert(arg.patterns.length === 1, "Expected exactly 1 arg for 'optional'.");
            var a = arg.patterns[0];
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

function translateSubSelect (query)
{
    return createAlgebraElement('tomultiset', [translate(query)]);
}

function translateFilters (filters)
{
    filters.forEach(function (filter, idx)
    {
        assert(filter.expression && filter.expression.symbol, "Expected filter to already have an updated expression.");
        filters[idx] = createAlgebraElement(filter.expression.symbol, filter.expression.args);
    });
    if (filters.length === 1)
        return filters[0];
    else
        return createAlgebraElement('&&', filters);
}
// ---------------------------------- END TRANSLATE GRAPH PATTERN HELPER FUNCTIONS ----------------------------------

// TODO: how to handle expressions
function translateAggregates (query, variables)
{
    // 18.2.4.1
    var g = null;
    var a = [];
    if (query.group)
        // TODO: query.group is an array, not an object
        g = createAlgebraElement('group', [query.group, query.where]);
    else if (containsAggregate(query.variables) || containsAggregate(query.having) || containsAggregate(query.order))
        g = createAlgebraElement('group', [1, query.where]);

    // TODO: not doing the sample stuff atm
    // TODO: more based on jena results than w3 spec
    if (g)
    {
        // TODO: check up on scalarvals and args
        mapAggregates(query.variables, a);
        mapAggregates(query.having, a);
        mapAggregates(query.order, a);

        // TODO: we use the jena syntax of adding aggregates as second argument to group, because of our structure we use the aggregates object
        if (a.length > 0)
        {
            var aggregates = a.map(function (aggregate)
            {
                // TODO: not sure if this feels right, also: object prolly not yet in correct format?
                // TODO: don't forget about distinct also
                return createAlgebraElement(aggregate.variable, [aggregate.object]);
            });
            g.args.splice(1, 0, createAlgebraElement('aggregates', aggregates));
        }
        else
            g.args.splice(1, 0, null);

        query.where = g;
    }

    // TODO: variables outside of aggregate (again, should this really happen if there are aggregates?)

    // 18.2.4.2
    if (query.having)
    {
        query.having.forEach(function (filter)
        {
            // TODO: these are not yet algebra elements?
            query.where = createAlgebraElement('filter', [filter, query.where]);
        });
    }

    // 18.2.4.3
    // TODO: VALUES

    // 18.2.4.4
    var pv = {};

    // TODO: doesn't contain group by mappings
    var e = [];
    if (query.variables.indexOf('*') >= 0)
        pv = variables;
    else
    {
        query.variables.forEach(function (v)
        {
            if (isString(v) && v[0] === '?')
                pv[v] = true;
            else if (v.variable)
            {
                if (variables[v.variable] || pv[v.variable])
                    throw "Aggregate variable appearing multiple times: " + v.variable;
                pv[v.variable] = true;
                e.push(v);
            }
        });
    }

    e.forEach(function (v)
    {
        query.where = createAlgebraElement('extend', [query.where, v.variable, v.expression]);
    });

    // 18.2.5
    //query.where = createAlgebraElement('tolist', [query.where]); // TODO: this is probably not that necessary

    // 18.2.5.1
    if (query.order)
        query.where = createAlgebraElement('orderby', query.order);
    // 18.2.5.2
    // TODO: only place where one of the arguments is an array instead of an object...
    query.where = createAlgebraElement('project', [query.where, Object.keys(pv)]);
    // 18.2.5.3
    if (query.distinct)
        query.where = createAlgebraElement('distinct', [query.where]);
    // 18.2.5.4
    if (query.reduced)
        query.where = createAlgebraElement('reduced', [query.where]);
    // 18.2.5.5
    // we use -1 to indiciate there is no limit
    if (query.offset || query.limit)
        query.where = createAlgebraElement('slice', [query.offset || 0, query.limit || -1]);

    return query.where;
}

// TODO: keep this format?
function createAggregate (expression, aggregation, distinct, variable)
{
    var res = {expression:expression, type:'aggregate', aggregation:aggregation, distinct:distinct};
    if (variable)
        res.variable = variable;
    return res;
}

function containsAggregate (thingy)
{
    if (!thingy)
        return false;

    if (thingy.type === 'aggregate')
        return true;

    if (thingy.constructor === Array)
        return thingy.some(function (subthingy)
        {
            return containsAggregate(subthingy);
        });

    // appears in 'having'
    if (thingy.args)
        return containsAggregate(thingy.args);

    return false;
}

function compareObjects (o1, o2)
{
    if (isString(o1) !== isString(o2))
        return false;
    if (isString(o1))
        return o1 === o2;
    var k1 = Object.keys(o1);
    var k2 = Object.keys(o2);
    if (k1.length !== k2.length)
        return false;
    for (var i = 0; i < k1.length; ++i)
    {
        var key = k1[i];
        if (!compareObjects(o1[key], o2[key]))
            return false;
    }
    return true;
}

// TODO: could use hash, prolly not that necessary
function getMapping (thingy, map)
{
    for (var i = 0; i < map.length; ++i)
    {
        if (compareObjects(thingy, map[i].object))
            return map[i].variable;
    }
    return null;
}

function mapAggregates (thingy, map)
{
    if (!thingy)
        return thingy;

    if (thingy.type === 'aggregate')
    {
        var v = getMapping(thingy, map);
        if (!v)
        {
            v = generateFreshVar();
            map.push({object:thingy, variable:v});
        }
        return v;
    }

    // non-aggregate expression
    if (thingy.expression)
        thingy.expression = mapAggregates(thingy.expression, map);
    else if (thingy.args)
        mapAggregates(thingy.args, map);
    else if (thingy.constructor === Array)
        thingy.forEach(function (subthingy, idx)
        {
            thingy[idx] = mapAggregates(subthingy, map);
        });

    // TODO: can we have anything else?

    return thingy;
}