
import * as Algebra from './algebra';
import * as RDF from 'rdf-js'
import Factory from "./factory";
import Util from "./util";
import {termToString} from "rdf-string";
import {Wildcard} from "./wildcard";
const SparqlGenerator = require('sparqljs').Generator;
const Wildcard = require('sparqljs').Wildcard;
const types = Algebra.types;
const eTypes = Algebra.expressionTypes;

let context : { project: boolean, extend: Algebra.Extend[], group: RDF.Variable[], aggregates: Algebra.BoundAggregate[], order: Algebra.Expression[] };
const factory = new Factory();

export function toSparql(op: Algebra.Operation): string
{
    let generator = new SparqlGenerator();
    return generator.stringify(toSparqlJs(op));
}

export function toSparqlJs(op: Algebra.Operation):  any
{
    resetContext();
    op = removeQuads(op);
    let result = translateOperation(op);
    if (result.type === 'group')
        return result.patterns[0];
    return result;
}

function flatten(s: any[]): any
{
    return Array.prototype.concat(...s).filter(x => x);
}

function resetContext()
{
    context = { project: false, extend: [], group: [], aggregates: [], order: [] };
}

function translateOperation(op: Algebra.Operation): any
{
    // this allows us to differentiate between BIND and SELECT when translating EXTEND
    if (op.type !== types.EXTEND && op.type !== types.ORDER_BY)
        context.project = false;

    switch(op.type)
    {
        case types.EXPRESSION: return translateExpression(<Algebra.Expression>op);

        case types.ASK:       return translateProject(<Algebra.Ask>op, types.ASK);
        case types.BGP:       return translateBgp(<Algebra.Bgp>op);
        case types.CONSTRUCT: return translateConstruct(<Algebra.Construct>op);
        case types.DESCRIBE:  return translateProject(<Algebra.Describe>op, types.DESCRIBE);
        case types.DISTINCT:  return translateDistinct(<Algebra.Distinct>op);
        case types.EXTEND:    return translateExtend(<Algebra.Extend>op);
        case types.FROM:      return translateFrom(<Algebra.From>op);
        case types.FILTER:    return translateFilter(<Algebra.Filter>op);
        case types.GRAPH:     return translateGraph(<Algebra.Graph>op);
        case types.GROUP:     return translateGroup(<Algebra.Group>op);
        case types.JOIN:      return translateJoin(<Algebra.Join>op);
        case types.LEFT_JOIN: return translateLeftJoin(<Algebra.LeftJoin>op);
        case types.MINUS:     return translateMinus(<Algebra.Minus>op);
        case types.ORDER_BY:  return translateOrderBy(<Algebra.OrderBy>op);
        case types.PATH:      return translatePath(<Algebra.Path>op);
        case types.PATTERN:   return translatePattern(<Algebra.Pattern>op);
        case types.PROJECT:   return translateProject(<Algebra.Project>op, types.PROJECT);
        case types.REDUCED:   return translateReduced(<Algebra.Reduced>op);
        case types.SERVICE:   return translateService(<Algebra.Service>op);
        case types.SLICE:     return translateSlice(<Algebra.Slice>op);
        case types.UNION:     return translateUnion(<Algebra.Union>op);
        case types.VALUES:    return translateValues(<Algebra.Values>op);
    }

    throw new Error('Unknown Operation type ' + op.type);
}

function translateExpression(expr: Algebra.Expression): any
{
    switch(expr.expressionType)
    {
        case eTypes.AGGREGATE: return translateAggregateExpression(<Algebra.AggregateExpression>expr);
        case eTypes.EXISTENCE: return translateExistenceExpression(<Algebra.ExistenceExpression>expr);
        case eTypes.NAMED:     return translateNamedExpression(<Algebra.NamedExpression>expr);
        case eTypes.OPERATOR:  return translateOperatorExpression(<Algebra.OperatorExpression>expr);
        case eTypes.TERM:      return translateTermExpression(<Algebra.TermExpression>expr);
        case eTypes.WILDCARD:  return translateWildcardExpression(<Algebra.WildcardExpression>expr);
    }

    throw new Error('Unknown Expression Operation type ' + expr.expressionType);
}

