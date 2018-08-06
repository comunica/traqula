
import * as A from './algebra';
import * as RDF from "rdf-js";
import * as DataFactory from '@rdfjs/data-model';
import {stringToTerm} from "rdf-string";
import {types, expressionTypes, Expression} from "./algebra";

const defaultGraph: RDF.DefaultGraph = <RDF.DefaultGraph>{ termType: 'DefaultGraph', value: ''};

export default class Factory
{
    dataFactory: RDF.DataFactory;
    stringType: RDF.NamedNode;

    constructor(dataFactory?: RDF.DataFactory) {
        this.dataFactory = dataFactory || DataFactory;
        this.stringType = <RDF.NamedNode>this.createTerm('http://www.w3.org/2001/XMLSchema#string');
    }

    createAlt (left: A.PropertyPathSymbol, right: A.PropertyPathSymbol): A.Alt { return { type: 'alt', left, right }; }
    createAsk (input: A.Operation): A.Ask { return { type: 'ask', input }; }
    createBoundAggregate (variable: RDF.Variable, aggregate: string, expression: A.Expression, distinct: boolean, separator?: string): A.BoundAggregate
    {
        let result = <A.BoundAggregate>this.createAggregateExpression(aggregate, expression, distinct, separator);
        result.variable = variable;
        return result;
    }
    createBgp (patterns: A.Pattern[]): A.Bgp { return { type: 'bgp', patterns }; }
    createConstruct (input: A.Operation, template: A.Pattern[]): A.Construct { return { type: 'construct', input, template }; }
    createDescribe (input: A.Operation, terms: RDF.Term[]): A.Describe { return { type: 'describe', input, terms }; }
    createDistinct (input: A.Operation) : A.Distinct { return { type: 'distinct', input }; }
    createExtend (input: A.Operation, variable: RDF.Variable, expression: A.Expression) : A.Extend { return { type: 'extend', input, variable, expression }; }
    createFrom (input: A.Operation, def: RDF.Term[], named: RDF.Term[]) : A.From { return { type: 'from', input, default: def, named }; }
    createFilter (input: A.Operation, expression: A.Expression) : A.Filter { return { type: 'filter', input, expression }; }
    createGraph (input: A.Operation, name: RDF.Term) : A.Graph { return { type: 'graph', input, name }; }
    createGroup (input: A.Operation, variables: RDF.Variable[], aggregates: A.BoundAggregate[]) : A.Group { return { type: 'group', input, variables, aggregates }; }
    createInv (path: A.PropertyPathSymbol): A.Inv { return { type: 'inv', path }; }
    createJoin (left: A.Operation, right: A.Operation): A.Join { return { type: 'join', left, right }; }
    createLeftJoin (left: A.Operation, right: A.Operation, expression?: A.Expression): A.LeftJoin
    {
        if (expression)
            return { type: 'leftjoin', left, right, expression };
        return { type: 'leftjoin', left, right };
    }
    createLink (iri: RDF.NamedNode): A.Link { return { type: 'link', iri }; }
    createMinus (left: A.Operation, right: A.Operation): A.Minus { return { type: 'minus', left, right }; }
    createNps (iris: RDF.NamedNode[]): A.Nps { return { type: 'nps', iris }; }
    createOneOrMorePath (path: A.PropertyPathSymbol): A.OneOrMorePath { return { type: 'OneOrMorePath', path }; }
    createOrderBy (input: A.Operation, expressions: A.Expression[]) : A.OrderBy { return { type: 'orderby', input, expressions }; }
    createPath (subject: RDF.Term, predicate: A.PropertyPathSymbol, object: RDF.Term, graph?: RDF.Term) : A.Path
    {
        if (graph)
            return { type: 'path', subject, predicate, object, graph };
        return { type: 'path', subject, predicate, object, graph: defaultGraph };
    }
    createPattern (subject: RDF.Term, predicate: RDF.Term, object: RDF.Term, graph?: RDF.Term): A.Pattern
    {
        let pattern: A.Pattern;
        if (graph)
            pattern = <A.Pattern>this.dataFactory.quad(subject, predicate, object, graph);
        else
            pattern = <A.Pattern>this.dataFactory.triple(subject, predicate, object);
        pattern.type = 'pattern';
        return pattern;
    }
    createProject (input: A.Operation, variables: RDF.Variable[]) : A.Project { return { type: 'project', input, variables }; }
    createReduced (input: A.Operation) : A.Reduced { return { type: 'reduced', input }; }
    createSeq (left: A.PropertyPathSymbol, right: A.PropertyPathSymbol): A.Seq { return { type: 'seq', left, right }; }
    createService (input: A.Operation, name: RDF.Term, silent?: boolean): A.Service { return { type: 'service', input, name, silent }; }
    createSlice (input: A.Operation, start: number, length?: number) : A.Slice
    {
        if (start === undefined)
            start = 0;
        if (length !== undefined)
            return { type: 'slice', input, start, length };
        return { type: 'slice', input, start };
    }
    createUnion (left: A.Operation, right: A.Operation): A.Union { return { type: 'union', left, right }; }
    createValues (variables: RDF.Variable[], bindings: {[key: string]: RDF.Term}[]): A.Values { return { type: 'values', variables, bindings }; }
    createZeroOrMorePath (path: A.PropertyPathSymbol): A.ZeroOrMorePath { return { type: 'ZeroOrMorePath', path }; }
    createZeroOrOnePath (path: A.PropertyPathSymbol): A.ZeroOrOnePath { return { type: 'ZeroOrOnePath', path }; }

