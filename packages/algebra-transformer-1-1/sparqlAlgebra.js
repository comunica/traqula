/**
 * Created by joachimvh on 26/02/2015.
 */

var assert = require('assert');
var _ = require('lodash');
var SparqlParser = require('sparqljs').Parser;

// http://www.w3.org/TR/sparql11-query/#sparqlQuery
// http://www.sparql.org/query-validator.html
// https://jena.apache.org/documentation/query/index.html
// https://www.w3.org/2011/09/SparqlAlgebra/ARQalgebra
// https://jena.apache.org/documentation/notes/sse.html

// TODO: unit tests...

// ---------------------------------- BEGIN HELPER CLASSES ----------------------------------

function AlgebraElement (symbol, args)
{
    this.symbol = symbol;
    this.args = _.isArray(args) ? args : [args];
}
AlgebraElement.prototype.toString = function ()
{
    function mapArg (arg)
    {
        if (_.isArray(arg))
            return '[' + _.map(arg, function (subArg) { return subArg.toString(); }).join(', ') + ']';
        return arg.toString();
    }

    return this.symbol + '(' + _.map(this.args, mapArg).join(', ') + ')';
};

function Triple (subject, predicate, object)
{
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
}
Triple.prototype.toString = function ()
{
    function handleURI (obj) {
        if (_.startsWith(obj, 'http://'))
            return '<' + obj + '>';
        return obj;
    }
    return handleURI(this.subject) + ' ' + handleURI(this.predicate) + ' ' + handleURI(this.object) + '.';
};

// ---------------------------------- END HELPER CLASSES ----------------------------------

function SparqlAlgebra ()
{
    this.reset();
}

SparqlAlgebra.prototype.reset = function ()
{
    this.variables = {};
    this.varCount = 0;
};

SparqlAlgebra.prototype.createAlgebraElement = function (symbol, args)
{
    return new AlgebraElement(symbol, args);
};

SparqlAlgebra.prototype.createTriple = function (subject, predicate, object)
{
    if (!predicate && !object)
    {
        predicate = subject.predicate;
        object = subject.object;
        subject = subject.subject;
    }
    return new Triple(subject, predicate, object);
};

SparqlAlgebra.prototype.generateFreshVar = function ()
{
    var v = '?var' + this.varCount++;
    if (this.variables[v])
        return this.generateFreshVar();
    this.variables[v] = true;
    return v;
};

// ---------------------------------- TRANSLATE ----------------------------------
SparqlAlgebra.prototype.translate = function (sparql)
{
    var parser = new SparqlParser();
    var query = parser.parse(sparql);
    assert(query.type === 'query', "Translate only works on complete query objects.");
    var group = {type:'group', patterns:query.where};
    var vars = this.inScopeVariables(group);
    var res = this.translateGraphPattern(group);
    this.assertTranslate(res);
    res = this.simplify(res);
    res = this.translateAggregates(query, res, vars);
    return res;
};

// ---------------------------------- TRANSLATE HELPER FUNCTIONS ----------------------------------
SparqlAlgebra.prototype.mergeObjects = function (obj1, obj2)
{
    for (var key in obj2)
        obj1[key] = obj2[key];
};

