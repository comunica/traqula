/**
 * Created by joachimvh on 26/02/2015.
 */

const _ = require('lodash');
const algebra = require('./algebra');
const N3Util = require('n3').Util;
const SparqlParser = require('sparqljs').Parser;

const Algebra = algebra.types;


// ---------------------------------- END HELPER CLASSES ----------------------------------


let variables = {};
let varCount = 0;
let useQuads = false;
let defaultGraph = { termType: 'DefaultGraph', value: '' };

function createAlgebraElement (symbol, args)
{
    return Object.assign({type: symbol}, args);
}

function createExpression (symbol, args)
{
    // SPARQL.js has a list as second argument for notin (and in), we don't like lists
    // TODO: unfortunately createExpression gets called multiple times hence the array check for now
    if ((symbol === 'notin' || symbol === 'in') && _.isArray(args[1]))
        args = [args[0]].concat(args[1]);
    
    // TODO: support for known operators?
    return createAlgebraElement('expression', {symbol, args});
}

function createAggregate (symbol, input)
{
    if (_.isArray(input))
        input = input[0];
    return createAlgebraElement('aggregate', {symbol, expression: input});
}

function createTriple (subject, predicate, object)
{
    // first parameter is a triple object
    if (subject.subject && subject.predicate && subject.object)
    {
        predicate = subject.predicate;
        object = subject.object;
        subject = subject.subject;
    }
    
    if (predicate.type)
        return createAlgebraElement(Algebra.PATH, {subject: createTerm(subject), predicate, object: createTerm(object), graph: defaultGraph});
    
    return createAlgebraElement(Algebra.PATTERN, {subject: createTerm(subject), predicate: createTerm(predicate), object: createTerm(object), graph: defaultGraph});
}

