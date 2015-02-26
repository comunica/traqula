/**
 * Created by joachimvh on 26/02/2015.
 */

var input = {};

// TODO: check if all parameters counts are correct (e.g. actually 1 in FILTER EXISTS)?

function translateNames (thingy)
{
    for (var subthingy in thingy)
        translateNames(subthingy);

    // 18.2.2.1
    // already done by sparql parser

    // 18.2.2.2
    if (thingy.expression && thingy.expression.operator === 'notexists')
        thingy.expression.operator = 'fn:not exists'; // TODO: actually need 2 nested functions here

    // 18.2.2.3
    else if (thingy.type === 'path')
        translatePathExpression(thingy);

    // 18.2.2.4
    // TODO: put this in separate function
    else if (thingy.predicate && thingy.predicate.type === 'path')
    {
        var pred = thingy.predicate;
        if (pred.pathType === 'link')
            thingy.predicate = pred.items[0];
        else if (pred.pathType === 'inv') // TODO: I think we actually have to look for inv(link(iri)) here despite what the spec says
        {
            thingy.predicate = pred.items[0];
            // TODO: swap SO
        }
        else if (pred.pathType === 'seq')
        {
            // TODO: this is obviously wrong, but we want to replace a triple with a list of triples, how to do this?
            // TODO: also: recursion necessary prolly?
            thingy.predicate = pred.items;
        }
        else
        {
            // TODO: create Path object with given contents
        }
    }

    // 18.2.2.5
    // already done by sparql parser
    // TODO: generalize contents variable names to 'items' instead of 'patterns'?

    // 18.2.2.6
    // TODO: ...

    // 18.2.2.7
    // TODO: ...

    // 18.2.2.8
    // TODO: ...
}

function translatePathExpression (path)
{
    // iri
    path.items.forEach(function (item, idx)
    {
        if (item.type && item.type === 'path')
            translatePathExpression(item);
        else
            path.items[idx] = 'link(' + item + ')'; // TODO: prolly need object here
    });

    if (path.pathType === '^')
        path.pathType = 'inv';

    else if (path.pathType === '!')
    {
        var normals = [];
        var inverted = [];
        var sub = path.items[0];
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
            path.pathType = 'NPS';
            path.items = normals;
        }
        else if (normals.length === 0)
        {
            path.pathType = 'inv NPS'; // TODO: nest objects
            path.items = inverted;
        }
        else
        {
            path.pathType = 'alt';
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