SparqlAlgebra.prototype.inScopeVariables = function (thingy)
{
    var variables = {};

    if (_.isString(thingy) && thingy[0] === '?')
        variables[thingy] = true;
    else if (thingy.type === 'bgp')
    {
        thingy.triples.forEach(function (triple)
        {
            this.mergeObjects(variables, this.inScopeVariables(triple.subject));
            this.mergeObjects(variables, this.inScopeVariables(triple.predicate));
            this.mergeObjects(variables, this.inScopeVariables(triple.object));
        }.bind(this));
    }
    else if (thingy.type === 'path')
    {
        thingy.items.forEach(function (item)
        {
            this.mergeObjects(variables, this.inScopeVariables(item));
        }.bind(this));
    }
    // group, union, optional
    else if (thingy.patterns)
    {
        thingy.patterns.forEach(function (pattern)
        {
            this.mergeObjects(variables, this.inScopeVariables(pattern));
        }.bind(this));
        // graph
        if (thingy.name)
            this.mergeObjects(variables, this.inScopeVariables(thingy.name));
    }
    // bind, group by
    else if (thingy.variable)
    {
        this.mergeObjects(variables, this.inScopeVariables(thingy.variable));
    }
    else if (thingy.queryType === 'SELECT')
    {
        thingy.variables.forEach(function (v)
        {
            if (v === '*')
                this.mergeObjects(variables, this.inScopeVariables(thingy.where));
            else
                this.mergeObjects(variables, this.inScopeVariables(v));
        }.bind(this));
        // TODO: I'm not 100% sure if you always add these or only when '*' was selected
        thingy.group.forEach(function (v)
        {
            this.mergeObjects(variables, this.inScopeVariables(v));
        }.bind(this));
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
};

SparqlAlgebra.prototype.assertTranslate = function (algebraQuery)
{
    if (_.isString(algebraQuery))
        return;
    assert(algebraQuery.symbol);
};

// ---------------------------------- TRANSLATE GRAPH PATTERN ----------------------------------
// TODO: look at all places where we generate sparqljs format instead of algebra format
SparqlAlgebra.prototype.translateGraphPattern = function (thingy)
{
    if (_.isString(thingy))
    {
        if (thingy[0] === '?')
            this.variables[thingy[0]] = true;
        return thingy;
    }

    if (_.isArray(thingy))
        return thingy.map(function (subthingy) { return this.translateGraphPattern(subthingy); }.bind(this));

    // ignore if already parsed
    if (thingy.symbol)
        return thingy;

    // make sure optional and minus have group subelement (needs to be done before recursion)
    if (thingy.type === 'optional' || thingy.type === 'minus')
        thingy = {type:thingy.type, patterns:[{type:'group', patterns:thingy.patterns}]};

    // we postpone this for subqueries so the in scope variable calculation is correct
    if (thingy.type !== 'query')
    {
        var newthingy = {};
        for (var key in thingy)
            newthingy[key] = this.translateGraphPattern(thingy[key]);
        thingy = newthingy;
    }
    // from this point on we can change contents of the input parameter since it was changed above (except for subqueries)

    // update expressions to algebra format (done here since they are used in both filters and binds)
    if (thingy.type === 'operation')
        thingy = this.createAlgebraElement(thingy.operator, thingy.args);

    // 18.2.2.1
    // already done by sparql parser

    // 18.2.2.2
    var filters = [];
    var nonfilters = [];
    if (thingy.type === 'filter')
    {
        if (thingy.expression.symbol === 'notexists')
            thingy = {type: thingy.type, expression: this.createAlgebraElement('fn:not', [this.createAlgebraElement('exists', thingy.expression.args)])};
        thingy = this.createAlgebraElement('_filter', [thingy.expression]); // _filter since it doesn't really correspond to the 'filter' from the spec here
    }
    else if (thingy.patterns)
    {
        thingy.patterns.forEach(function (subthingy)
        {
            if (subthingy.symbol === '_filter')
                filters.push(subthingy.args[0]); // we only need the expression, we already know they are filters now
            else
                nonfilters.push(subthingy);
        });
        thingy.patterns = nonfilters;
    }

    // 18.2.2.3
    if (thingy.type === 'path')
        thingy = this.translatePathExpression(thingy, thingy.items);

    // 18.2.2.4
    // need to do this at BGP level so seq paths can be merged into BGP
    if (thingy.type === 'bgp')
    {
        var newTriples = [];
        thingy.triples.forEach(function (subthingy)
        {
            newTriples.push.apply(newTriples, this.translatePath(subthingy, subthingy.predicate));
        }.bind(this));
        thingy.triples = newTriples;
    }

    // 18.2.2.5
    if (thingy.type === 'bgp')
        thingy = this.createAlgebraElement('bgp', _.map(thingy.triples, function (triple) { return this.createTriple(triple); }.bind(this)));

    // 18.2.2.6
    if (thingy.type === 'union')
        thingy = this.translateGroupOrUnionGraphPattern(thingy);
    if (thingy.type === 'graph')
        thingy = this.translateGraphGraphPattern(thingy);
    if (thingy.type === 'group')
        thingy = this.translateGroupGraphPattern(thingy);
    // TODO: InlineData (jena uses own 'table' entry?). Will have to make custom function combination that has the given values as a result?
    // (table (vars ?book ?title)
    // (row [?title "SPARQL Tutorial"])
    // (row [?book :book2])
    // )
    if (thingy.type === 'values')
        throw "VALUES is not supported yet.";
    if (thingy.type === 'query')
        thingy = this.translateSubSelect(thingy);

    // 18.2.2.7
    if (filters.length > 0)
        thingy = this.createAlgebraElement('filter', [this.translateFilters(filters), thingy]);

    return thingy;
};

// 18.2.2.8
SparqlAlgebra.prototype.simplify = function (thingy)
{
    if (_.isString(thingy))
        return thingy;
    if (_.isArray(thingy))
        return thingy.map(function (subthingy) { return this.simplify(subthingy); }.bind(this));
    if (thingy.symbol === 'join')
    {
        assert(thingy.args.length === 2, "Expected 2 args for 'join' element.");
        if (thingy.args[0].symbol === 'bgp' && thingy.args[0].args.length === 0)
            return thingy.args[1];
        else if (thingy.args[1].symbol === 'bgp' && thingy.args[1].args.length === 0)
            return thingy.args[0];
    }

    assert(thingy.symbol, "Expected translated input.");

    return this.createAlgebraElement(thingy.symbol, this.simplify(thingy.args));
};

// ---------------------------------- TRANSLATE GRAPH PATTERN HELPER FUNCTIONS ----------------------------------
SparqlAlgebra.prototype.translatePathExpression = function (pathExp, translatedItems)
{
    var res = null;
    var items = translatedItems.map(function (item)
    {
        if (_.isString(item))
            return this.createAlgebraElement('link', [item]);
        return item;
    }.bind(this));

    if (pathExp.pathType === '^')
        res = this.createAlgebraElement('inv', items);
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

        var normalElement = this.createAlgebraElement('NPS', normals);
        var invertedElement = this.createAlgebraElement('inv', [this.createAlgebraElement('NPS', inverted)]);

        if (inverted.length === 0)
            res = normalElement;
        else if (normals.length === 0)
            res = invertedElement;
        else
            res = this.createAlgebraElement('alt', [normalElement, invertedElement]);
    }

    else if (pathExp.pathType === '/')
    {
        assert(pathExp.items.length >= 2, "Expected at least 2 items for '/' path operator.");
        res = pathExp.items[0];
        for (var i = 1; i < items.length; ++i)
            res = this.createAlgebraElement('seq', [res, items[i]]);
    }
    else if (pathExp.pathType === '|')
        res = this.createAlgebraElement('alt', items);
    else if (pathExp.pathType === '*')
        res = this.createAlgebraElement('ZeroOrMorePath', items);
    else if (pathExp.pathType === '+')
        res = this.createAlgebraElement('OneOrMorePath', items);
    else if (pathExp.pathType === '?')
        res = this.createAlgebraElement('ZeroOrOnePath', items);

    assert (res, "Unable to translate path expression.");

    return res;
};

