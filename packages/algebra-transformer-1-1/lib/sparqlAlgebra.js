/**
 * Created by joachimvh on 26/02/2015.
 */

const _ = require('lodash');
const SparqlParser = require('sparqljs').Parser;

// ---------------------------------- BEGIN HELPER CLASSES ----------------------------------

const Algebra = Object.freeze({
    ALT:                Symbol('alt'),
    BGP:                Symbol('bgp'),
    DESC:               Symbol('desc'),
    DISTINCT:           Symbol('distinct'),
    EXISTS:             Symbol('exists'),
    EXTEND:             Symbol('extend'),
    FILTER:             Symbol('filter'),
    FN_NOT:             Symbol('fn:not'),
    GRAPH:              Symbol('GRAPH'),
    GROUP:              Symbol('group'),
    INV:                Symbol('inv'),
    JOIN:               Symbol('join'),
    LEFT_JOIN:          Symbol('leftjoin'),
    LINK:               Symbol('link'),
    MINUS:              Symbol('minus'),
    NPS:                Symbol('nps'),
    ONE_OR_MORE_PATH:   Symbol('OneOrMorePath'),
    ORDER_BY:           Symbol('orderby'),
    PATH:               Symbol('path'),
    PROJECT:            Symbol('project'),
    REDUCED:            Symbol('reduced'),
    SEQ:                Symbol('seq'),
    SLICE:              Symbol('slice'),
    TO_MULTISET:        Symbol('tomultiset'),
    UNION:              Symbol('union'),
    ZERO_OR_MORE_PATH:  Symbol('ZeroOrMorePath'),
    ZERO_OR_ONE_PATH:   Symbol('ZeroOrOnePath'),
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

// ---------------------------------- END HELPER CLASSES ----------------------------------


let variables = {};
let varCount = 0;

function createAlgebraElement (symbol, args)
{
    return new AlgebraElement(symbol, args);
}

function createTriple (subject, predicate, object)
{
    // first parameter is a triple object
    if (!predicate && !object)
    {
        predicate = subject.predicate;
        object = subject.object;
        subject = subject.subject;
    }
    return new Triple(subject, predicate, object);
}

// generate an unused variable name
function generateFreshVar ()
{
    let v = '?var' + varCount++;
    if (variables[v])
        return generateFreshVar();
    variables[v] = true;
    return v;
}

// ---------------------------------- TRANSLATE ----------------------------------
function translate (sparql)
{
    variables = {};
    varCount = 0;
    if (_.isString(sparql))
    {
        let parser = new SparqlParser();
        parser._resetBlanks();
        sparql = parser.parse(sparql);
    }
    if (sparql.type !== 'query')
        throw new Error('Translate only works on complete query objects.');
    let group = { type: 'group', patterns: sparql.where };
    let vars = inScopeVariables(group);
    let res = translateGraphPattern(group);
    res = simplify(res);
    res = translateAggregates(sparql, res, vars);
    return res;
}

// ---------------------------------- TRANSLATE HELPER FUNCTIONS ----------------------------------
function mergeObjects (obj1, obj2)
{
    for (let key of Object.keys(obj2))
        obj1[key] = obj2[key];
}

function isVariable (thingy)
{
    return _.isString(thingy) && thingy[0] === '?';
}

function inScopeVariables (thingy)
{
    let inScope = {};

    if (isVariable(thingy))
        inScope[thingy] = true;
    else if (thingy.type === 'bgp')
    {
        thingy.triples.forEach(triple =>
        {
            mergeObjects(inScope, inScopeVariables(triple.subject));
            mergeObjects(inScope, inScopeVariables(triple.predicate));
            mergeObjects(inScope, inScopeVariables(triple.object));
        });
    }
    else if (thingy.type === 'path')
    {
        for (let item of thingy.items)
            mergeObjects(inScope, inScopeVariables(item));
    }
    // group, union, optional
    else if (thingy.patterns)
    {
        for (let pattern of thingy.patterns)
            mergeObjects(inScope, inScopeVariables(pattern));
        
        // graph
        if (thingy.name)
            mergeObjects(inScope, inScopeVariables(thingy.name));
    }
    // bind, group by
    else if (thingy.variable)
    {
        mergeObjects(inScope, inScopeVariables(thingy.variable));
    }
    else if (thingy.queryType === 'SELECT')
    {
        for (let v of thingy.variables)
        {
            if (v === '*')
                mergeObjects(inScope, inScopeVariables(thingy.where));
            else
                mergeObjects(inScope, inScopeVariables(v));
        }
        
        // TODO: I'm not 100% sure if you always add these or only when '*' was selected
        for (let v of thingy.group)
            mergeObjects(inScope, inScopeVariables(v));
    }
    else if (thingy.type === 'values')
    {
        for (let value of thingy.values)
            for (let v of Object.keys(value))
                inScope[v] = true;
    }

    return inScope;
}

// ---------------------------------- TRANSLATE GRAPH PATTERN ----------------------------------
function translateGraphPattern (thingy)
{
    if (_.isString(thingy))
    {
        if (isVariable(thingy))
            variables[thingy] = true;
        return thingy;
    }

    if (_.isArray(thingy))
        return thingy.map(subthingy => translateGraphPattern(subthingy) );

    // ignore if already parsed
    if (thingy.symbol)
        return thingy;

    // make sure optional and minus have group subelement (needs to be done before recursion)
    if (thingy.type === 'optional' || thingy.type === 'minus')
        thingy = { type: thingy.type, patterns: [{ type: 'group', patterns: thingy.patterns }] };

    // we postpone this for subqueries so the in-scope variable calculation is correct
    if (thingy.type !== 'query')
    {
        let newthingy = {};
        for (let key of Object.keys(thingy))
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
    let filters = [];
    let nonfilters = [];
    if (thingy.type === 'filter')
    {
        if (thingy.expression.symbol === 'notexists')
            thingy = { type: thingy.type, expression: createAlgebraElement(Algebra.FN_NOT, [ createAlgebraElement(Algebra.EXISTS, thingy.expression.args) ]) };
        thingy = createAlgebraElement('_filter', [ thingy.expression ]); // _filter since it doesn't really correspond to the 'filter' from the spec here
    }
    else if (thingy.patterns)
    {
        for (let pattern of thingy.patterns)
        {
            if (pattern.symbol === '_filter')
                filters.push(pattern.args[0]); // we only need the expression, we already know they are filters now
            else
                nonfilters.push(pattern);
        }
        thingy.patterns = nonfilters;
    }

    // 18.2.2.3
    if (thingy.type === 'path')
        thingy = translatePathExpression(thingy, thingy.items);

    // 18.2.2.4
    // need to do this at BGP level so seq paths can be merged into BGP
    if (thingy.type === 'bgp')
    {
        let newTriples = [];
        for (let triple of thingy.triples)
            newTriples.push.apply(newTriples, translatePath(triple, triple.predicate));
        thingy.triples = newTriples;
    }

    // 18.2.2.5
    if (thingy.type === 'bgp')
        thingy = createAlgebraElement(Algebra.BGP, thingy.triples.map(triple => createTriple(triple)));

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
        throw new Error("VALUES is not supported yet.");
    if (thingy.type === 'query')
        thingy = translateSubSelect(thingy);

    // 18.2.2.7
    if (filters.length > 0)
        thingy = createAlgebraElement(Algebra.FILTER, [translateFilters(filters), thingy]);

    return thingy;
}

// 18.2.2.8
function simplify (thingy)
{
    if (_.isString(thingy) || _.isBoolean(thingy) || _.isInteger(thingy))
        return thingy;
    if (_.isArray(thingy))
        return thingy.map(subthingy => simplify(subthingy));
    
    if (!thingy.symbol)
        throw new Error("Expected translated input.");
    
    if (thingy.symbol === Algebra.BGP)
        return thingy;
    
    if (thingy.symbol === Algebra.JOIN)
    {
        if (thingy.args.length !== 2)
            throw new Error("Expected 2 args for 'join' element.");
        if (thingy.args[0].symbol === Algebra.BGP && thingy.args[0].args.length === 0)
            return thingy.args[1];
        else if (thingy.args[1].symbol === Algebra.BGP && thingy.args[1].args.length === 0)
            return thingy.args[0];
    }

    return createAlgebraElement(thingy.symbol, simplify(thingy.args));
}

// ---------------------------------- TRANSLATE GRAPH PATTERN HELPER FUNCTIONS ----------------------------------
function translatePathExpression (pathExp, translatedItems)
{
    let res = null;
    let items = translatedItems.map(item => _.isString(item) ? createAlgebraElement(Algebra.LINK, [ item ]) : item);

    if (pathExp.pathType === '^')
        res = createAlgebraElement(Algebra.INV, items);
    else if (pathExp.pathType === '!')
    {
        let normals = [];
        let inverted = [];
        if (items.length !== 1)
            throw new Error("Expected exactly 1 item for '!' path operator.");
        let item = items[0];

        if (item.symbol === Algebra.LINK)
            normals.push(item);
        else if (item.symbol === Algebra.INV)
        {
            if (item.items.length !== 1)
                throw new Error("Expected exactly 1 item for '^' path operator.");
            inverted.push(item.items[0]);
        }
        else if (item.symbol === Algebra.ALT)
        {
            for (let option of item.args)
            {
                if (option.symbol === Algebra.INV)
                {
                    if (option.args.length !== 1)
                        throw new Error('Expected exactly 1 item for '^' path operator.');
                    inverted.push(option.args[0]);
                }
                else
                    normals.push(option);
            }
        }

        let normalElement = createAlgebraElement(Algebra.NPS, normals);
        let invertedElement = createAlgebraElement(Algebra.INV, [ createAlgebraElement(Algebra.NPS, inverted) ]);

        if (inverted.length === 0)
            res = normalElement;
        else if (normals.length === 0)
            res = invertedElement;
        else
            res = createAlgebraElement(Algebra.ALT, [ normalElement, invertedElement ]);
    }

    else if (pathExp.pathType === '/')
    {
        if (pathExp.items.length < 2)
            throw new Error('Expected at least 2 items for '/' path operator.');
        res = pathExp.items[0];
        for (let item of items)
            res = createAlgebraElement(Algebra.SEQ, [res, item]);
    }
    else if (pathExp.pathType === '|')
        res = createAlgebraElement(Algebra.ALT, items);
    else if (pathExp.pathType === '*')
        res = createAlgebraElement(Algebra.ZERO_OR_MORE_PATH, items);
    else if (pathExp.pathType === '+')
        res = createAlgebraElement(Algebra.ONE_OR_MORE_PATH, items);
    else if (pathExp.pathType === '?')
        res = createAlgebraElement(Algebra.ZERO_OR_ONE_PATH, items);

    if (!res)
        throw new Error('Unable to translate path expression ' + pathExp);

    return res;
}

function translatePath (pathTriple, translatedPredicate)
{
    // assume path expressions have already been updated
    if (!translatedPredicate.symbol)
        return [ pathTriple ];
    let pred = translatedPredicate;
    let res = null;
    if (pred.symbol === Algebra.LINK)
    {
        if (pred.args.length !== 1)
            throw new Error("Expected exactly 1 argument for 'link' symbol.");
        res = createTriple(pathTriple.subject, pred.args[0], pathTriple.object);
    }
    else if (pred.symbol === Algebra.INV) // TODO: I think this applies to inv(path) instead of inv(iri) like the spec says, I might be wrong
    {
        if (pred.args.length !== 1)
            throw new Error("Expected exactly 1 argument for 'inv' symbol.");
        res = translatePath(createTriple(pathTriple.object, pathTriple.predicate, pathTriple.subject), pred.args[0]);
    }
    else if (pred.symbol === Algebra.SEQ)
    {
        if (pred.args.length !== 2)
            throw new Error("Expected exactly 2 arguments for 'seq' symbol.");
        let v = generateFreshVar();
        let triple1 =  createTriple(pathTriple.subject, pred.args[0], v);
        let triple2 = createTriple(v, pred.args[1], pathTriple.object);
        res = translatePath(triple1, triple1.predicate).concat(translatePath(triple2, triple2.predicate));
    }
    else
        res = createAlgebraElement(Algebra.PATH, [ createTriple(pathTriple.subject, pathTriple.predicate, pathTriple.object) ]);

    if (!_.isArray(res))
        res = [res];

    return res;
}

function translateGroupOrUnionGraphPattern (group)
{
    if (group.patterns.length < 1)
        throw new Error('Expected at least one item in GroupOrUnionGraphPattern.');
    
    return group.patterns.reduce((accumulator, pattern) => createAlgebraElement(Algebra.UNION, [ accumulator, pattern ]));
}

function translateGraphGraphPattern (group)
{
    if (group.patterns.length !== 1)
        throw new Error('Expected exactly 1 item for GraphGraphPattern.');
    return createAlgebraElement(Algebra.GRAPH, group.patterns[0]);
}

function accumulateGroupGraphPattern (G, E)
{
    // TODO: some of the patterns aren't translated yet at this point, might be code smell
    if (E.symbol === Algebra.FILTER)
        throw new Error('Filters should have been removed previously.');
    if (E.type === 'optional')
    {
        if (E.patterns.length !== 1)
            throw new Error("Expected exactly 1 arg for 'optional'.");
        let A = E.patterns[0];
        if (A.symbol === Algebra.FILTER)
        {
            if (A.args.length !== 2)
                throw new Error("Expected exactly 2 args for 'filter'.");
            G = createAlgebraElement(Algebra.LEFT_JOIN, [ G, A.args[1], A.args[0] ]);
        }
        else
            G = createAlgebraElement(Algebra.LEFT_JOIN, [ G, A, true ]);
    }
    else if (E.symbol === Algebra.MINUS)
    {
        if (E.args.length !== 1)
            throw new Error('MINUS element should only have 1 arg at this point.');
        G = createAlgebraElement(Algebra.MINUS, [ G, E.args[0] ]);
    }
    else if (E.type === 'bind')
        G = createAlgebraElement(Algebra.EXTEND, [ G, E.variable, E.expression ]);
    else
        G = createAlgebraElement(Algebra.JOIN, [ G, E ]);
    
    return G
}

function translateGroupGraphPattern (group)
{
    return group.patterns.reduce(accumulateGroupGraphPattern, createAlgebraElement(Algebra.BGP, []));
}

function translateInlineData (values)
{
    // TODO: ...
}

function translateSubSelect (query)
{
    return createAlgebraElement(Algebra.TO_MULTISET, [ translate(query) ]);
}

function translateFilters (filterExpressions)
{
    if (!_.isArray(filterExpressions))
        filterExpressions = [ filterExpressions ];
    
    filterExpressions = filterExpressions.map(exp =>
    {
        if (_.isString(exp))
            return exp;
        if (exp.symbol)
            return createAlgebraElement(exp.symbol, exp.args);
        if (exp.function)
            return createAlgebraElement(exp.function, exp.args);
    });
    
    if (filterExpressions.length === 1)
        return filterExpressions[0];
    else
        return createAlgebraElement('&&', filterExpressions);
}

// ---------------------------------- TRANSLATE AGGREGATES ----------------------------------
function translateAggregates (query, parsed, variables)
{
    let res = parsed;

    // 18.2.4.1
    let G = null;
    let A = [];
    let E = [];
    if (query.group)
        G = createAlgebraElement(Algebra.GROUP, [ query.group, res ]);
    else if (containsAggregate(query.variables) || containsAggregate(query.having) || containsAggregate(query.order))
        G = createAlgebraElement(Algebra.GROUP, [ [], res ]);

    // TODO: not doing the sample stuff atm
    // TODO: more based on jena results than w3 spec
    if (G)
    {
        // TODO: check up on scalarvals and args
        mapAggregates(query.variables, A);
        mapAggregates(query.having, A);
        mapAggregates(query.order, A);

        // TODO: we use the jena syntax of adding aggregates as second argument to group
        if (A.length > 0)
        {
            let aggregates = A.map(aggregate => createAlgebraElement(aggregate.variable, [aggregate.object]));
            G.args.splice(1, 0, aggregates);
        }
        else
            G.args.splice(1, 0, null);

        query.group.forEach(function (groupEntry)
        {
            if (groupEntry.variable)
                E.push(groupEntry);
        });

        res = G;
    }


    // 18.2.4.2
    if (query.having)
    {
        for (let filter of query.having)
            res = createAlgebraElement(Algebra.FILTER, [ translateFilters(filter), res ]);
    }

    // 18.2.4.3
    // TODO: VALUES

    // 18.2.4.4
    let PV = {};

    if (query.variables.indexOf('*') >= 0)
        PV = variables;
    else
    {
        for (let v of query.variables)
        {
            if (isVariable(v))
                PV[v] = true;
            else if (v.variable)
            {
                if (variables[v.variable] || PV[v.variable])
                    throw new Error('Aggregate variable appearing multiple times: ' + v.variable);
                PV[v.variable] = true;
                E.push(v);
            }
        }
    }

    for (let v of E)
        res = createAlgebraElement(Algebra.EXTEND, [res, v.variable, v.expression]);

    // 18.2.5
    //p = createAlgebraElement('tolist', [p]);

    // 18.2.5.1
    if (query.order)
        res = createAlgebraElement(Algebra.ORDER_BY, [ res, query.order ]);
    // 18.2.5.2
    res = createAlgebraElement(Algebra.PROJECT, [ res, Object.keys(PV) ]);
    // 18.2.5.3
    if (query.distinct)
        res = createAlgebraElement(Algebra.DISTINCT, [ res ]);
    // 18.2.5.4
    if (query.reduced)
        res = createAlgebraElement(Algebra.REDUCED, [ res ]);
    // 18.2.5.5
    // we use -1 to indiciate there is no limit
    if (query.offset || query.limit)
        res = createAlgebraElement(Algebra.SLICE, [ query.offset || 0, query.limit || -1, res ]);

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

    if (_.isArray(thingy))
        return thingy.some(subthingy => containsAggregate(subthingy));

    // appears in 'having'
    if (thingy.args)
        return containsAggregate(thingy.args);

    return false;
}

function compareObjects(o1, o2)
{
    if (_.isString(o1) !== _.isString(o2))
        return false;
    
    if (_.isString(o1))
        return o1 === o2;
    
    let k1 = Object.keys(o1);
    let k2 = Object.keys(o2);
    if (k1.length !== k2.length)
        return false;
    
    return k1.every(key => compareObjects(o1[key], o2[key]));
}

// TODO: could use hash, prolly not that necessary
function getMapping(thingy, map)
{
    for (let m of map)
    {
        if (compareObjects(thingy, m.object))
            return m.variable;
    }
    return null;
}

function mapAggregates (thingy, map)
{
    if (!thingy)
        return thingy;

    if (thingy.type === 'aggregate')
    {
        let v = getMapping(thingy, map);
        if (!v)
        {
            v = generateFreshVar();
            map.push({ object: thingy, variable: v });
        }
        return v;
    }

    // non-aggregate expression
    if (thingy.expression)
        thingy.expression = mapAggregates(thingy.expression, map);
    else if (thingy.args)
        mapAggregates(thingy.args, map);
    else if (_.isArray(thingy))
        thingy.forEach((subthingy, idx) => thingy[idx] = mapAggregates(subthingy, map));

    return thingy;
}

function translateExpressionsOperations(thingy)
{
    if (!thingy)
        return thingy;

    if (_.isString(thingy))
        return thingy;

    if (thingy.type === 'operation')
        return createAlgebraElement(thingy.operator, thingy.args.map(subthingy => translateExpressionsOperations(subthingy)));
    
    if (thingy.type === 'functionCall')
        return createAlgebraElement(thingy.function, thingy.args.map(subthingy => translateExpressionsOperations(subthingy)));

    if (thingy.type === 'aggregate')
    {
        let A = createAlgebraElement(thingy.aggregation, [ translateExpressionsOperations(thingy.expression) ]);
        if (thingy.distinct)
            A = createAlgebraElement(Algebra.DISTINCT, [ A ]);
        return A;
    }

    if (thingy.descending)
        return createAlgebraElement(Algebra.DESC, [ translateExpressionsOperations(thingy.expression) ]);

    if (thingy.expression)
        return translateExpressionsOperations(thingy.expression);

    if (_.isArray(thingy))
        return thingy.map(subthingy => translateExpressionsOperations(subthingy));

    for (let v of Object.keys(thingy))
        thingy[v] = translateExpressionsOperations(thingy[v]);

    return thingy;
}
// ---------------------------------- END TRANSLATE AGGREGATES ----------------------------------

module.exports = {
    Algebra,
    AlgebraElement,
    Triple,
    translate,
};