function translatePathComponent(path: Algebra.Operation): any
{
    switch(path.type)
    {
        case types.ALT:               return translateAlt(<Algebra.Alt>path);
        case types.INV:               return translateInv(<Algebra.Inv>path);
        case types.LINK:              return translateLink(<Algebra.Link>path);
        case types.NPS:               return translateNps(<Algebra.Nps>path);
        case types.ONE_OR_MORE_PATH:  return translateOneOrMorePath(<Algebra.OneOrMorePath>path);
        case types.SEQ:               return translateSeq(<Algebra.Seq>path);
        case types.ZERO_OR_MORE_PATH: return translateZeroOrMorePath(<Algebra.ZeroOrMorePath>path);
        case types.ZERO_OR_ONE_PATH:  return translateZeroOrOnePath(<Algebra.ZeroOrOnePath>path);
    }

    throw new Error('Unknown Path type ' + path.type);
}

function translateTerm(term: RDF.Term): string
{
    return termToString(term);
}

// ------------------------- EXPRESSIONS -------------------------

function translateAggregateExpression(expr: Algebra.AggregateExpression): any
{
    let result: any = {
        expression: translateExpression(expr.expression),
        type: 'aggregate',
        aggregation: expr.aggregator,
        distinct: expr.distinct
    };

    if (expr.separator)
        result.separator = expr.separator;

    return result;
}

function translateExistenceExpression(expr: Algebra.ExistenceExpression): any
{
    return {
        type: 'operation',
        operator: expr.not ? 'notexists' : 'exists',
        args: flatten([
            translateOperation(expr.input)
        ])
    };
}

function translateNamedExpression(expr: Algebra.NamedExpression): any
{
    return {
        type: 'functionCall',
        function: expr.name,
        args: expr.args.map(translateExpression)
    }
}

function translateOperatorExpression(expr: Algebra.OperatorExpression): any
{
    if (expr.operator === 'desc')
    {
        let result: any = { expression: translateExpression(expr.args[0])};
        result.descending = true;
        return result;
    }

    let result = {
        type: 'operation',
        operator: expr.operator,
        args: expr.args.map(translateExpression)
    };

    if (result.operator === 'in' || result.operator === 'notin')
        result.args = [result.args[0]].concat([result.args.slice(1)]);

    return result;
}

function translateTermExpression(expr: Algebra.TermExpression): RDF.Term
{
    return expr.term;
}

function translateWildcardExpression(expr: Algebra.WildcardExpression): Wildcard
{
    return expr.wildcard;
}


// ------------------------- OPERATIONS -------------------------
// these get translated in the project function
function translateBoundAggregate(op: Algebra.BoundAggregate): Algebra.BoundAggregate
{
    return op;
}

function translateBgp(op: Algebra.Bgp): any
{
    let patterns = op.patterns.map(translatePattern);
    if (patterns.length === 0)
        return null;
    return {
        type: 'bgp',
        triples: patterns
    };
}

function translateConstruct(op: Algebra.Construct): any
{
    return {
        type: 'query',
        prefixes: {},
        queryType: "CONSTRUCT",
        template: op.template.map(translatePattern),
        where: flatten([
            translateOperation(op.input)
        ])
    }
}

function translateDistinct(op: Algebra.Distinct): any
{
    let result = translateOperation(op.input);
    // project is nested in group object
    result.patterns[0].distinct = true;
    return result
}

function translateExtend(op: Algebra.Extend): any
{
    if (context.project)
    {
        context.extend.push(op);
        return translateOperation(op.input);
    }
    return flatten([
        translateOperation(op.input),
        {
            type: 'bind',
            variable: op.variable,
            expression: translateExpression(op.expression)
        }
    ])
}

function translateFrom(op: Algebra.From): any
{
    let result = translateOperation(op.input);
    // project is nested in group object
    let obj = result.patterns[0];
    obj.from = {
        default: op.default,
        named: op.named
    };
    return result;
}

function translateFilter(op: Algebra.Filter): any
{
    return {
        type: 'group',
        patterns:  flatten ([
                translateOperation(op.input),
                { type : 'filter', expression: translateExpression(op.expression) }
            ])
    };
}

