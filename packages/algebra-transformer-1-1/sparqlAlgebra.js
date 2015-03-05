/**
 * Created by joachimvh on 26/02/2015.
 */

var assert = require('assert');

// http://www.w3.org/TR/sparql11-query/#sparqlQuery
// http://www.sparql.org/query-validator.html

// global set of all variables in the query
var VARIABLES = {};
var varCount = 0;

var input =
    {
        "type": "query",
        "prefixes": {
            "foaf": "http://xmlns.com/foaf/0.1/"
        },
        "queryType": "SELECT",
        "variables": [
            "*"
        ],
        "where": [
            {
                "type": "bgp",
                "triples": [
                    {
                        "subject": "?x",
                        "predicate": {
                            "type": "path",
                            "pathType": "/",
                            "items": [
                                "http://xmlns.com/foaf/0.1/knows",
                                {
                                    "type": "path",
                                    "pathType": "^",
                                    "items": [
                                        "http://xmlns.com/foaf/0.1/knows"
                                    ]
                                }
                            ]
                        },
                        "object": "?y"
                    }
                ]
            },
            {
                "type": "filter",
                "expression": {
                    "type": "operation",
                    "operator": "!=",
                    "args": [
                        "?x",
                        "?y"
                    ]
                }
            }
        ]
    };

var result = translate(input);
console.log(JSON.stringify(result, null, 4));

function createAlgebraElement (symbol, args)
{
    return {symbol:symbol, args:(args.constructor === Array ? args : [args])};
}

function generateFreshVar ()
{
    var v = '?var' + varCount++;
    if (VARIABLES[v])
        return generateFreshVar();
    VARIABLES[v] = true;
    return v;


}

// ---------------------------------- TRANSLATE ----------------------------------
function translate (query)
{
    assert(query.type === 'query', "Translate only works on complete query objects.");
    var group = {type:'group', patterns:query.where};
    var vars = inScopeVariables(group);
    var res = translateGraphPattern(group);
    assertTranslate(res);
    res = simplify(res);
    res = translateAggregates(query, res, vars);
    return res;
}

// ---------------------------------- TRANSLATE HELPER FUNCTIONS ----------------------------------
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
    // bind, group by
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