SparqlAlgebra.prototype.translatePath = function (pathTriple, translatedPredicate)
{
    // assume path expressions have already been updated
    if (!translatedPredicate.symbol)
        return [pathTriple];
    var pred = translatedPredicate;
    var res = null;
    if (pred.symbol === 'link')
    {
        assert(pred.args.length === 1, "Expected exactly 1 argument for 'link' symbol.");
        res = this.createTriple(pathTriple.subject, pred.args[0], pathTriple.object);
    }
    else if (pred.symbol === 'inv') // TODO: I think this applies to inv(path) instead of inv(iri) like the spec says, I might be wrong
    {
        assert(pred.args.length === 1, "Expected exactly 1 argument for 'inv' symbol.");
        res = this.translatePath(this.createTriple(pathTriple.object, pathTriple.predicate, pathTriple.subject), pred.args[0]);
    }
    else if (pred.symbol === 'seq')
    {
        assert(pred.args.length === 2, "Expected exactly 2 arguments for 'seq' symbol.");
        var v = this.generateFreshVar();
        var triple1 =  this.createTriple(pathTriple.subject, pred.args[0], v);
        var triple2 = this.createTriple(v, pred.args[1], pathTriple.object);
        res = this.translatePath(triple1, triple1.predicate).concat(this.translatePath(triple2, triple2.predicate));
    }
    else
        res = this.createAlgebraElement('path', [this.createTriple(pathTriple.subject, pathTriple.predicate, pathTriple.object)]);

    if (!_.isArray(res))
        res = [res];

    return res;
};

