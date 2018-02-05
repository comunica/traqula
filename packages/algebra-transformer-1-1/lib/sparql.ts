
import * as _ from 'lodash';
import * as Algebra from './algebra';
import * as RDF from 'rdf-js'
const SparqlGenerator = require('sparqljs').Generator;
const types = Algebra.types;
const eTypes = Algebra.expressionTypes;

let context : { project: boolean, extend: Algebra.Extend[], group: RDF.Variable[], aggregates: Algebra.BoundAggregate[], order: Algebra.Expression[] };

export function toSparql(op: Algebra.Operation): string
{
    let generator = new SparqlGenerator();
    return generator.stringify(toSparqlJs(op));
}

export function toSparqlJs(op: Algebra.Operation):  any
{
    resetContext();
    return translateOperation(op);
}

function flatten(s: any[]): any
{
    return Array.prototype.concat(...s);
}

function resetContext()
{
    context = { project: false, extend: [], group: [], aggregates: [], order: [] };
}

function translateOperation(op: Algebra.Operation): any
{
    // this allows us to differentiate between BIND and SELECT when translating EXTEND
    if (op.type !== types.EXTEND)
        context.project = false;

    switch(op.type)
    {
        case types.EXPRESSION: return translateExpression(<Algebra.Expression>op);

        case types.BGP:       return translateBgp(<Algebra.Bgp>op);
        case types.CONSTRUCT: return translateConstruct(<Algebra.Construct>op);
        case types.DISTINCT:  return translateDistinct(<Algebra.Distinct>op);
        case types.EXTEND:    return translateExtend(<Algebra.Extend>op);
        case types.FILTER:    return translateFilter(<Algebra.Filter>op);
        case types.GRAPH:     return translateGraph(<Algebra.Graph>op);
        case types.GROUP:     return translateGroup(<Algebra.Group>op);
        case types.JOIN:      return translateJoin(<Algebra.Join>op);
        case types.LEFT_JOIN: return translateLeftJoin(<Algebra.LeftJoin>op);
        case types.MINUS:     return translateMinus(<Algebra.Minus>op);
        case types.ORDER_BY:  return translateOrderBy(<Algebra.OrderBy>op);
        case types.PATTERN:   return translatePattern(<Algebra.Pattern>op);
        case types.PROJECT:   return translateProject(<Algebra.Project>op);
        case types.REDUCED:   return translateReduced(<Algebra.Reduced>op);
        case types.SLICE:     return translateSlice(<Algebra.Slice>op);
        case types.UNION:     return translateUnion(<Algebra.Union>op);
        case types.VALUES:    return translateValues(<Algebra.Values>op);
    }
    return null;
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
    }
    return null;
}

function translateTerm(term: RDF.Term): string
{
    if (term.termType === 'BlankNode')
        return '_:' + term.value;
    if (term.termType === 'Literal')
    {
        // TODO: should check which safety checks are required
        let lit = <RDF.Literal>term;
        let result = `"${term.value}"`;
        if (lit.language)
            result += '@' + lit.language;
        if (lit.datatype)
            result += '^^' + lit.datatype.value;
        return result;
    }
    if (term.termType === 'NamedNode')
        return term.value;
    if (term.termType === 'Variable')
        return '?' + term.value;
    return null;
}

// ------------------------- EXPRESSIONS -------------------------

function translateAggregateExpression(expr: Algebra.AggregateExpression): any
{
    return {
        expression: translateExpression(expr.expression),
        type: 'aggregate',
        aggregation: expr.aggregator,
        distinct: expr.distinct
    }
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
        function: translateTerm(expr.name),
        args: expr.args.map(translateExpression)
    }
}

function translateOperatorExpression(expr: Algebra.OperatorExpression): any
{
    return {
        type: 'operation',
        operator: expr.operator,
        args: expr.args.map(translateExpression)
    }
}