// ---------------------------------- TRANSLATE GRAPH PATTERN ----------------------------------
// TODO: look at all places where we generate sparqljs format instead of algebra format
function translateGraphPattern (thingy)
{
    if (isString(thingy))
    {
        if (thingy[0] === '?')
            VARIABLES[thingy[0]] = true;
        return thingy;
    }

    if (thingy.constructor === Array)
        return thingy.map(function (subthingy) { return translateGraphPattern(subthingy); });

    // ignore if already parsed
    if (thingy.symbol)
        return thingy;

    // make sure optional and minus have group subelement
    // done before recursion!
    if (thingy.type === 'optional' || thingy.type === 'minus')
        thingy = {type:thingy.type, patterns:[{type:'group', patterns:thingy.patterns}]}; // sparqljs format so it can be translated

    // we postpone this for subqueries so the in scope variable calculation is correct
    if (thingy.type !== 'query')
    {
        var newthingy = {};
        for (var key in thingy)
            newthingy[key] = translateGraphPattern(thingy[key]);
        thingy = newthingy;
    }
    // from this point on we can change contents of the input parameter since it was changed above (except for subqueries)

    // update expressions to algebra format (done here since they are used in both filters and binds)
    if (thingy.type === 'operation')
        thingy = createAlgebraElement(thingy.operator, thingy.args);

    // 18.2.2.1
    // already done by sparql parser

    // 18.2.2.2
    var filters = [];
    var nonfilters = [];
    if (thingy.type === 'filter' && thingy.expression.symbol === 'notexists')
        thingy = {type:thingy.type, expression:createAlgebraElement('fn:not', [createAlgebraElement('exists', thingy.expression.args)])};
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
        thingy = translatePathExpression(thingy, thingy.items);

    // 18.2.2.4
    // need to do this at BGP level so seq paths can be merged into BGP
    if (thingy.type === 'bgp')
    {
        var newTriples = [];
        thingy.triples.forEach(function (subthingy)
        {
            newTriples.push.apply(newTriples, translatePath(subthingy, subthingy.predicate));
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
    if (isString(thingy))
        return thingy;
    if (thingy.constructor === Array)
        return thingy.map(function (subthingy) { return simplify(subthingy); });
    if (thingy.symbol === 'join')
    {
        assert(thingy.args.length === 2, "Expected 2 args for 'join' element.");
        if (thingy.args[0].symbol === 'bgp' && thingy.args[0].args.length === 0)
            return thingy.args[1];
        else if (thingy.args[1].symbol === 'bgp' && thingy.args[1].args.length === 0)
            return thingy.args[0];
    }
    else
        return createAlgebraElement(thingy.symbol, simplify(thingy.args));

    return thingy;
}

// ---------------------------------- TRANSLATE GRAPH PATTERN HELPER FUNCTIONS ----------------------------------
function translatePathExpression (pathExp, translatedItems)
{
    var res = null;
    var items = translatedItems.map(function (item)
    {
        if (typeof item === 'string' || item.constructor === String)
            return createAlgebraElement('link', [item]);
        return item;
    });

    if (pathExp.pathType === '^')
        res = createAlgebraElement('inv', items);
    else if (pathExp.pathType === '!')
    {
        var normals = [];
        var inverted = [];
        assert(items.length === 1, "Expected exactly 1 item for '!' path operator.");
        var item = items[0];

        if (item.symbol === 'link')
            normals.push(item);
        else if (item.symbol === 'inv')
        {
            assert(item.items.length === 1, "Expected exactly 1 item for '^' path operator.");
            inverted.push(item.items[0]);
        }
        else if (item.symbol === 'alt')
        {
            item.args.forEach(function (subitem)
            {
                if (subitem.symbol === 'inv')
                {
                    assert(subitem.args.length === 1, "Expected exactly 1 item for '^' path operator.");
                    inverted.push(subitem.args[0]);
                }
                else
                    normals.push(subitem);
            });
        }

        var normalElement = createAlgebraElement('NPS', normals);
        var invertedElement = createAlgebraElement('inv', [createAlgebraElement('NPS', inverted)]);

        if (inverted.length === 0)
            res = normalElement;
        else if (normals.length === 0)
            res = invertedElement;
        else
            res = createAlgebraElement('alt', [normalElement, invertedElement]);
    }

    else if (pathExp.pathType === '/')
    {
        assert(pathExp.items.length >= 2, "Expected at least 2 items for '/' path operator.");
        res = pathExp.items[0];
        for (var i = 1; i < items.length; ++i)
            res = createAlgebraElement('seq', [res, items[i]]);
    }
    else if (pathExp.pathType === '|')
        res = createAlgebraElement('alt', items);
    else if (pathExp.pathType === '*')
        res = createAlgebraElement('ZeroOrMorePath', items);
    else if (pathExp.pathType === '+')
        res = createAlgebraElement('OneOrMorePath', items);
    else if (pathExp.pathType === '?')
        res = createAlgebraElement('ZeroOrOnePath', items);

    assert (res, "Unable to translate path expression.");

    return res;
}

function createTriple (subject, predicate, object)
{
    return {subject:subject, predicate:predicate, object:object};
}

function translatePath (pathTriple, translatedPredicate)
{
    // assume path expressions have already been updated
    if (!translatedPredicate.symbol)
        return [pathTriple];
    var pred = translatedPredicate;
    var res = null;
    if (pred.symbol === 'link')
    {
        assert(pred.args.length === 1, "Expected exactly 1 argument for 'link' symbol.");
        res = createTriple(pathTriple.subject, pred.args[0], pathTriple.object);
    }
    else if (pred.symbol === 'inv') // TODO: I think this applies to inv(path) instead of inv(iri) like the spec says, I might be wrong
    {
        assert(pred.args.length === 1, "Expected exactly 1 argument for 'inv' symbol.");
        res = translatePath(createTriple(pathTriple.object, pathTriple.predicate, pathTriple.subject), pred.args[0]);
    }
    else if (pred.symbol === 'seq')
    {
        assert(pred.args.length === 2, "Expected exactly 2 arguments for 'seq' symbol.");
        var v = generateFreshVar();
        var triple1 =  createTriple(pathTriple.subject, pred.args[0], v);
        var triple2 = createTriple(v, pred.args[1], pathTriple.object);
        res = translatePath(triple1, triple1.predicate).concat(translatePath(triple2, triple2.predicate));
    }
    else
        res = createAlgebraElement('path', [createTriple(pathTriple.subject, pathTriple.predicate, pathTriple.object)]);

    if (res.constructor !== Array)
        res = [res];

    return res;
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

    group.patterns.forEach(function (arg)
    {
        // TODO: not weird that some of the patterns aren't translated yet?
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
    filters = filters.map(function (filter, idx)
    {
        assert(filter.expression && filter.expression.symbol, "Expected filter to already have an updated expression.");
        return createAlgebraElement(filter.expression.symbol, filter.expression.args);
    });
    if (filters.length === 1)
        return filters[0];
    else
        return createAlgebraElement('&&', filters);
}

// ---------------------------------- TRANSLATE AGGREGATES ----------------------------------
function translateAggregates (query, parsed, variables)
{
    var res = parsed;

    // 18.2.4.1
    var g = null;
    var a = [];
    var e = [];
    if (query.group)
        g = createAlgebraElement('group', [query.group, res]);
    else if (containsAggregate(query.variables) || containsAggregate(query.having) || containsAggregate(query.order))
        g = createAlgebraElement('group', [[], res]);

    // TODO: not doing the sample stuff atm
    // TODO: more based on jena results than w3 spec
    if (g)
    {
        // TODO: check up on scalarvals and args
        mapAggregates(query.variables, a);
        mapAggregates(query.having, a);
        mapAggregates(query.order, a);

        // TODO: we use the jena syntax of adding aggregates as second argument to group
        if (a.length > 0)
        {
            var aggregates = a.map(function (aggregate)
            {
                return createAlgebraElement(aggregate.variable, [aggregate.object]);
            });
            g.args.splice(1, 0, aggregates);
        }
        else
            g.args.splice(1, 0, null);

        query.group.forEach(function (groupEntry)
        {
            if (groupEntry.variable)
                e.push(groupEntry);
        });

        res = g;
    }


    // 18.2.4.2
    if (query.having)
    {
        query.having.forEach(function (filter)
        {
            res = createAlgebraElement('filter', [filter, res]);
        });
    }

    // 18.2.4.3
    // TODO: VALUES

    // 18.2.4.4
    var pv = {};

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
        res = createAlgebraElement('extend', [res, v.variable, v.expression]);
    });

    // 18.2.5
    //p = createAlgebraElement('tolist', [p]);

    // 18.2.5.1
    if (query.order)
        res = createAlgebraElement('orderby', query.order);
    // 18.2.5.2
    res = createAlgebraElement('project', [res, Object.keys(pv)]);
    // 18.2.5.3
    if (query.distinct)
        res = createAlgebraElement('distinct', [res]);
    // 18.2.5.4
    if (query.reduced)
        res = createAlgebraElement('reduced', [res]);
    // 18.2.5.5
    // we use -1 to indiciate there is no limit
    if (query.offset || query.limit)
        res = createAlgebraElement('slice', [query.offset || 0, query.limit || -1]);

    // clean up unchanged objects
    res = translateExpressionsOperations(res);

    return res;
}

// ---------------------------------- TRANSLATE AGGREGATES HELPER FUNCTIONS ----------------------------------
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

    return thingy;
}

function translateExpressionsOperations (thingy)
{
    if (!thingy)
        return thingy;

    if (isString(thingy))
        return thingy;

    if (thingy.type === 'operation')
        return createAlgebraElement(thingy.operator, thingy.args.map(function (subthingy) { return translateExpressionsOperations(subthingy); }));

    if (thingy.type === 'aggregate')
    {
        var a = createAlgebraElement(thingy.aggregation, [translateExpressionsOperations(thingy.expression)]);
        if (thingy.distinct)
            a = createAlgebraElement('distinct', [a]);
        return a;
    }

    if (thingy.descending)
        return createAlgebraElement('desc', [translateExpressionsOperations(thingy.expression)]);

    if (thingy.expression)
        return translateExpressionsOperations(thingy.expression);

    if (thingy.constructor === Array)
        return thingy.map(function (subthingy) { return translateExpressionsOperations(subthingy); });

    for (var v in thingy)
        thingy[v] = translateExpressionsOperations(thingy[v]);

    return thingy;
}
// ---------------------------------- END TRANSLATE AGGREGATES ----------------------------------