function translateGraph(op: Algebra.Graph): any
{
    return {
        type: 'graph',
        patterns: flatten([ translateOperation(op.input) ]),
        name: op.name
    }
}

function translateGroup(op: Algebra.Group): any
{
    let input = translateOperation(op.input);
    let aggs = op.aggregates.map(translateBoundAggregate);
    context.aggregates.push(...aggs);
    // TODO: apply possible extends
    context.group.push(...op.variables);

    return input;
}

function translateJoin(op: Algebra.Join): any
{
    return flatten([
        translateOperation(op.left),
        translateOperation(op.right)
    ])
}

function translateLeftJoin(op: Algebra.LeftJoin): any
{
    let leftjoin = {
        type: 'optional',
        patterns: [
            translateOperation(op.right)
        ]
    };

    if (op.expression)
    {
        leftjoin.patterns.push(
            {
                type: 'filter',
                expression: translateExpression(op.expression)
            }
        );
    }
    leftjoin.patterns = flatten(leftjoin.patterns);

    return flatten([
        translateOperation(op.left),
        leftjoin
    ])
}

function translateMinus(op: Algebra.Minus): any
{
    let patterns = translateOperation(op.right);
    if (patterns.type === 'group')
        patterns = patterns.patterns;
    return flatten([
        translateOperation(op.left),
        {
            type: 'minus',
            patterns: patterns
        }
    ]);
}

function translateOrderBy(op: Algebra.OrderBy): any
{
    context.order.push(...op.expressions);
    return translateOperation(op.input);
}

function translatePath(op: Algebra.Path): any
{
    // TODO: quads back to graph statement
    return {
        type: 'bgp',
        triples: [{
            subject  : op.subject,
            predicate: translatePathComponent(op.predicate),
            object   : op.object
        }]
    };
}

function translatePattern(op: Algebra.Pattern): any
{
    // TODO: quads back to graph statement
    return {
        subject: op.subject,
        predicate: op.predicate,
        object: op.object
    };
}

function replaceAggregatorVariables(s: any, map: any)
{
    let st = Util.isTerm(s) ? translateTerm(s) : s;

    if (typeof st === 'string')
    {
        if (map[st])
            return map[st];
    }
    else if (Array.isArray(s))
    {
        s = s.map(e => replaceAggregatorVariables(e, map));
    }
    else
    {
        for (let key of Object.keys(s))
            s[key] = replaceAggregatorVariables(s[key], map);
    }
    return s;
}

function translateProject(op: Algebra.Project | Algebra.Ask | Algebra.Describe, type: string): any
{
    let result: any = {
        type: 'query',
        prefixes: {}
    };

    if (type === types.PROJECT)
    {
        result.queryType = 'SELECT';
        result.variables = op.variables;
    } else if (type === types.ASK) {
        result.queryType = 'ASK';
    } else if (type === types.DESCRIBE) {
        result.queryType = 'DESCRIBE';
        result.variables = op.terms;
    }

    // backup values in case of nested queries
    // everything in extend, group, etc. is irrelevant for this project call
    let extend = context.extend;
    let group = context.group;
    let aggregates = context.aggregates;
    let order = context.order;
    resetContext();

    context.project = true;
    let input = flatten([ translateOperation(op.input) ]);
    if (input.length === 1 && input[0].type === 'group')
        input = input[0].patterns;
    result.where = input;

    let aggregators: any = {};
    // these can not reference each other
    for (let agg of context.aggregates)
        aggregators[translateTerm(agg.variable)] = translateExpression(agg);

    // do these in reverse order since variables in one extend might apply to an expression in an other extend
    let extensions: any = {};
    for (let i = context.extend.length-1; i >= 0; --i)
    {
        let e = context.extend[i];
        extensions[translateTerm(e.variable)] = replaceAggregatorVariables(translateExpression(e.expression), aggregators);
    }
    if (context.group.length > 0)
        result.group = context.group.map(variable =>
        {
            let v = translateTerm(variable);
            if (extensions[v])
            {
                let result = extensions[v];
                delete extensions[v]; // make sure there is only 1 'AS' statement
                return {
                    variable,
                    expression: result
                };
            }
            return { expression: variable };
        });

    // descending expressions will already be in the correct format due to the structure of those
    if (context.order.length > 0)
        result.order = context.order.map(translateOperation).map(o => o.descending ? o : ({ expression: o }));

    // this needs to happen after the group because it might depend on variables generated there
    if (result.variables)
    {
        result.variables = result.variables.map((term: RDF.Term) => {
            let v = translateTerm(term);
            if (extensions[v])
                return {
                    variable  : term,
                    expression: extensions[v]
                };
            return term;
        });
        // if the * didn't match any variables this would be empty
        if (result.variables.length === 0)
            result.variables = [new Wildcard()];
    }


    // convert filter to 'having' if it contains an aggregator variable
    // could always convert, but is nicer to use filter when possible
    if (result.where.length > 0 && result.where[result.where.length-1].type === 'filter')
    {
        let filter = result.where[result.where.length-1];
        if (objectContainsValues(filter, Object.keys(aggregators)))
        {
            result.having = flatten([ replaceAggregatorVariables(filter.expression, aggregators) ]);
            result.where.splice(-1);
        }
    }

    context.extend = extend;
    context.group = group;
    context.aggregates = aggregates;
    context.order = order;

    // subqueries need to be in a group
    result = { type: 'group', patterns: [result] };

    return result;
}