function translateTermExpression(expr: Algebra.TermExpression): string
{
    return translateTerm(expr.term);
}


// ------------------------- OPERATIONS -------------------------
// these get translated in the project function
function translateBoundAggregate(op: Algebra.BoundAggregate): Algebra.BoundAggregate
{
    return op;
}

function translateBgp(op: Algebra.Bgp): any
{
    return {
        type: 'bgp',
        triples: op.patterns.map(translatePattern)
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
    result.distinct = true;
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
            variable: translateTerm(op.variable),
            expression: translateExpression(op.expression)
        }
    ])
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
        name: translateTerm(op.name)
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
    return flatten([
        translateOperation(op.left),
        {
            type: 'minus',
            patterns: translateOperation(op.right)
        }
    ]);
}

function translateOrderBy(op: Algebra.OrderBy): any
{
    // TODO: DESC
    context.order.push(...op.expressions);
    return translateOperation(op.input);
}

function translatePattern(op: Algebra.Pattern): any
{
    // TODO: quads back to graph statement
    return {
        subject: translateTerm(op.subject),
        predicate: translateTerm(op.predicate),
        object: translateTerm(op.object)
    };
}

function replaceAggregatorVariables(s: any, map: any)
{
    if (typeof s === 'string')
    {
        if (map[s])
            return map[s];
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

function translateProject(op: Algebra.Project): any
{
    let result: any = {
        type: 'query',
        prefixes: {},
        queryType: 'SELECT',
        variables: op.variables.map(translateTerm)
    };

    // backup values in case of nested queries
    // everything in extend, group, etc. is irrelevant for this project call
    let extend = context.extend;
    let group = context.group;
    let aggregates = context.aggregates;
    let order = context.order;
    resetContext();

    context.project = true;
    result.where = flatten([ translateOperation(op.input) ]);

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
        result.group = context.group.map(translateTerm).map(v =>
        {
            if (extensions[v])
            {
                let result = extensions[v];
                delete extensions[v]; // make sure there is only 1 'AS' statement
                return {
                    variable  : v,
                    expression: result
                };
            }
            if (typeof v === 'string')
                return { expression: v };
            return v;
        });
    if (context.order.length > 0)
        result.order = context.order.map(translateOperation).map(o =>
        {
            if (typeof o === 'string')
                return { expression: o };
            return o;
        });

    // this needs to happen after the group because it might depend on variables generated there
    result.variables = result.variables.map((v:string) =>
    {
        if (extensions[v])
            return {
                variable: v,
                expression: extensions[v]
            };
        return v;
    });


    // convert filter to 'having' if it contains an aggregator variable
    // could always convert, but is nicer to use filter when possible
    if (result.where[result.where.length-1].type === 'filter')
    {
        let filter = result.where[result.where.length-1];
        if (objectContainsValues(filter, Object.keys(aggregators)))
        {
            result.having = flatten([ replaceAggregatorVariables(filter.expression, aggregators) ]);
            delete result.where[result.where.length-1];
        }
    }

    context.extend = extend;
    context.group = group;
    context.aggregates = aggregates;
    context.order = order;

    return result;
}

function objectContainsValues(o: any, vals: string[]): boolean
{
    if (Array.isArray(o))
        return o.some(e => objectContainsValues(e, vals));
    if (_.isObject(o))
        return Object.keys(o).some(key => objectContainsValues(o[key], vals));
    return vals.indexOf(o) >= 0;
}

function translateReduced(op: Algebra.Reduced): any
{
    let result = translateOperation(op.input);
    result.reduced = true;
    return result;
}

function translateSlice(op: Algebra.Slice): any
{
    let result = translateOperation(op.input);
    if (op.start !== 0)
        result.offset = op.start;
    if (op.length !== undefined)
        result.limit = op.length;
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
    // TODO: check if undef implementation is actually correct
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
                    result[s] = translateTerm(binding[s]);
            }
        })
    };
}