SparqlAlgebra.prototype.translateGroupOrUnionGraphPattern = function (group)
{
    assert(group.patterns.length >= 1, "Expected at least one item in GroupOrUnionGraphPattern.");
    var accumulator = null;
    group.patterns.forEach(function (pattern)
    {
        if (!accumulator)
            accumulator = pattern;
        else
            accumulator = this.createAlgebraElement('union', [accumulator, pattern]);
    }.bind(this));

    return accumulator;
};

SparqlAlgebra.prototype.translateGraphGraphPattern = function (group)
{
    assert(group.patterns.length === 1, "Expected exactly 1 item for GraphGraphPattern.");
    return this.createAlgebraElement('graph', group.patterns[0]);
};

SparqlAlgebra.prototype.translateGroupGraphPattern = function (group)
{
    //assert(group.symbol && group.args, "Expected input to already be in algebra format.");
    var g = this.createAlgebraElement('bgp', []);

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
                g = this.createAlgebraElement('leftjoin', [g, a.args[1], a.args[0]]);
            }
            else
                g = this.createAlgebraElement('leftjoin', [g, a, 'true']);
        }
        else if (arg.symbol === 'minus')
        {
            assert(arg.args.length === 1, "minus element should only have 1 arg at this point.");
            g = this.createAlgebraElement('minus', [g, arg.args[0]]);
        }
        else if (arg.type === 'bind')
            g = this.createAlgebraElement('extend', [g, arg.variable, arg.expression]);
        else
            g = this.createAlgebraElement('join', [g, arg]);
    }.bind(this));

    return g;
};

SparqlAlgebra.prototype.translateInlineData = function (values)
{
    // TODO: ...
};

SparqlAlgebra.prototype.translateSubSelect = function (query)
{
    return this.createAlgebraElement('tomultiset', [this.translate(query)]);
};

SparqlAlgebra.prototype.translateFilters = function (filterExpressions)
{
    if (!_.isArray(filterExpressions))
        filterExpressions = [filterExpressions];
    filterExpressions = filterExpressions.map(function (exp)
    {
        return this.createAlgebraElement(exp.symbol, exp.args);
    }.bind(this));
    if (filterExpressions.length === 1)
        return filterExpressions[0];
    else
        return this.createAlgebraElement('&&', filterExpressions);
};

// ---------------------------------- TRANSLATE AGGREGATES ----------------------------------
SparqlAlgebra.prototype.translateAggregates = function (query, parsed, variables)
{
    var res = parsed;

    // 18.2.4.1
    var g = null;
    var a = [];
    var e = [];
    if (query.group)
        g = this.createAlgebraElement('group', [query.group, res]);
    else if (this.containsAggregate(query.variables) || this.containsAggregate(query.having) || this.containsAggregate(query.order))
        g = this.createAlgebraElement('group', [[], res]);

    // TODO: not doing the sample stuff atm
    // TODO: more based on jena results than w3 spec
    if (g)
    {
        // TODO: check up on scalarvals and args
        this.mapAggregates(query.variables, a);
        this.mapAggregates(query.having, a);
        this.mapAggregates(query.order, a);

        // TODO: we use the jena syntax of adding aggregates as second argument to group
        if (a.length > 0)
        {
            var aggregates = a.map(function (aggregate)
            {
                return this.createAlgebraElement(aggregate.variable, [aggregate.object]);
            }.bind(this));
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
            res = this.createAlgebraElement('filter', [this.translateFilters(filters), res]);
        }.bind(this));
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
            if (_.isString(v) && v[0] === '?')
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
        res = this.createAlgebraElement('extend', [res, v.variable, v.expression]);
    }.bind(this));

    // 18.2.5
    //p = createAlgebraElement('tolist', [p]);

    // 18.2.5.1
    if (query.order)
        res = this.createAlgebraElement('orderby', query.order);
    // 18.2.5.2
    res = this.createAlgebraElement('project', [res, Object.keys(pv)]);
    // 18.2.5.3
    if (query.distinct)
        res = this.createAlgebraElement('distinct', [res]);
    // 18.2.5.4
    if (query.reduced)
        res = this.createAlgebraElement('reduced', [res]);
    // 18.2.5.5
    // we use -1 to indiciate there is no limit
    if (query.offset || query.limit)
        res = this.createAlgebraElement('slice', [query.offset || 0, query.limit || -1]);

    // clean up unchanged objects
    res = this.translateExpressionsOperations(res);

    return res;
};

