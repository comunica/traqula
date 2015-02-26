/**
 * Created by joachimvh on 26/02/2015.
 */

// http://www.w3.org/TR/sparql11-query/#sparqlQuery

var input = {};

// TODO: check if all parameters counts are correct (e.g. actually 1 in FILTER EXISTS)?
// TODO: maybe use same casing as w3.org

function translateNames (thingy)
{
    // TODO: can this give incorrect results?
    for (var subthingy in thingy)
        translateNames(subthingy);

    // 18.2.2.1
    // already done by sparql parser

    // 18.2.2.2
    // TODO: remove filters??
    if (thingy.expression && thingy.expression.operator === 'notexists')
        thingy.expression.operator = 'fn:not exists'; // TODO: actually need 2 nested functions here

    // 18.2.2.3
    else if (thingy.type === 'path')
        translatePathExpression(thingy);

    // 18.2.2.4
    // need to do this at BGP level so seq paths can be merged into BGP
    else if (thingy.type === 'bgp')
    {
        var newTriples = [];
        thingy.triples.forEach(function (subthingy)
        {
            if (subthingy.predicate.type === 'path')
                newTriples.push.apply(newTriples, translatePath(subthingy));
            else
                newTriples.push(subthingy);
        });
    }

    // 18.2.2.5
    // already done by sparql parser
    // TODO: generalize contents variable names to 'operator'/'type' and 'items' instead of 'triples', 'patterns' and others?

    // 18.2.2.6
    // TODO: ...

    // 18.2.2.7
    // TODO: ...

    // 18.2.2.8
    // TODO: ...
}

function translatePathExpression (pathExp)
{
    // iri
    pathExp.items.forEach(function (item, idx)
    {
        if (item.type && item.type === 'path')
            translatePathExpression(item);
        else
            pathExp.items[idx] = 'link(' + item + ')'; // TODO: prolly need object here
    });

    if (pathExp.pathType === '^')
        pathExp.pathType = 'inv';

    else if (pathExp.pathType === '!')
    {
        var normals = [];
        var inverted = [];
        var sub = pathExp.items[0];
        if (!sub.type)
            normals.push(sub);
        else if (sub.type === '^')
            inverted.push(sub.items[0]);
        else if (sub.type === '|')
        {
            sub.items.forEach(function (item)
            {
                if (item.type === '^')
                    inverted.push(item.items[0]);
                else
                    normals.push(item);
            });
        }

        if (inverted.length === 0)
        {
            pathExp.pathType = 'NPS';
            pathExp.items = normals;
        }
        else if (normals.length === 0)
        {
            pathExp.pathType = 'inv NPS'; // TODO: nest objects
            pathExp.items = inverted;
        }
        else
        {
            pathExp.pathType = 'alt';
            // TODO: nest multiple objects (NPS(normals), inv(NPS(normals)))
        }
    }

    else if (path.pathType === '/')
        path.pathType = 'seq';
    else if (path.pathType === '|')
        path.pathType = 'alt';
    else if (path.pathType === '*')
        path.pathType = 'ZeroOrMorePath';
    else if (path.pathType === '+')
        path.pathType = 'OneOrMorePath';
    else if (path.pathType === '?')
        path.pathType = 'ZeroOrOnePath';
}

function translatePath (path)
{
    var pred = path.predicate;
    if (pred.pathType === 'link')
        path.predicate = pred.items[0];
    else if (pred.pathType === 'inv') // TODO: I think we actually have to look for inv(link(iri)) here despite what the spec says
    {
        path.predicate = pred.items[0];
        // TODO: swap SO
    }
    else if (pred.pathType === 'seq')
    {
        // TODO: also: recursion necessary
        // TODO: generate fresh variable names
        var paths = [];
        pred.items.forEach(function (item)
        {
            // TODO: ...
        });
        path = paths;
    }
    else
    {
        // TODO: create Path object with given contents
    }

    if (path.constructor !== Array)
        path = [path];

    return path;
}

function translateGroupOrUnionGraphPattern (group)
{
    var accumulator;
    group.patterns.forEach(function (pattern)
    {
        if (!accumulator)
            accumulator = pattern;
        else
            accumulator = {type:'union', patterns: [accumulator, pattern]};
    });

    return accumulator;
}

function translateGraphGraphPattern (group)
{
    return {type:'graph', items:[group.name, group.patterns[0]]}; // TODO: not sure if SparqlJS might simplify things so there are multiple patterns here?
}

function translateGroupGraphPattern (group)
{
    // TODO: this is actually completely wrong, need to apply following rules to each element of group, not group itself
    var g = {type:'bgp', triples:[]}; // todo: is this correct?
    if (group.type === 'optional')
    {
        // TODO: again, are we guaranteed to only have 1 element? maybe already due to previous parsing?
        var a = group.patterns[0];
        if (a.type === 'filter')
            g = {type:'leftjoin', items:[g, a.items[1], a.items[0]]};
        else
            g = {type:'leftjoin', items:[g, a.items[1], 'true']};
    }
    else if (group.type === 'minus')
        g = {type:'minus', items:[g, group.patterns[0]]};
    else if (group.type === 'bind')
        g = {type:'minus', items:[g, group.variable, group.expression]};
    else
        g = {type:'join', items:[g, group]};

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

function translate (group)
{
    var filters = [];
    var nonfilters = [];
    group.patterns.forEach(function (pattern)
    {
        if (pattern.type === 'filter')
            filters.push(pattern);
        else
            nonfilters.push(pattern);
    });
    filters.forEach(function (filter, idx)
    {
        if (filter.expression && filter.expression.type === 'operation')
        {
            if (filter.expression.operator === 'notexists')
                filters[idx] = 'fn:not(exists(' + translate(filter.expression.args[0]) + '))';
            else if (filter.expression.operator === 'exists')
                filters[idx] = 'exists(' + translate(filter.expression.args[0]) + ')';
        }
    });

}