function createTerm (str)
{
    if (str.termType)
        return str;
    
    if (str[0] === '?')
        return { termType: 'Variable', value: str.substring(1) };
    if (str.startsWith('_:'))
        return { termType: 'BlankNode', value: str.substring(3) };
    if (N3Util.isLiteral(str))
    {
        let literal = { termType: 'Literal', value: N3Util.getLiteralValue(str) };
        let lang = N3Util.getLiteralLanguage(str);
        if (lang && lang.length > 0)
            literal.language = lang;
        else
        {
            let type = N3Util.getLiteralType(str);
            if (type && type.length > 0)
                literal.datatype = createTerm(type);
        }
        return literal;
    }
    return { termType: 'NamedNode', value: str };
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
function translate (sparql, quads)
{
    variables = {};
    varCount = 0;
    useQuads = quads;
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
    res = toRdfJs(res);
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
        if (thingy.group)
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
    // can be UNDEF in a VALUES block
    if (thingy === undefined)
        return thingy;
    
    if (_.isString(thingy))
    {
        if (isVariable(thingy))
            variables[thingy] = true;
        return thingy;
    }
    
    if (_.isArray(thingy))
        return thingy.map(subthingy => translateGraphPattern(subthingy) );
    
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
        thingy = createExpression(thingy.operator, thingy.args);
    
    // 18.2.2.1
    // already done by sparql parser
    
    // 18.2.2.2
    let filters = [];
    let nonfilters = [];
    if (thingy.type === 'filter')
        thingy = createAlgebraElement('_filter', { expression: thingy.expression }); // _filter since it doesn't really correspond to the 'filter' from the spec here
    else if (thingy.patterns)
    {
        for (let pattern of thingy.patterns)
        {
            if (pattern.type === '_filter')
                filters.push(pattern.expression); // we only need the expression, we already know they are filters now
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
    {
        let join = [];
        let bgp = [];
        for (let triple of thingy.triples)
        {
            if (!triple.type)
                triple = createTriple(triple);
            if (triple.type === Algebra.PATH)
            {
                if (bgp.length > 0)
                {
                    join.push(createAlgebraElement(Algebra.BGP, { patterns: bgp }));
                    bgp = [];
                }
                join.push(triple);
            }
            else
                bgp.push(triple);
        }
        if (bgp.length > 0)
            join.push(createAlgebraElement(Algebra.BGP, { patterns: bgp }));
        if (join.length === 1)
            thingy = join[0];
        else
            thingy = join.reduce((acc, item) => createAlgebraElement(Algebra.JOIN, { left: acc, right: item }));
    }
    
    // 18.2.2.6
    if (thingy.type === 'union')
        thingy = translateGroupOrUnionGraphPattern(thingy);
    if (thingy.type === 'graph')
    {
        // need to handle this separately here since the filters need to be in the graph
        thingy = translateGraphGraphPattern(thingy, filters);
        filters = [];
    }
    if (thingy.type === 'group')
        thingy = translateGroupGraphPattern(thingy);
    // inlineData based on Jena implementation
    if (thingy.type === 'values')
        thingy = translateInlineData(thingy);
    if (thingy.type === 'query')
        thingy = translateSubSelect(thingy);
    
    // 18.2.2.7
    if (filters.length > 0)
        thingy = createAlgebraElement(Algebra.FILTER, { expression: translateFilters(filters), input: thingy });
    
    return thingy;
}

// 18.2.2.8
function simplify (thingy)
{
    if (_.isString(thingy) || _.isBoolean(thingy) || _.isInteger(thingy) || thingy.termType)
        return thingy;
    if (_.isArray(thingy))
        return thingy.map(subthingy => simplify(subthingy));
    
    if (!thingy.type && !thingy.operator)
        throw new Error("Expected translated input.");
    
    if (thingy.type === Algebra.BGP)
        return thingy;
    
    if (thingy.type === Algebra.JOIN)
    {
        if (thingy.left.type === Algebra.BGP && thingy.left.patterns.length === 0)
            return thingy.right;
        else if (thingy.right.type === Algebra.BGP && thingy.right.patterns.length === 0)
            return thingy.left;
    }
    
    for (let key of Object.keys(thingy))
        thingy[key] = simplify(thingy[key]);
    return thingy;
}

// ---------------------------------- TRANSLATE GRAPH PATTERN HELPER FUNCTIONS ----------------------------------
function translatePathExpression (pathExp, translatedItems)
{
    let res = null;
    let items = translatedItems.map(item => _.isString(item) ? createAlgebraElement(Algebra.LINK, { iri: item }) : item);
    
    if (pathExp.pathType === '^')
        res = createAlgebraElement(Algebra.INV, { path: items[0] });
    else if (pathExp.pathType === '!')
    {
        let normals = [];
        let inverted = [];
        if (items.length !== 1)
            throw new Error("Expected exactly 1 item for '!' path operator.");
        let item = items[0];
        
        if (item.type === Algebra.LINK)
            normals.push(item);
        else if (item.type === Algebra.INV)
        {
            if (item.items.length !== 1)
                throw new Error("Expected exactly 1 item for '^' path operator.");
            inverted.push(item.items[0]);
        }
        else if (item.type === Algebra.ALT)
        {
            for (let option of [item.left, item.right])
            {
                if (option.type === Algebra.INV)
                    inverted.push(option.path);
                else
                    normals.push(option);
            }
        }
        
        // NPS elements do not have the LINK function
        let normalElement = createAlgebraElement(Algebra.NPS, { iris: normals.map(link => link.iri) });
        let invertedElement = createAlgebraElement(Algebra.INV, { path: createAlgebraElement(Algebra.NPS, { iris: inverted.map(link => link.iri) }) });
        
        if (inverted.length === 0)
            res = normalElement;
        else if (normals.length === 0)
            res = invertedElement;
        else
            res = createAlgebraElement(Algebra.ALT, { left: normalElement, right: invertedElement });
    }
    
    else if (pathExp.pathType === '/')
    {
        if (items.length < 2)
            throw new Error('Expected at least 2 items for '/' path operator.');
        res = items.reduce((acc, v) => createAlgebraElement(Algebra.SEQ, { left: acc, right: v }));
    }
    else if (pathExp.pathType === '|')
        res = items.reduce((acc, v) => createAlgebraElement(Algebra.ALT, { left: acc, right: v }));
    else if (pathExp.pathType === '*')
        res = createAlgebraElement(Algebra.ZERO_OR_MORE_PATH, { path: items[0] });
    else if (pathExp.pathType === '+')
        res = createAlgebraElement(Algebra.ONE_OR_MORE_PATH, { path: items[0] });
    else if (pathExp.pathType === '?')
        res = createAlgebraElement(Algebra.ZERO_OR_ONE_PATH, { path: items[0] });
    
    if (!res)
        throw new Error('Unable to translate path expression ' + pathExp);
    
    return res;
}

function translatePath (pathTriple, translatedPredicate)
{
    // assume path expressions have already been updated
    if (!translatedPredicate.type)
        return [ pathTriple ];
    let pred = translatedPredicate;
    let res = null;
    if (pred.type === Algebra.LINK)
        res = createTriple(pathTriple.subject, pred.iri, pathTriple.object);
    else if (pred.type === Algebra.INV) // TODO: I think this applies to inv(path) instead of inv(iri) like the spec says, I might be wrong
    {
        res = translatePath(createTriple(pathTriple.object, pathTriple.predicate, pathTriple.subject), pred.path);
    }
    else if (pred.type === Algebra.SEQ)
    {
        let v = generateFreshVar();
        let triple1 = createTriple(pathTriple.subject, pred.left, v);
        let triple2 = createTriple(v, pred.right, pathTriple.object);
        res = translatePath(triple1, triple1.predicate).concat(translatePath(triple2, triple2.predicate));
    }
    else
        res = createTriple(pathTriple.subject, pathTriple.predicate, pathTriple.object);
    
    if (!_.isArray(res))
        res = [res];
    
    return res;
}

function translateGroupOrUnionGraphPattern (group)
{
    if (group.patterns.length < 1)
        throw new Error('Expected at least one item in GroupOrUnionGraphPattern.');
    
    return group.patterns.reduce((accumulator, pattern) =>
    {
        if (pattern.type !== 'group' && pattern.type !== 'union')
            pattern = { type: 'group', patterns: [ pattern ]};
        pattern = translateGroupGraphPattern(pattern);
        if (!accumulator)
            return pattern;
        return createAlgebraElement(Algebra.UNION, { left: accumulator, right: pattern });
    }, null);
}

function translateGraphGraphPattern (group, filters)
{
    if (group.patterns.length !== 1)
        throw new Error('Expected exactly 1 item for GraphGraphPattern.');
    
    let name = group.name;
    let graph = createAlgebraElement(Algebra.GRAPH, { graph: name, input: group.patterns[0] });
    
    if (useQuads)
        graph = applyGraph(graph.input, graph.graph);
    
    if (filters.length > 0)
    {
        let filterInput = translateFilters(filters);
        // filters can contain BGPs!
        if (useQuads)
            graph = createAlgebraElement(Algebra.FILTER, { expression: applyGraph(filterInput, name), input: graph});
        else
            graph.input = createAlgebraElement(Algebra.FILTER, { expression: filterInput, input: graph.input });
    }
    
    return graph;
}

function applyGraph (thingy, graph)
{
    if (_.isArray(thingy))
        return thingy.map(subThingy => applyGraph(subThingy, graph));
    
    if (thingy.type)
    {
        if (thingy.type === Algebra.PATTERN)
            return Object.assign(thingy, { graph });
        if (thingy.type === Algebra.PATH)
            return Object.assign(thingy, { graph });
        
        for (let key of Object.keys(thingy))
            thingy[key] = applyGraph(thingy[key], graph);
        return thingy;
    }
    
    return thingy;
}

function accumulateGroupGraphPattern (G, E)
{
    // TODO: some of the patterns aren't translated yet at this point, might be code smell
    // this can happen if one of the elements was a subgroup, so shouldn't throw an error
    // TODO: or find cleaner way to handle this
    // if (E.symbol === Algebra.FILTER)
    //     throw new Error('Filters should have been removed previously.');
    if (E.type === 'optional')
    {
        if (E.patterns.length !== 1)
            throw new Error("Expected exactly 1 arg for 'optional'.");
        let A = E.patterns[0];
        if (A.type === Algebra.FILTER)
            G = createAlgebraElement(Algebra.LEFT_JOIN, { left: G, right: A.input, expression: A.expression });
        else
            G = createAlgebraElement(Algebra.LEFT_JOIN, { left: G, right: A });
    }
    else if (E.type === Algebra.MINUS)
    {
        if (E.patterns.length !== 1)
            throw new Error('MINUS element should only have 1 arg at this point.');
        G = createAlgebraElement(Algebra.MINUS, { left: G, right: E.patterns[0] });
    }
    else if (E.type === 'bind')
        G = createAlgebraElement(Algebra.EXTEND, { input: G, variable: E.variable, expression: E.expression });
    else
        G = createAlgebraElement(Algebra.JOIN, { left: G, right: E });
    
    return G;
}

function translateGroupGraphPattern (group)
{
    return group.patterns.reduce(accumulateGroupGraphPattern, createAlgebraElement(Algebra.BGP, { patterns: [] }));
}

function translateInlineData (thingy)
{
    // let values = thingy.values.map(entry =>
    // {
    //     let vals = [];
    //     for (let key of Object.keys(entry))
    //         if (entry[key] !== undefined)
    //             vals.push([key, entry[key]]);
    //     return createAlgebraElement(Algebra.ROW, vals);
    // });
    // // parser doesn't keep track of variables on first line
    let variables = thingy.values.length === 0 ? [] : Object.keys(thingy.values[0]);
    // vars = createAlgebraElement(Algebra.VARS, vars);
    // return createAlgebraElement(Algebra.TABLE, [vars].concat(values));
    return createAlgebraElement(Algebra.VALUES, { variables, bindings: thingy.values.map(binding => _.omitBy(binding, v => v === undefined)) });
}

function translateSubSelect (query)
{
    return translate(query, useQuads);
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
            return createExpression(exp.symbol, exp.args);
        if (exp.function)
            return createExpression(exp.function, exp.args);
        if (exp.operator)
            return createExpression(exp.operator, exp.args);
    });
    
    return filterExpressions.reduce((acc, val) => createExpression('&&', [acc, val]));
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
        G = createAlgebraElement(Algebra.GROUP, { expressions: query.group, input: res });
    else if (containsAggregate(query.variables) || containsAggregate(query.having) || containsAggregate(query.order))
        G = createAlgebraElement(Algebra.GROUP, { expressions: [], input: res });
    
    // TODO: not doing the sample stuff atm
    // TODO: more based on jena results than w3 spec (spec would require us to copy G multiple times)
    if (G)
    {
        // TODO: check up on scalarvals and args
        mapAggregates(query.variables, A);
        mapAggregates(query.having, A);
        mapAggregates(query.order, A);
        
        // TODO: we use the jena syntax of adding aggregates as second argument to group
        // .var will be translated later on
        G.aggregates = A.map(aggregate => { return Object.assign({var: aggregate.variable}, aggregate.object) });
        
        if (query.group)
        {
            for (let entry of query.group)
                if (entry.variable)
                    E.push(entry);
        }
        
        res = G;
    }
    
    
    // 18.2.4.2
    if (query.having)
    {
        for (let filter of query.having)
            res = createAlgebraElement(Algebra.FILTER, { expression: translateFilters(filter), input: res });
    }
    
    // 18.2.4.3
    if (query.values)
        res = createAlgebraElement(Algebra.JOIN, { left: res, right: translateInlineData(query) });
    
    // 18.2.4.4
    let PV = {};
    
    // interpret ASK as SELECT *
    if (query.queryType === 'ASK' || query.variables.indexOf('*') >= 0)
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
    
    // TODO: Jena simplifies by having a list of extends
    for (let v of E)
        res = createAlgebraElement(Algebra.EXTEND, { input: res, variable: v.variable, expression: v.expression });
    
    // 18.2.5
    //p = createAlgebraElement('tolist', [p]);
    
    // 18.2.5.1
    if (query.order)
        res = createAlgebraElement(Algebra.ORDER_BY, { input: res, expressions: query.order });
    // 18.2.5.2
    res = createAlgebraElement(Algebra.PROJECT, { input: res, variables: Object.keys(PV) });
    // 18.2.5.3
    if (query.distinct)
        res = createAlgebraElement(Algebra.DISTINCT, { input: res });
    // 18.2.5.4
    if (query.reduced)
        res = createAlgebraElement(Algebra.REDUCED, { input: res });
    // 18.2.5.5
    // we use -1 to indiciate there is no limit
    if (query.offset || query.limit)
    {
        res = createAlgebraElement(Algebra.SLICE, { input: res, start: query.offset || 0 });
        if (query.limit)
            res.length = query.limit;
    }
    
    // clean up unchanged objects
    res = translateExpressionsOperations(res);
    
    return res;
}

// ---------------------------------- TRANSLATE AGGREGATES HELPER FUNCTIONS ----------------------------------
function containsAggregate (thingy)
{
    if (!thingy)
        return false;
    
    if (thingy.expression && thingy.expression.type === 'aggregate')
        return true;
    
    if (_.isArray(thingy))
        return thingy.some(subthingy => containsAggregate(subthingy));
    
    // appears in 'having'
    if (thingy.args)
        return containsAggregate(thingy.args);
    
    return false;
}

function compareObjects (o1, o2)
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
    
    // TODO: different types for operation and functionCall
    if (thingy.type === 'operation' && thingy.operator)
        return createExpression(thingy.operator, thingy.args.map(subthingy => translateExpressionsOperations(subthingy)));
    
    if (thingy.type === 'functionCall' && thingy.function)
        return createExpression(thingy.function, thingy.args.map(subthingy => translateExpressionsOperations(subthingy)));
        
    if (thingy.type === 'aggregate' && thingy.aggregation)
    {
        let A = createAggregate(thingy.aggregation, [ translateExpressionsOperations(thingy.expression) ]);
        // TODO: put this in object somewhere
        // this is specifically for group_concat
        if (thingy.separator && thingy.separator !== ' ')
            A.separator = thingy.separator;
        // bound aggregates
        if (thingy.var)
            A.variable = thingy.var;
        if (thingy.distinct)
            A = createAlgebraElement(Algebra.DISTINCT, { input: A });
        return A;
    }
    
    if (thingy.descending && !thingy.type)
        return createExpression(Algebra.DESC, [ translateExpressionsOperations(thingy.expression) ]);
    
    if (thingy.expression && !thingy.type)
        return translateExpressionsOperations(thingy.expression);
    
    if (_.isArray(thingy))
        return thingy.map(subthingy => translateExpressionsOperations(subthingy));
    
    for (let v of Object.keys(thingy))
        thingy[v] = translateExpressionsOperations(thingy[v]);
    
    return thingy;
}
// ---------------------------------- ADD RDF.JS ----------------------------------

// at this point the only remaining fields that can have a string are `type`, `symbol` (for expressions) and `separator` (damn you group_concat)
function toRdfJs(thingy)
{
    if (_.isString(thingy))
        return createTerm(thingy);
    
    if (_.isArray(thingy))
        return thingy.map(toRdfJs);
    
    // caused by graphs already being present
    if (thingy.termType)
        return thingy;
    
    for (let key of Object.keys(thingy))
    {
        if (key === 'type' || key === 'symbol' || key === 'separator')
            continue;
        thingy[key] = toRdfJs(thingy[key]);
    }
    return thingy;
}
// ---------------------------------- END RDF.JS ----------------------------------

module.exports = translate;