function objectContainsValues(o: any, vals: string[]): boolean
{
    if (Util.isTerm(o))
        return vals.indexOf(translateTerm(o)) >= 0;
    if (Array.isArray(o))
        return o.some(e => objectContainsValues(e, vals));
    if (o === Object(o))
        return Object.keys(o).some(key => objectContainsValues(o[key], vals));
    return vals.indexOf(o) >= 0;
}

function translateReduced(op: Algebra.Reduced): any
{
    let result = translateOperation(op.input);
    // project is nested in group object
    result.patterns[0].reduced = true;
    return result
}

function translateService(op: Algebra.Service): any
{
    let patterns = translateOperation(op.input);
    if (patterns.type === 'group')
        patterns = patterns.patterns;
    if (!Array.isArray(patterns))
        patterns = [patterns];
    return {
        type: 'service',
        name: op.name,
        silent: op.silent,
        patterns
    };
}

function translateSlice(op: Algebra.Slice): any
{
    let result = translateOperation(op.input);
    // results can be nested in a group object
    let obj = result;
    if (result.type && result.type === 'group')
        obj = result.patterns[0];
    if (op.start !== 0)
        obj.offset = op.start;
    if (op.length !== undefined)
        obj.limit = op.length;
    return result;
}

function translateUnion(op: Algebra.Union): any
{
    return {
        type: 'union',
        patterns: flatten([
            translateOperation(op.left),
            translateOperation(op.right)
        ])
    }
}

function translateValues(op: Algebra.Values): any
{
    // TODO: check if handled correctly when outside of select block
    return {
        type: 'values',
        values: op.bindings.map(binding =>
        {
            let result: any = {};
            for (let v of op.variables)
            {
                let s = '?' + v.value;
                if (binding[s])
                    result[s] = binding[s];
                else
                    result[s] = undefined;
            }
            return result;
        })
    };
}

// PATH COMPONENTS

function translateAlt(path: Algebra.Alt): any
{
    let left = translatePathComponent(path.left);
    let right = translatePathComponent(path.right);
    if (left.pathType === '!' && right.pathType === '!')
    {
        return {
            type: 'path',
            pathType: '!',
            items: [ {
                type: 'path',
                pathType: '|',
                items: [].concat(left.items, right.items)
            } ]
        }
    }

    return {
        type: 'path',
        pathType: '|',
        items: [ left, right ]
    }
}

function translateInv(path: Algebra.Inv): any
{
    if (path.path.type === types.NPS)
    {
        let npsPath: Algebra.Nps = <Algebra.Nps> path.path;

        let inv = npsPath.iris.map((iri: RDF.NamedNode) =>
        {
            return {
                type: 'path',
                pathType: '^',
                items: [ iri ]
            }
        });

        if (inv.length <= 1)
            return {
                type    : 'path',
                pathType: '!',
                items   : inv
            };

        return {
            type: 'path',
            pathType: '!',
            items: [ {
                type: 'path',
                pathType: '|',
                items: inv
            } ]
        }
    }

    return {
        type: 'path',
        pathType: '^',
        items: [ translatePathComponent(path.path) ]
    }
}

