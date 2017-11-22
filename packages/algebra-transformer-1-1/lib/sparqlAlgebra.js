"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Algebra = require("./algebra");
const Factory_1 = require("./Factory");
const n3_1 = require("n3");
const Parser = require('sparqljs').Parser;
const types = Algebra.types;
const eTypes = Algebra.expressionTypes;
let variables = new Set();
let varCount = 0;
let useQuads = false;
function translate(sparql, quads) {
    variables = new Set();
    varCount = 0;
    useQuads = quads;
    if (_.isString(sparql)) {
        let parser = new Parser();
        // resets the identifier counter used for blank nodes
        // provides nicer and more consistent output if there are multiple calls
        parser._resetBlanks();
        sparql = parser.parse(sparql);
    }
    if (sparql.type !== 'query')
        throw new Error('Translate only works on complete query objects.');
    // group and where are identical, having only 1 makes parsing easier
    let group = { type: 'group', patterns: sparql.where };
    let vars = new Set(Object.keys(inScopeVariables(group)).map(translateTerm));
    let res = translateGroupGraphPattern(group);
    res = translateAggregates(sparql, res, vars);
    return res;
}
exports.default = translate;
function isVariable(str) {
    // there is also a '?' operator...
    return _.isString(str) && str[0] === '?' && str.length > 1;
}
// 18.2.1
function inScopeVariables(thingy) {
    let inScope = {};
    if (isVariable(thingy)) {
        inScope[thingy] = true;
        variables.add(thingy); // keep track of all variables so we don't generate duplicates
    }
    else if (_.isObject(thingy)) {
        if (thingy.type === 'bind') {
            inScopeVariables(thingy.expression); // to fill `variables`
            Object.assign(inScope, inScopeVariables(thingy.variable));
        }
        else if (thingy.queryType === 'SELECT') {
            let all = inScopeVariables(thingy.where); // always executing this makes sure `variables` gets filled correctly
            for (let v of thingy.variables) {
                if (v === '*')
                    Object.assign(inScope, all);
                else if (v.variable)
                    Object.assign(inScope, inScopeVariables(v.variable));
                else
                    Object.assign(inScope, inScopeVariables(v));
            }
            // TODO: I'm not 100% sure if you always add these or only when '*' was selected
            if (thingy.group)
                for (let v of thingy.group)
                    Object.assign(inScope, inScopeVariables(v));
        }
        else
            for (let key of Object.keys(thingy))
                Object.assign(inScope, inScopeVariables(thingy[key]));
    }
    return inScope;
}
function translateGroupGraphPattern(thingy) {
    // 18.2.2.1
    // already done by sparql parser
    // 18.2.2.2
    let filters = [];
    let nonfilters = [];
    if (thingy.patterns)
        for (let pattern of thingy.patterns)
            (pattern.type === 'filter' ? filters : nonfilters).push(pattern);
    // 18.2.2.3
    // 18.2.2.4
    // 18.2.2.5
    if (thingy.type === 'bgp')
        return translateBgp(thingy);
    // 18.2.2.6
    let result;
    if (thingy.type === 'union')
        result = nonfilters.map((p) => {
            // algebrajs doesn't always indicate the children are groups
            if (p.type !== 'group')
                p = { type: 'group', patterns: [p] };
            return translateGroupGraphPattern(p);
        }).reduce((acc, item) => Factory_1.default.createUnion(acc, item));
    else if (thingy.type === 'graph')
        // need to handle this separately since the filters need to be in the graph
        return translateGraph(thingy);
    else if (thingy.type === 'group')
        result = nonfilters.reduce(accumulateGroupGraphPattern, Factory_1.default.createBgp([]));
    else if (thingy.type === 'values')
        result = translateInlineData(thingy);
    else if (thingy.type === 'query')
        result = translate(thingy, useQuads);
    else
        throw new Error('Unexpected type: ' + thingy.type);
    if (filters.length > 0) {
        let expressions = filters.map(filter => translateExpression(filter.expression));
        if (expressions.length > 0)
            result = Factory_1.default.createFilter(result, expressions.reduce((acc, exp) => Factory_1.default.createOperatorExpression('&&', [acc, exp])));
    }
    return result;
}
function translateExpression(exp) {
    if (_.isString(exp))
        return Factory_1.default.createTermExpression(translateTerm(exp));
    if (exp.function)
        return Factory_1.default.createNamedExpression(translateTerm(exp.function), exp.args.map(translateExpression));
    if (exp.operator) {
        if (exp.operator === 'exists' || exp.operator === 'notexists')
            return Factory_1.default.createExistenceExpression(exp.operator === 'notexists', translateGroupGraphPattern(exp.args[0]));
        if (exp.operator === 'in' || exp.operator === 'notin')
            exp.args = [exp.args[0]].concat(exp.args[1]); // sparql.js uses 2 arguments with the second one bing a list
        return Factory_1.default.createOperatorExpression(exp.operator, exp.args.map(translateExpression));
    }
    throw new Error('Unknown expression: ' + JSON.stringify(exp));
}
function translateBgp(thingy) {
    let patterns = [];
    let joins = [];
    for (let t of thingy.triples) {
        if (t.predicate.type === 'path') {
            // translatePath returns a mix of Quads and Paths
            let path = translatePath(t);
            for (let p of path) {
                if (p.type === types.PATH) {
                    if (patterns.length > 0)
                        joins.push(Factory_1.default.createBgp(patterns));
                    patterns = [];
                    joins.push(p);
                }
                else
                    patterns.push(p);
            }
        }
        else
            patterns.push(translateTriple(t));
    }
    if (patterns.length > 0)
        joins.push(Factory_1.default.createBgp(patterns));
    if (joins.length === 1)
        return joins[0];
    return joins.reduce((acc, item) => Factory_1.default.createJoin(acc, item));
}
function translatePath(triple) {
    let sub = translateTerm(triple.subject);
    let pred = translatePathPredicate(triple.predicate);
    let obj = translateTerm(triple.object);
    return simplifyPath(sub, pred, obj);
}
function translatePathPredicate(predicate) {
    if (_.isString(predicate))
        return Factory_1.default.createLink(translateTerm(predicate));
    if (predicate.pathType === '^')
        return Factory_1.default.createInv(translatePathPredicate(predicate.items[0]));
    if (predicate.pathType === '!') {
        let normals = [];
        let inverted = [];
        let items = predicate.items[0].items; // the | element
        for (let item of items) {
            if (_.isString(item))
                normals.push(item);
            else if (item.pathType === '^')
                inverted.push(item.items[0]);
            else
                throw new Error('Unexpected item: ' + item);
        }
        // NPS elements do not have the LINK function
        let normalElement = Factory_1.default.createNps(normals.map(translateTerm));
        let invertedElement = Factory_1.default.createInv(Factory_1.default.createNps(inverted.map(translateTerm)));
        if (inverted.length === 0)
            return normalElement;
        if (normals.length === 0)
            return invertedElement;
        return Factory_1.default.createAlt(normalElement, invertedElement);
    }
    if (predicate.pathType === '/')
        return predicate.items.map(translatePathPredicate).reduce((acc, p) => Factory_1.default.createSeq(acc, p));
    if (predicate.pathType === '|')
        return predicate.items.map(translatePathPredicate).reduce((acc, p) => Factory_1.default.createAlt(acc, p));
    if (predicate.pathType === '*')
        return Factory_1.default.createZeroOrMorePath(translatePathPredicate(predicate.items[0]));
    if (predicate.pathType === '+')
        return Factory_1.default.createOneOrMorePath(translatePathPredicate(predicate.items[0]));
    if (predicate.pathType === '?')
        return Factory_1.default.createZeroOrOnePath(translatePathPredicate(predicate.items[0]));
    throw new Error('Unable to translate path expression ' + predicate);
}
function simplifyPath(subject, predicate, object) {
    if (predicate.type === types.LINK)
        return [Factory_1.default.createPattern(subject, predicate.iri, object, defaultGraph)];
    if (predicate.type === types.INV)
        return simplifyPath(object, predicate.path, subject);
    if (predicate.type === types.SEQ) {
        let v = generateFreshVar();
        let left = simplifyPath(subject, predicate.left, v);
        let right = simplifyPath(v, predicate.right, object);
        return left.concat(right);
    }
    return [Factory_1.default.createPath(subject, predicate, object, defaultGraph)];
}
function generateFreshVar() {
    let v = '?var' + varCount++;
    if (variables.has(v))
        return generateFreshVar();
    variables.add(v);
    return translateTerm(v);
}
const defaultGraph = { termType: 'DefaultGraph', value: '' };
function translateTriple(triple) {
    return Factory_1.default.createPattern(translateTerm(triple.subject), translateTerm(triple.predicate), translateTerm(triple.object), defaultGraph);
}
const stringType = translateTerm('http://www.w3.org/2001/XMLSchema#string');
const langStringType = translateTerm('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
function translateTerm(str) {
    if (str[0] === '?')
        return { termType: 'Variable', value: str.substring(1) };
    if (_.startsWith(str, '_:'))
        return { termType: 'BlankNode', value: str.substring(2) };
    if (n3_1.Util.isLiteral(str)) {
        let literal = { termType: 'Literal', value: n3_1.Util.getLiteralValue(str), language: '', datatype: stringType };
        let lang = n3_1.Util.getLiteralLanguage(str);
        if (lang && lang.length > 0) {
            literal.language = lang;
            literal.datatype = langStringType;
        }
        else {
            let type = n3_1.Util.getLiteralType(str);
            if (type && type.length > 0)
                literal.datatype = translateTerm(type);
        }
        return literal;
    }
    return { termType: 'NamedNode', value: str };
}
function translateGraph(graph) {
    let name = translateTerm(graph.name);
    graph.type = 'group';
    let result = translateGroupGraphPattern(graph);
    if (useQuads)
        result = recurseGraph(result, name);
    else
        result = Factory_1.default.createGraph(result, name);
    return result;
}
let typeVals = Object.keys(types).map(key => types[key]);
function recurseGraph(thingy, graph) {
    if (thingy.type === types.BGP)
        thingy.patterns = thingy.patterns.map(quad => {
            quad.graph = graph;
            return quad;
        });
    else if (thingy.type === types.PATH)
        thingy.graph = graph;
    else {
        for (let key of Object.keys(thingy)) {
            if (_.isArray(thingy[key]))
                thingy[key] = thingy[key].map((x) => recurseGraph(x, graph));
            else if (typeVals.indexOf(thingy[key].type) >= 0)
                thingy[key] = recurseGraph(thingy[key], graph);
        }
    }
    return thingy;
}
function accumulateGroupGraphPattern(G, E) {
    if (E.type === 'optional') {
        // optional input needs to be interpreted as a group
        let A = translateGroupGraphPattern({ type: 'group', patterns: E.patterns });
        if (A.type === types.FILTER) {
            let filter = A;
            G = Factory_1.default.createLeftJoin(G, filter.input, filter.expression);
        }
        else
            G = Factory_1.default.createLeftJoin(G, A);
    }
    else if (E.type === 'minus') {
        // minus input needs to be interpreted as a group
        let A = translateGroupGraphPattern({ type: 'group', patterns: E.patterns });
        G = Factory_1.default.createMinus(G, A);
    }
    else if (E.type === 'bind')
        G = Factory_1.default.createExtend(G, translateTerm(E.variable), translateExpression(E.expression));
    else {
        // 18.2.2.8 (simplification)
        let A = translateGroupGraphPattern(E);
        if (G.type === types.BGP && G.patterns.length === 0)
            G = A;
        else if (A.type === types.BGP && A.patterns.length === 0) { } // do nothing
        else
            G = Factory_1.default.createJoin(G, translateGroupGraphPattern(E));
    }
    return G;
}
function translateInlineData(values) {
    let variables = (values.values.length === 0 ? [] : Object.keys(values.values[0])).map(translateTerm);
    let bindings = values.values.map((binding) => {
        let keys = Object.keys(binding);
        keys = keys.filter(k => binding[k] !== undefined);
        let map = new Map();
        for (let key of keys)
            map.set(translateTerm(key), translateTerm(binding[key]));
        return map;
    });
    return Factory_1.default.createValues(variables, bindings);
}
// --------------------------------------- AGGREGATES
function translateAggregates(query, res, variables) {
    // 18.2.4.1
    let E = [];
    let A = {};
    query.variables = mapAggregates(query.variables, A);
    query.having = mapAggregates(query.having, A);
    query.order = mapAggregates(query.order, A);
    // if there are any aggregates or if we have a groupBy (both result in a GROUP)
    if (query.group || Object.keys(A).length > 0) {
        let aggregates = Object.keys(A).map(v => translateBoundAggregate(A[v], translateTerm(v)));
        let exps = [];
        if (query.group) {
            for (let entry of query.group)
                if (entry.variable)
                    E.push(entry);
            exps = query.group.map((e) => e.expression).map(translateExpression);
        }
        res = Factory_1.default.createGroup(res, exps, aggregates);
    }
    // 18.2.4.2
    if (query.having)
        for (let filter of query.having)
            res = Factory_1.default.createFilter(res, translateExpression(filter));
    // 18.2.4.3
    if (query.values)
        res = Factory_1.default.createJoin(res, translateInlineData(query));
    // 18.2.4.4
    let PV = new Set();
    // interpret other query types as SELECT *
    if (query.queryType !== 'SELECT' || query.variables.indexOf('*') >= 0)
        PV = variables;
    else {
        for (let v of query.variables) {
            if (isVariable(v))
                PV.add(translateTerm(v));
            else if (v.variable) {
                PV.add(translateTerm(v.variable));
                E.push(v);
            }
        }
    }
    // TODO: Jena simplifies by having a list of extends
    for (let v of E)
        res = Factory_1.default.createExtend(res, translateTerm(v.variable), translateExpression(v.expression));
    // 18.2.5
    // not using toList and toMultiset
    // 18.2.5.1
    if (query.order)
        res = Factory_1.default.createOrderBy(res, query.order.map((exp) => {
            let result = translateExpression(exp.expression);
            if (exp.descending)
                result = Factory_1.default.createOperatorExpression(types.DESC, [result]); // TODO: should this really be an epxression?
            return result;
        }));
    // 18.2.5.2
    res = Factory_1.default.createProject(res, Array.from(PV));
    // 18.2.5.3
    if (query.distinct)
        res = Factory_1.default.createDistinct(res);
    // 18.2.5.4
    if (query.reduced)
        res = Factory_1.default.createReduced(res);
    // NEW: support for construct queries
    // limits are also applied to construct results, which is why those come last, although results should be the same
    if (query.queryType === 'CONSTRUCT')
        res = Factory_1.default.createConstruct(res, query.template.map(translateTriple));
    // 18.2.5.5
    if (query.offset || query.limit) {
        res = Factory_1.default.createSlice(res, query.offset || 0);
        if (query.limit)
            res.length = query.limit;
    }
    return res;
}
// rewrites some of the input sparql object to make use of aggregate variables
function mapAggregates(thingy, aggregates) {
    if (!thingy)
        return thingy;
    if (thingy.type === 'aggregate') {
        let found = false;
        let v;
        for (let key of Object.keys(aggregates)) {
            if (_.isEqual(aggregates[key], thingy)) {
                v = key;
                found = true;
                break;
            }
        }
        if (!found) {
            v = '?' + generateFreshVar().value; // this is still in "sparql.js language" so a var string is still needed
            aggregates[v] = thingy;
        }
        return v; // this is still in "sparql.js language" so a var string is still needed
    }
    // non-aggregate expression
    if (thingy.expression)
        thingy.expression = mapAggregates(thingy.expression, aggregates);
    else if (thingy.args)
        mapAggregates(thingy.args, aggregates);
    else if (_.isArray(thingy))
        thingy.forEach((subthingy, idx) => thingy[idx] = mapAggregates(subthingy, aggregates));
    return thingy;
}
function translateBoundAggregate(thingy, v) {
    if (thingy.type !== 'aggregate' || !thingy.aggregation)
        throw new Error('Unexpected input: ' + JSON.stringify(thingy));
    let A = Factory_1.default.createBoundAggregate(v, thingy.aggregation, translateExpression(thingy.expression));
    if (thingy.separator)
        A.separator = thingy.separator;
    return A;
}
//# sourceMappingURL=sparqlAlgebra.js.map