    createAggregateExpression (aggregator: string, expression: A.Expression, distinct: boolean, separator?: string): A.AggregateExpression
    {
        if (separator)
            return { type: 'expression', expressionType: 'aggregate', aggregator, expression, separator, distinct};
        return { type: 'expression', expressionType: 'aggregate', aggregator, expression, distinct };
    }
    createExistenceExpression (not: boolean, input: A.Operation): A.ExistenceExpression { return { type: 'expression', expressionType: 'existence', not, input }; }
    createNamedExpression (name: RDF.NamedNode, args: A.Expression[]): A.NamedExpression { return { type: 'expression', expressionType: 'named', name, args }; }
    createOperatorExpression (operator: string, args: A.Expression[]): A.OperatorExpression { return { type: 'expression', expressionType: 'operator', operator, args }; }
    createTermExpression (term: RDF.Term): A.TermExpression { return { type: 'expression', expressionType: 'term', term }; }

    createTerm (str: string): RDF.Term
    {
        return stringToTerm(str, this.dataFactory);
    }

    /**
     * Creates a deep copy of the given Operation.
     * Creates shallow copies of the non-Operation values.
     * A map of callback functions can be provided for individual Operation types
     * to specifically modify the given objects before triggering recursion.
     * The return value of those callbacks should indicate whether recursion should be applied to this returned object or not.
     * @param {Operation} op - The Operation to recurse on.
     * @param { [type: string]: (op: Operation) => RecurseResult } callbacks - A map of required callback Operations.
     * @returns {Operation} - The copied result.
     */
    mapOperation(op: A.Operation, callbacks: { [type: string]: (op: A.Operation) => RecurseResult }): A.Operation
    {
        let result: A.Operation = op;
        let doRecursion = true;

        if (callbacks[op.type])
            ({ result, recurse: doRecursion } = callbacks[op.type](op));

        if (!doRecursion)
            return result;

        let mapOp = (op: A.Operation) => this.mapOperation(op, callbacks);

        switch (result.type)
        {
            case types.ALT:
                const alt: A.Alt = <A.Alt> result;
                return this.createAlt(mapOp(alt.left), mapOp(alt.right));
            case types.ASK:
                const ask: A.Ask = <A.Ask> result;
                return this.createAsk(mapOp(ask.input));
            case types.BGP:
                const bgp: A.Bgp = <A.Bgp> result;
                return this.createBgp(<A.Pattern[]> bgp.patterns.map(mapOp));
            case types.CONSTRUCT:
                const construct: A.Construct = <A.Construct> result;
                return this.createConstruct(mapOp(construct.input), <A.Pattern[]> construct.template.map(mapOp));
            case types.DESCRIBE:
                const describe: A.Describe = <A.Describe> result;
                return this.createDescribe(mapOp(describe.input), describe.terms);
            case types.DISTINCT:
                const distinct: A.Distinct = <A.Distinct> result;
                return this.createDistinct(mapOp(distinct.input));
            case types.EXPRESSION:
                const expr: A.Expression = <A.Expression> result;
                return this.mapExpression(expr, callbacks);
            case types.EXTEND:
                const extend: A.Extend = <A.Extend> result;
                return this.createExtend(mapOp(extend.input), extend.variable, <A.Expression> mapOp(extend.expression));
            case types.FILTER:
                const filter: A.Filter = <A.Filter> result;
                return this.createFilter(mapOp(filter.input), <A.Expression> mapOp(filter.expression));
            case types.FROM:
                const from: A.From = <A.From> result;
                return this.createFrom(mapOp(from.input), [].concat(from.default), [].concat(from.named));
            case types.GRAPH:
                const graph: A.Graph = <A.Graph> result;
                return this.createGraph(mapOp(graph.input), graph.name);
            case types.GROUP:
                const group: A.Group = <A.Group> result;
                return this.createGroup(
                    mapOp(group.input),
                    [].concat(group.variables),
                    <A.BoundAggregate[]> group.aggregates.map(mapOp));
            case types.INV:
                const inv: A.Inv = <A.Inv> result;
                return this.createInv(mapOp(inv.path));
            case types.JOIN:
                const join: A.Join = <A.Join> result;
                return this.createJoin(mapOp(join.left), mapOp(join.right));
            case types.LEFT_JOIN:
                const leftJoin: A.LeftJoin = <A.LeftJoin> result;
                return this.createLeftJoin(
                    mapOp(leftJoin.left),
                    mapOp(leftJoin.right),
                    leftJoin.expression ? <A.Expression> mapOp(leftJoin.expression) : undefined);
            case types.LINK:
                const link: A.Link = <A.Link> result;
                return this.createLink(link.iri);
            case types.MINUS:
                const minus: A.Minus = <A.Minus> result;
                return this.createMinus(mapOp(minus.left), mapOp(minus.right));
            case types.NPS:
                const nps: A.Nps = <A.Nps> result;
                return this.createNps([].concat(nps.iris));
            case types.ONE_OR_MORE_PATH:
                const oom: A.OneOrMorePath = <A.OneOrMorePath> result;
                return this.createOneOrMorePath(mapOp(oom.path));
            case types.ORDER_BY:
                const order: A.OrderBy = <A.OrderBy> result;
                return this.createOrderBy(mapOp(order.input), <A.Expression[]> order.expressions.map(mapOp));
            case types.PATH:
                const path: A.Path = <A.Path> result;
                return this.createPath(path.subject, mapOp(path.predicate), path.object, path.graph);
            case types.PATTERN:
                const pattern: A.Pattern = <A.Pattern> result;
                return this.createPattern(pattern.subject, pattern.predicate, pattern.object, pattern.graph);
            case types.PROJECT:
                const project: A.Project = <A.Project> result;
                return this.createProject(mapOp(project.input), [].concat(project.variables));
            case types.REDUCED:
                const reduced: A.Reduced = <A.Reduced> result;
                return this.createReduced(mapOp(reduced.input));
            case types.SEQ:
                const seq: A.Seq = <A.Seq> result;
                return this.createSeq(mapOp(seq.left), mapOp(seq.right));
            case types.SERVICE:
                const service: A.Service = <A.Service> result;
                return this.createService(mapOp(service.input), service.name, service.silent);
            case types.SLICE:
                const slice: A.Slice = <A.Slice> result;
                return this.createSlice(mapOp(slice.input), slice.start, slice.length);
            case types.UNION:
                const union: A.Union = <A.Union> result;
                return this.createUnion(mapOp(union.left), mapOp(union.right));
            case types.VALUES:
                const values: A.Values = <A.Values> result;
                return this.createValues([].concat(values.variables), values.bindings.map(b => Object.assign({}, b)));
            case types.ZERO_OR_MORE_PATH:
                const zom: A.ZeroOrMorePath = <A.ZeroOrMorePath> result;
                return this.createZeroOrMorePath(mapOp(zom.path));
            case types.ZERO_OR_ONE_PATH:
                const zoo: A.ZeroOrOnePath = <A.ZeroOrOnePath> result;
                return this.createZeroOrOnePath(mapOp(zoo.path));
            default: throw new Error('Unknown Operation type ' + result.type);
        }
    }