function translateLink(path: Algebra.Link): any
{
    return path.iri;
}

function translateNps(path: Algebra.Nps): any
{
    if (path.iris.length <= 1)
        return {
            type: 'path',
            pathType: '!',
            items: path.iris
        };

    return {
        type: 'path',
        pathType: '!',
        items: [ {
            type: 'path',
            pathType: '|',
            items: path.iris
        } ]
    }
}

function translateOneOrMorePath(path: Algebra.OneOrMorePath): any
{
    return {
        type: 'path',
        pathType: '+',
        items: [ translatePathComponent(path.path) ]
    }
}

function translateSeq(path: Algebra.Seq): any
{
    return {
        type: 'path',
        pathType: '/',
        items: [ translatePathComponent(path.left), translatePathComponent(path.right) ]
    }
}

function translateZeroOrMorePath(path: Algebra.ZeroOrMorePath): any
{
    return {
        type: 'path',
        pathType: '*',
        items: [ translatePathComponent(path.path) ]
    }
}
function translateZeroOrOnePath(path: Algebra.ZeroOrOnePath): any
{
    return {
        type: 'path',
        pathType: '?',
        items: [ translatePathComponent(path.path) ]
    }
}

function removeQuads(op: Algebra.Operation)
{
    return removeQuadsRecursive(op, {});
}

// remove quads
function removeQuadsRecursive(op: any, graphs: {[id: string]: { graph: RDF.Term, values: Algebra.Operation[]}}): any
{
    if (Array.isArray(op))
        return op.map(sub => removeQuadsRecursive(sub, graphs));

    if (!op.type)
        return op;

    if ((op.type === types.PATTERN || op.type === types.PATH) && op.graph)
    {
        if (!graphs[op.graph.value])
            graphs[op.graph.value] = { graph: op.graph, values: []};
        graphs[op.graph.value].values.push(op);
        return op;
    }

    const result: any = {};
    const keyGraphs: {[id: string]: RDF.Term} = {}; // unique graph per key
    const globalNames: {[id: string]: RDF.Term} = {}; // track all the unique graph names for the entire Operation
    for (let key of Object.keys(op))
    {
        const newGraphs: {[id: string]: { graph: RDF.Term, values: Algebra.Operation[]}} = {};
        result[key] = removeQuadsRecursive(op[key], newGraphs);

        const graphNames = Object.keys(newGraphs);

        // create graph statements if multiple graphs are found
        if (graphNames.length > 1)
        {
            // nest joins
            let left: Algebra.Operation = potentialGraphFromPatterns(<Algebra.Pattern[]>newGraphs[graphNames[0]].values);
            for (let i = 1; i < graphNames.length; ++i)
            {
                const right = potentialGraphFromPatterns(<Algebra.Pattern[]>newGraphs[graphNames[i]].values);
                left = factory.createJoin(left, right);
            }
            graphNames.map(name => delete newGraphs[name]);
            // this ignores the result object that is being generated, but should not be a problem
            // is only an issue for objects that have 2 keys where this can occur, which is none
            return left;
        }
        else if (graphNames.length === 1)
        {
            const graph = newGraphs[graphNames[0]].graph;
            keyGraphs[key] = graph;
            globalNames[graph.value] = graph;
        }
    }

    const graphNameSet = Object.keys(globalNames);
    if (graphNameSet.length > 0)
    {
        // also need to create graph statement if we are at the edge of the query
        if (graphNameSet.length === 1 && op.type !== types.PROJECT)
            graphs[graphNameSet[0]] = { graph: globalNames[graphNameSet[0]], values: [result] };
        else
        {
            // multiple graphs (or project), need to create graph objects for them
            for (let key of Object.keys(keyGraphs))
                if (keyGraphs[key].value.length > 0)
                    result[key] = factory.createGraph(result[key], keyGraphs[key]);
        }
    }

    return result;
}

function potentialGraphFromPatterns(patterns: Algebra.Pattern[])
{
    const bgp = factory.createBgp(patterns);
    const name = patterns[0].graph;
    if (name.value.length === 0)
        return bgp;
    return factory.createGraph(bgp, name);
}