// ---------------------------------- TRANSLATE AGGREGATES HELPER FUNCTIONS ----------------------------------
SparqlAlgebra.prototype.containsAggregate = function (thingy)
{
    if (!thingy)
        return false;

    if (thingy.type === 'aggregate')
        return true;

    if (_.isArray(thingy))
        return thingy.some(function (subthingy)
        {
            return this.containsAggregate(subthingy);
        }.bind(this));

    // appears in 'having'
    if (thingy.args)
        return this.containsAggregate(thingy.args);

    return false;
};

SparqlAlgebra.prototype.compareObjects = function (o1, o2)
{
    if (_.isString(o1) !== _.isString(o2))
        return false;
    if (_.isString(o1))
        return o1 === o2;
    var k1 = Object.keys(o1);
    var k2 = Object.keys(o2);
    if (k1.length !== k2.length)
        return false;
    for (var i = 0; i < k1.length; ++i)
    {
        var key = k1[i];
        if (!this.compareObjects(o1[key], o2[key]))
            return false;
    }
    return true;
};

// TODO: could use hash, prolly not that necessary
SparqlAlgebra.prototype.getMapping = function (thingy, map)
{
    for (var i = 0; i < map.length; ++i)
    {
        if (this.compareObjects(thingy, map[i].object))
            return map[i].variable;
    }
    return null;
};

SparqlAlgebra.prototype.mapAggregates = function (thingy, map)
{
    if (!thingy)
        return thingy;

    if (thingy.type === 'aggregate')
    {
        var v = this.getMapping(thingy, map);
        if (!v)
        {
            v = this.generateFreshVar();
            map.push({ object:thingy, variable:v });
        }
        return v;
    }

    // non-aggregate expression
    if (thingy.expression)
        thingy.expression = this.mapAggregates(thingy.expression, map);
    else if (thingy.args)
        this.mapAggregates(thingy.args, map);
    else if (_.isArray(thingy))
        thingy.forEach(function (subthingy, idx)
        {
            thingy[idx] = this.mapAggregates(subthingy, map);
        }.bind(this));

    return thingy;
};

SparqlAlgebra.prototype.translateExpressionsOperations = function (thingy)
{
    if (!thingy)
        return thingy;

    if (_.isString(thingy))
        return thingy;

    if (thingy.type === 'operation')
        return this.createAlgebraElement(thingy.operator, thingy.args.map(function (subthingy) { return this.translateExpressionsOperations(subthingy); }.bind(this)));

    if (thingy.type === 'aggregate')
    {
        var a = this.createAlgebraElement(thingy.aggregation, [this.translateExpressionsOperations(thingy.expression)]);
        if (thingy.distinct)
            a = this.createAlgebraElement('distinct', [a]);
        return a;
    }

    if (thingy.descending)
        return this.createAlgebraElement('desc', [this.translateExpressionsOperations(thingy.expression)]);

    if (thingy.expression)
        return this.translateExpressionsOperations(thingy.expression);

    if (_.isArray(thingy))
        return thingy.map(function (subthingy) { return this.translateExpressionsOperations(subthingy); }.bind(this));

    for (var v in thingy)
        thingy[v] = this.translateExpressionsOperations(thingy[v]);

    return thingy;
};
// ---------------------------------- END TRANSLATE AGGREGATES ----------------------------------

module.exports = SparqlAlgebra;

//var sparql =
//    "PREFIX dc: <http://purl.org/dc/elements/1.1/> " +
//    "PREFIX :   <http://example.org/ns#> " +
//    "SELECT ?title ?price " +
//    "WHERE {" +
//    "    ?x dc:title ?title." +
//    "    OPTIONAL {" +
//    "        ?x :price ?price." +
//    "        FILTER (?price < 30)." +
//    "    }" +
//    "}";
//var algebra = new SparqlAlgebra();
//var result = algebra.translate(sparql);
//console.log('' + result);
//console.log(JSON.stringify(result, null, 2));