    /**
     * Similar to the {@link mapOperation} function but specifically for expressions.
     * Both functions call each other while copying.
     * Should not be called directly since it does not execute the callbacks, these happen in {@link mapOperation}.
     * @param {Expression} expr - The Operation to recurse on.
     * @param { [type: string]: (op: Operation) => RecurseResult } callbacks - A map of required callback Operations.
     * @returns {Operation} - The copied result.
     */
    private mapExpression(expr: A.Expression, callbacks: { [type: string]: (op: A.Operation) => RecurseResult }): A.Expression
    {
        let recurse = (op: A.Operation) => this.mapOperation(op, callbacks);

        switch(expr.expressionType)
        {
            case expressionTypes.AGGREGATE:
                if (expr.variable)
                {
                    const bound = <A.BoundAggregate> expr;
                    return this.createBoundAggregate(bound.variable, bound.aggregator, <Expression> recurse(bound.expression), bound.distinct, bound.separator);
                }
                const aggregate = <A.AggregateExpression> expr;
                return this.createAggregateExpression(aggregate.aggregator, <Expression> recurse(aggregate.expression), aggregate.distinct, aggregate.separator);
            case expressionTypes.EXISTENCE:
                const exist = <A.ExistenceExpression> expr;
                return this.createExistenceExpression(exist.not, recurse(exist.input));
            case expressionTypes.NAMED:
                const named = <A.NamedExpression> expr;
                return this.createNamedExpression(named.name, <A.Expression[]> named.args.map(recurse));
            case expressionTypes.OPERATOR:
                const op = <A.OperatorExpression> expr;
                return this.createOperatorExpression(op.operator, <A.Expression[]> op.args.map(recurse));
            case expressionTypes.TERM:
                const term = <A.TermExpression> expr;
                return this.createTermExpression(term.term);
            default: throw new Error('Unknown Expression type ' + expr.expressionType);
        }
    }
}

/**
 * @interface RecurseResult
 * @property {Operation} result - The resulting A.Operation.
 * @property {boolean} recurse - Whether to continue with recursion.
 */
export interface RecurseResult
{
    result: A.Operation;
    recurse: boolean;
}