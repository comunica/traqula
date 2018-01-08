
import * as _ from 'lodash';
import * as Algebra from './algebra';
import Factory from './Factory';
import * as RDF from 'rdf-js'
import {Util as N3Util} from 'n3';
const Parser = require('sparqljs').Parser;
const types = Algebra.types;
const eTypes = Algebra.expressionTypes;

let variables = new Set<string>();
let varCount = 0;
let useQuads = false;

export default function translate(sparql: any, quads?: boolean) : Algebra.Operation
{
    variables = new Set();
    varCount = 0;
    useQuads = quads;

    if (_.isString(sparql))
    {
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
    res = translateAggregates(sparql, res, <Set<RDF.Variable>>vars);

    return res;
}

function isVariable(str: any) : boolean
{
    // there is also a '?' operator...
    return _.isString(str) && str[0] === '?' && str.length > 1;
}

// 18.2.1
function inScopeVariables(thingy: any) : {[key: string]: boolean}
{
    let inScope: {[id:string]: boolean} = {};

    if (isVariable(thingy))
    {
        inScope[thingy] = true;
        variables.add(thingy); // keep track of all variables so we don't generate duplicates
    }
    else if (_.isObject(thingy))
    {
        if (thingy.type === 'bind')
        {
            inScopeVariables(thingy.expression); // to fill `variables`
            Object.assign(inScope, inScopeVariables(thingy.variable));
        }
        else if (thingy.queryType === 'SELECT')
        {
            let all = inScopeVariables(thingy.where); // always executing this makes sure `variables` gets filled correctly
            for (let v of thingy.variables)
            {
                if (v === '*')
                    Object.assign(inScope, all);
                else if (v.variable) // aggregates
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

function translateGroupGraphPattern(thingy: any) : Algebra.Operation
{
    // 18.2.2.1
    // already done by sparql parser

    // 18.2.2.2
    let filters: any[] = [];
    let nonfilters: any[] = [];
    if (thingy.patterns)
        for (let pattern of thingy.patterns)
            (pattern.type === 'filter' ? filters : nonfilters).push(pattern);

    // 18.2.2.3
    // 18.2.2.4
    // 18.2.2.5
    if (thingy.type === 'bgp')
        return translateBgp(thingy);

    // 18.2.2.6
    let result: Algebra.Operation;
    if (thingy.type === 'union')
        result = nonfilters.map((p: any) =>
        {
            // sparqljs doesn't always indicate the children are groups
            if (p.type !== 'group')
                p = { type: 'group', patterns: [p] };
            return translateGroupGraphPattern(p);
        }).reduce((acc: Algebra.Operation, item: Algebra.Operation) => Factory.createUnion(acc, item));
    else if (thingy.type === 'graph')
        // need to handle this separately since the filters need to be in the graph
        return translateGraph(thingy);
    else if (thingy.type === 'group')
        result = nonfilters.reduce(accumulateGroupGraphPattern, Factory.createBgp([]));
    // custom values operation
    else if (thingy.type === 'values')
        result = translateInlineData(thingy);
    else if (thingy.type === 'query')
        result = translate(thingy, useQuads);
    else
        throw new Error('Unexpected type: ' + thingy.type);


    if (filters.length > 0)
    {
        let expressions: Algebra.Expression[] = filters.map(filter => translateExpression(filter.expression));
        if (expressions.length > 0)
            result = Factory.createFilter(result, expressions.reduce((acc, exp) => Factory.createOperatorExpression('&&', [acc, exp])));
    }

    return result;
}

function translateExpression(exp: any) : Algebra.Expression
{
    if (_.isString(exp))
        return Factory.createTermExpression(translateTerm(exp));
    if (exp.function)
        return Factory.createNamedExpression(<RDF.NamedNode>translateTerm(exp.function), exp.args.map(translateExpression));
    if (exp.operator)
    {
        if (exp.operator === 'exists' || exp.operator === 'notexists')
            return Factory.createExistenceExpression(exp.operator === 'notexists', translateGroupGraphPattern(exp.args[0]));
        if (exp.operator === 'in' || exp.operator === 'notin')
            exp.args = [exp.args[0]].concat(exp.args[1]); // sparql.js uses 2 arguments with the second one bing a list
        return Factory.createOperatorExpression(exp.operator, exp.args.map(translateExpression));
    }
    throw new Error('Unknown expression: ' + JSON.stringify(exp));
}

function translateBgp(thingy: any) : Algebra.Operation
{
    let patterns: Algebra.Pattern[] = [];
    let joins: Algebra.Operation[] = [];
    for (let t of thingy.triples)
    {
        if (t.predicate.type === 'path')
        {
            // translatePath returns a mix of Quads and Paths
            let path = translatePath(t);
            for (let p of path)
            {
                if (p.type === types.PATH)
                {
                    if (patterns.length > 0)
                        joins.push(Factory.createBgp(patterns));
                    patterns = [];
                    joins.push(p);
                }
                else
                    patterns.push(<Algebra.Pattern>p);
            }
        }
        else
            patterns.push(translateTriple(t));
    }
    if (patterns.length > 0)
        joins.push(Factory.createBgp(patterns));
    if (joins.length === 1)
        return joins[0];
    return joins.reduce((acc, item) => Factory.createJoin(acc, item));
}

function translatePath(triple: any) : Algebra.Operation[]
{
    let sub = translateTerm(triple.subject);
    let pred = translatePathPredicate(triple.predicate);
    let obj = translateTerm(triple.object);

    return simplifyPath(sub, pred, obj);
}

function translatePathPredicate(predicate: any) : Algebra.Operation
{
    if (_.isString(predicate))
        return Factory.createLink(<RDF.NamedNode>translateTerm(predicate));

    if (predicate.pathType === '^')
        return Factory.createInv(translatePathPredicate(predicate.items[0]));

    if (predicate.pathType === '!')
    {
        let normals: string[] = [];
        let inverted: string[] = [];
        let items = predicate.items[0].items; // the | element

        for (let item of items)
        {
            if (_.isString(item))
                normals.push(item);
            else if (item.pathType === '^')
                inverted.push(item.items[0]);
            else
                throw new Error('Unexpected item: ' + item);
        }

        // NPS elements do not have the LINK function
        let normalElement = Factory.createNps(<RDF.NamedNode[]>normals.map(translateTerm));
        let invertedElement = Factory.createInv(Factory.createNps(<RDF.NamedNode[]>inverted.map(translateTerm)));

        if (inverted.length === 0)
            return normalElement;
        if (normals.length === 0)
            return invertedElement;
        return Factory.createAlt(normalElement, invertedElement);
    }

    if (predicate.pathType === '/')
        return predicate.items.map(translatePathPredicate).reduce((acc: Algebra.Operation, p: Algebra.Operation) => Factory.createSeq(acc, p));
    if (predicate.pathType === '|')
        return predicate.items.map(translatePathPredicate).reduce((acc: Algebra.Operation, p: Algebra.Operation) => Factory.createAlt(acc, p));
    if (predicate.pathType === '*')
        return Factory.createZeroOrMorePath(translatePathPredicate(predicate.items[0]));
    if (predicate.pathType === '+')
        return Factory.createOneOrMorePath(translatePathPredicate(predicate.items[0]));
    if (predicate.pathType === '?')
        return Factory.createZeroOrOnePath(translatePathPredicate(predicate.items[0]));

    throw new Error('Unable to translate path expression ' + predicate);
}

function simplifyPath(subject: RDF.Term, predicate: Algebra.Operation, object: RDF.Term) : Algebra.Operation[]
{
    if (predicate.type === types.LINK)
        return [Factory.createPattern(subject, (<Algebra.Link>predicate).iri, object, defaultGraph)];

    if (predicate.type === types.INV)
        return simplifyPath(object, (<Algebra.Inv>predicate).path, subject);

    if (predicate.type === types.SEQ)
    {
        let v = generateFreshVar();
        let left = simplifyPath(subject, (<Algebra.Seq>predicate).left, v);
        let right = simplifyPath(v, (<Algebra.Seq>predicate).right, object);
        return left.concat(right);
    }

    return [Factory.createPath(subject, predicate, object, defaultGraph)];
}

function generateFreshVar() : RDF.Variable
{
    let v: string = '?var' + varCount++;
    if (variables.has(v))
        return generateFreshVar();
    variables.add(v);
    return <RDF.Variable>translateTerm(v);
}

const defaultGraph: RDF.DefaultGraph = <RDF.DefaultGraph>{ termType: 'DefaultGraph', value: ''};
function translateTriple(triple: any) : Algebra.Pattern
{
    return Factory.createPattern(translateTerm(triple.subject), translateTerm(triple.predicate), translateTerm(triple.object), defaultGraph);
}

const stringType = <RDF.NamedNode>translateTerm('http://www.w3.org/2001/XMLSchema#string');
const langStringType = <RDF.NamedNode>translateTerm('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
function translateTerm(str: any) : RDF.Term
{
    if (str[0] === '?')
        return <RDF.Variable>{ termType: 'Variable', value: str.substring(1) };
    if (_.startsWith(str, '_:'))
        return <RDF.BlankNode>{ termType: 'BlankNode', value: str.substring(2) };
    if (N3Util.isLiteral(str))
    {
        let literal: RDF.Literal = <RDF.Literal>{ termType: 'Literal', value: N3Util.getLiteralValue(str), language: '', datatype: stringType };
        let lang = N3Util.getLiteralLanguage(str);
        if (lang && lang.length > 0)
        {
            literal.language = lang;
            literal.datatype = langStringType;
        }
        else
        {
            let type = N3Util.getLiteralType(str);
            if (type && type.length > 0)
                literal.datatype = <RDF.NamedNode>translateTerm(type);
        }
        return literal;
    }
    return <RDF.NamedNode> { termType: 'NamedNode', value: str };
}

function translateGraph(graph: any) : Algebra.Operation
{
    let name = <RDF.NamedNode>translateTerm(graph.name);
    graph.type = 'group';
    let result = translateGroupGraphPattern(graph);
    if (useQuads)
        result = recurseGraph(result, name);
    else
        result = Factory.createGraph(result, name);

    return result;
}

let typeVals = Object.keys(types).map(key => (<any>types)[key]);
function recurseGraph(thingy: Algebra.Operation, graph: RDF.NamedNode) : Algebra.Operation
{
    if (thingy.type === types.BGP)
        (<Algebra.Bgp>thingy).patterns = (<Algebra.Bgp>thingy).patterns.map(quad =>
        {
            quad.graph = graph;
            return quad;
        });
    else if (thingy.type === types.PATH)
        (<Algebra.Path>thingy).graph = graph;
    else
    {
        for (let key of Object.keys(thingy))
        {
            if (_.isArray(thingy[key]))
                thingy[key] = thingy[key].map((x: any) => recurseGraph(x, graph));
            else if (typeVals.indexOf(thingy[key].type) >= 0) // can't do instanceof on an interface
                thingy[key] = recurseGraph(thingy[key], graph);
        }
    }

    return thingy;
}

function accumulateGroupGraphPattern(G: Algebra.Operation, E: any) : Algebra.Operation
{
    if (E.type === 'optional')
    {
        // optional input needs to be interpreted as a group
        let A: Algebra.Operation = translateGroupGraphPattern({ type: 'group', patterns: E.patterns });
        if (A.type === types.FILTER)
        {
            let filter = <Algebra.Filter> A;
            G = Factory.createLeftJoin(G, filter.input, filter.expression);
        }
        else
            G = Factory.createLeftJoin(G, A);
    }
    else if (E.type === 'minus')
    {
        // minus input needs to be interpreted as a group
        let A: Algebra.Operation = translateGroupGraphPattern({ type: 'group', patterns: E.patterns });
        G = Factory.createMinus(G, A);
    }
    else if (E.type === 'bind')
        G = Factory.createExtend(G, <RDF.Variable>translateTerm(E.variable), translateExpression(E.expression));
    else
    {
        // 18.2.2.8 (simplification)
        let A = translateGroupGraphPattern(E);
        if (G.type === types.BGP && (<Algebra.Bgp>G).patterns.length === 0)
            G = A;
        else if (A.type === types.BGP && (<Algebra.Bgp>A).patterns.length === 0)
        {} // do nothing
        else
            G = Factory.createJoin(G, translateGroupGraphPattern(E));
    }

    return G;
}

function translateInlineData(values: any) : Algebra.Values
{
    let variables = <RDF.Variable[]>(values.values.length === 0 ? [] : Object.keys(values.values[0])).map(translateTerm);
    let bindings = values.values.map((binding: any) =>
    {
        let keys = Object.keys(binding);
        keys = keys.filter(k => binding[k] !== undefined);
        let map = new Map<RDF.Variable, RDF.Term>();
        for (let key of keys)
            map.set(<RDF.Variable>translateTerm(key), translateTerm(binding[key]));
        return map;
    });
    return Factory.createValues(variables, bindings);
}

// --------------------------------------- AGGREGATES
function translateAggregates(query: any, res: Algebra.Operation, variables: Set<RDF.Variable>) : Algebra.Operation
{
    // 18.2.4.1
    let E = [];

    let A: any = {};
    query.variables = mapAggregates(query.variables, A);
    query.having = mapAggregates(query.having, A);
    query.order = mapAggregates(query.order, A);

    // if there are any aggregates or if we have a groupBy (both result in a GROUP)
    if (query.group || Object.keys(A).length > 0)
    {
        let aggregates = Object.keys(A).map(v => translateBoundAggregate(A[v], <RDF.Variable>translateTerm(v)));
        let exps: Algebra.Expression[] = [];
        if (query.group)
        {
            for (let entry of query.group)
                if (entry.variable)
                    E.push(entry);
            exps = query.group.map((e: any) => e.expression).map(translateExpression);
        }
        res = Factory.createGroup(res, exps, aggregates);
    }

    // 18.2.4.2
    if (query.having)
        for (let filter of query.having)
            res = Factory.createFilter(res, translateExpression(filter));

    // 18.2.4.3
    if (query.values)
        res = Factory.createJoin(res, translateInlineData(query));

    // 18.2.4.4
    let PV = new Set<RDF.Variable>();

    // interpret other query types as SELECT *
    if (query.queryType !== 'SELECT' || query.variables.indexOf('*') >= 0)
        PV = variables;
    else
    {
        for (let v of query.variables)
        {
            if (isVariable(v))
                PV.add(<RDF.Variable>translateTerm(v));
            else if (v.variable)
            {
                PV.add(<RDF.Variable>translateTerm(v.variable));
                E.push(v);
            }
        }
    }

    // TODO: Jena simplifies by having a list of extends
    for (let v of E)
        res = Factory.createExtend(res, <RDF.Variable>translateTerm(v.variable), translateExpression(v.expression));

    // 18.2.5
    // not using toList and toMultiset

    // 18.2.5.1
    if (query.order)
        res = Factory.createOrderBy(res, query.order.map((exp: any) =>
        {
            let result = translateExpression(exp.expression);
            if (exp.descending)
                result = Factory.createOperatorExpression(types.DESC, [result]); // TODO: should this really be an epxression?
            return result;
        }));

    // 18.2.5.2
    // construct does not need a project (select, ask and describe do)
    if (query.queryType !== 'CONSTRUCT')
        res = Factory.createProject(res, Array.from(PV));

    // 18.2.5.3
    if (query.distinct)
        res = Factory.createDistinct(res);

    // 18.2.5.4
    if (query.reduced)
        res = Factory.createReduced(res);

    // NEW: support for construct queries
    // limits are also applied to construct results, which is why those come last, although results should be the same
    if (query.queryType === 'CONSTRUCT')
        res = Factory.createConstruct(res, query.template.map(translateTriple));

    // 18.2.5.5
    if (query.offset || query.limit)
    {
        res = Factory.createSlice(res, query.offset || 0);
        if (query.limit)
            res.length = query.limit;
    }

    return res;
}

// rewrites some of the input sparql object to make use of aggregate variables
function mapAggregates (thingy: any, aggregates: {[key: string]: any}) : any
{
    if (!thingy)
        return thingy;

    if (thingy.type === 'aggregate')
    {
        let found = false;
        let v;
        for (let key of Object.keys(aggregates))
        {
            if (_.isEqual(aggregates[key], thingy))
            {
                v = key;
                found = true;
                break;
            }
        }
        if (!found)
        {
            v = '?' + generateFreshVar().value;// this is still in "sparql.js language" so a var string is still needed
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

function translateBoundAggregate (thingy: any, v: RDF.Variable) : Algebra.BoundAggregate
{
    if (thingy.type !== 'aggregate' || !thingy.aggregation)
        throw new Error('Unexpected input: ' + JSON.stringify(thingy));

    let A = Factory.createBoundAggregate(v, thingy.aggregation, translateExpression(thingy.expression));
    if (thingy.separator)
        A.separator = thingy.separator;

    return A;
}