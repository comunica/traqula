
import * as A from "./algebra";
import {Expression, Operation, expressionTypes, types} from "./algebra";
import Factory from "./factory";
import {Variable} from "rdf-js";
import * as RDF from 'rdf-js'


export default class Util
{
    /**
     * Detects all in-scope variables.
     * In practice this means iterating through the entire algebra tree, finding all variables,
     * and stopping when a project function is found.
     * @param {Operation} op - Input algebra tree.
     * @returns {Variable[]} - List of unique in-scope variables.
     */
    public static inScopeVariables(op: A.Operation): Variable[]
    {
        const variables: Variable[] = [];

        function addVariable(v: Variable)
        {
            if (!variables.find(v2 => v.value === v2.value))
                variables.push(v);
        }

        // https://www.w3.org/TR/sparql11-query/#variableScope
        Util.recurseOperation(op, {
            [types.EXPRESSION]: (op) =>
            {
                let expr = <A.Expression>op;
                if (expr.expressionType === 'aggregate' && expr.variable)
                {
                    let agg = <A.BoundAggregate> expr;
                    addVariable(agg.variable);
                }
                return true;
            },
            [types.EXTEND]: (op) =>
            {
                let extend = <A.Extend>op;
                addVariable(extend.variable);
                return true;
            },
            [types.GRAPH]: (op) =>
            {
                let graph = <A.Graph>op;
                if (graph.name.termType === 'Variable')
                    addVariable(<Variable> graph.name);
                return true;
            },
            [types.GROUP]: (op) =>
            {
                let group = <A.Group>op;
                group.variables.forEach(addVariable);
                return true;
            },
            [types.PATH]: (op) =>
            {
                let path = <A.Path>op;
                if (path.subject.termType === 'Variable')
                    addVariable(<Variable> path.subject);
                if (path.object.termType === 'Variable')
                    addVariable(<Variable> path.object);
                if (path.graph.termType === 'Variable')
                    addVariable(<Variable> path.graph);
                return true;
            },
            [types.PATTERN]: (op) =>
            {
                let pattern = <A.Pattern>op;
                if (pattern.subject.termType === 'Variable')
                    addVariable(<Variable> pattern.subject);
                if (pattern.predicate.termType === 'Variable')
                    addVariable(<Variable> pattern.predicate);
                if (pattern.object.termType === 'Variable')
                    addVariable(<Variable> pattern.object);
                if (pattern.graph.termType === 'Variable')
                    addVariable(<Variable> pattern.graph);
                return true;
            },
            [types.PROJECT]: (op) =>
            {
                let project = <A.Project>op;
                project.variables.forEach(addVariable);
                return false;
            },
            [types.SERVICE]: (op) =>
            {
                let service = <A.Service>op;
                if (service.name.termType === 'Variable')
                    addVariable(<Variable> service.name);
                return true;
            },
            [types.VALUES]: (op) =>
            {
                let values = <A.Values>op;
                values.variables.forEach(addVariable);
                return true;
            },
        });

        return variables;
    }
    /**
     * Recurses through the given algebra tree
     * A map of callback functions can be provided for individual Operation types to gather data.
     * The return value of those callbacks should indicate whether recursion should be applied or not.
     * Making modifications will change the original input object.
     * @param {Operation} op - The Operation to recurse on.
     * @param { [type: string]: (op: Operation) => boolean } callbacks - A map of required callback Operations.
     */
    public static recurseOperation(op: A.Operation, callbacks: { [type: string]: (op: A.Operation) => boolean }): void
    {
        let result: A.Operation = op;
        let doRecursion = true;

        if (callbacks[op.type])
            doRecursion = callbacks[op.type](op);

        if (!doRecursion)
            return;

        let recurseOp = (op: A.Operation) => Util.recurseOperation(op, callbacks);

        switch (result.type)
        {
            case types.ALT:
                const alt: A.Alt = <A.Alt> result;
                recurseOp(alt.left);
                recurseOp(alt.right);
                break;
            case types.ASK:
                const ask: A.Ask = <A.Ask> result;
               recurseOp(ask.input);
               break;
            case types.BGP:
                const bgp: A.Bgp = <A.Bgp> result;
                bgp.patterns.forEach(recurseOp);
                break;
            case types.CONSTRUCT:
                const construct: A.Construct = <A.Construct> result;
                recurseOp(construct.input);
                construct.template.map(recurseOp);
                break;
            case types.DESCRIBE:
                const describe: A.Describe = <A.Describe> result;
                recurseOp(describe.input);
                break;
            case types.DISTINCT:
                const distinct: A.Distinct = <A.Distinct> result;
                recurseOp(distinct.input);
                break;
            case types.EXPRESSION:
                const expr: A.Expression = <A.Expression> result;
                if (expr.expressionType === expressionTypes.EXISTENCE)
                {
                    const exist = <A.ExistenceExpression> expr;
                    recurseOp(exist.input);
                }
                break;
            case types.EXTEND:
                const extend: A.Extend = <A.Extend> result;
                recurseOp(extend.input);
                recurseOp(extend.expression);
                break;
            case types.FILTER:
                const filter: A.Filter = <A.Filter> result;
                recurseOp(filter.input);
                recurseOp(filter.expression);
                break;
            case types.FROM:
                const from: A.From = <A.From> result;
                recurseOp(from.input);
                break;
            case types.GRAPH:
                const graph: A.Graph = <A.Graph> result;
                recurseOp(graph.input);
                break;
            case types.GROUP:
                const group: A.Group = <A.Group> result;
                recurseOp(group.input);
                group.aggregates.forEach(recurseOp);
                break;
            case types.INV:
                const inv: A.Inv = <A.Inv> result;
                recurseOp(inv.path);
                break;
            case types.JOIN:
                const join: A.Join = <A.Join> result;
                recurseOp(join.left);
                recurseOp(join.right);
                break;
            case types.LEFT_JOIN:
                const leftJoin: A.LeftJoin = <A.LeftJoin> result;
                recurseOp(leftJoin.left);
                recurseOp(leftJoin.right);
                if (leftJoin.expression) recurseOp(leftJoin.expression);
                break;
            case types.LINK:
                break;
            case types.MINUS:
                const minus: A.Minus = <A.Minus> result;
                recurseOp(minus.left);
                recurseOp(minus.right);
                break;
            case types.NPS:
                break;
            case types.ONE_OR_MORE_PATH:
                const oom: A.OneOrMorePath = <A.OneOrMorePath> result;
                recurseOp(oom.path);
                break;
            case types.ORDER_BY:
                const order: A.OrderBy = <A.OrderBy> result;
                recurseOp(order.input);
                order.expressions.forEach(recurseOp);
                break;
            case types.PATH:
                const path: A.Path = <A.Path> result;
                recurseOp(path.predicate);
                break;
            case types.PATTERN:
                break;
            case types.PROJECT:
                const project: A.Project = <A.Project> result;
                recurseOp(project.input);
                break;
            case types.REDUCED:
                const reduced: A.Reduced = <A.Reduced> result;
                recurseOp(reduced.input);
                break;
            case types.SEQ:
                const seq: A.Seq = <A.Seq> result;
                recurseOp(seq.left);
                recurseOp(seq.right);
                break;
            case types.SERVICE:
                const service: A.Service = <A.Service> result;
                recurseOp(service.input);
                break;
            case types.SLICE:
                const slice: A.Slice = <A.Slice> result;
                recurseOp(slice.input);
                break;
            case types.UNION:
                const union: A.Union = <A.Union> result;
                recurseOp(union.left);
                recurseOp(union.right);
                break;
            case types.VALUES:
                break;
            case types.ZERO_OR_MORE_PATH:
                const zom: A.ZeroOrMorePath = <A.ZeroOrMorePath> result;
                recurseOp(zom.path);
                break;
            case types.ZERO_OR_ONE_PATH:
                const zoo: A.ZeroOrOnePath = <A.ZeroOrOnePath> result;
                recurseOp(zoo.path);
                break;
            default: throw new Error('Unknown Operation type ' + result.type);
        }
    }

    /**
     * Creates a deep copy of the given Operation.
     * Creates shallow copies of the non-Operation values.
     * A map of callback functions can be provided for individual Operation types
     * to specifically modify the given objects before triggering recursion.
     * The return value of those callbacks should indicate whether recursion should be applied to this returned object or not.
     * @param {Operation} op - The Operation to recurse on.
     * @param { [type: string]: (op: Operation, factory: Factory) => RecurseResult } callbacks - A map of required callback Operations.
     * @param {Factory} factory - Factory used to create new Operations. Will use default factory if none is provided.
     * @returns {Operation} - The copied result.
     */
    public static mapOperation(op: A.Operation, callbacks: { [type: string]: (op: A.Operation, factory: Factory) => RecurseResult }, factory?: Factory): A.Operation
    {
        let result: A.Operation = op;
        let doRecursion = true;

        factory = factory || new Factory();

        if (callbacks[op.type])
            ({ result, recurse: doRecursion } = callbacks[op.type](op, factory));

        if (!doRecursion)
            return result;

        let mapOp = (op: A.Operation) => Util.mapOperation(op, callbacks, factory);

        switch (result.type)
        {
            case types.ALT:
                const alt: A.Alt = <A.Alt> result;
                return factory.createAlt(mapOp(alt.left), mapOp(alt.right));
            case types.ASK:
                const ask: A.Ask = <A.Ask> result;
                return factory.createAsk(mapOp(ask.input));
            case types.BGP:
                const bgp: A.Bgp = <A.Bgp> result;
                return factory.createBgp(<A.Pattern[]> bgp.patterns.map(mapOp));
            case types.CONSTRUCT:
                const construct: A.Construct = <A.Construct> result;
                return factory.createConstruct(mapOp(construct.input), <A.Pattern[]> construct.template.map(mapOp));
            case types.DESCRIBE:
                const describe: A.Describe = <A.Describe> result;
                return factory.createDescribe(mapOp(describe.input), describe.terms);
            case types.DISTINCT:
                const distinct: A.Distinct = <A.Distinct> result;
                return factory.createDistinct(mapOp(distinct.input));
            case types.EXPRESSION:
                const expr: A.Expression = <A.Expression> result;
                return Util.mapExpression(expr, callbacks, factory);
            case types.EXTEND:
                const extend: A.Extend = <A.Extend> result;
                return factory.createExtend(mapOp(extend.input), extend.variable, <A.Expression> mapOp(extend.expression));
            case types.FILTER:
                const filter: A.Filter = <A.Filter> result;
                return factory.createFilter(mapOp(filter.input), <A.Expression> mapOp(filter.expression));
            case types.FROM:
                const from: A.From = <A.From> result;
                return factory.createFrom(mapOp(from.input), [].concat(from.default), [].concat(from.named));
            case types.GRAPH:
                const graph: A.Graph = <A.Graph> result;
                return factory.createGraph(mapOp(graph.input), graph.name);
            case types.GROUP:
                const group: A.Group = <A.Group> result;
                return factory.createGroup(
                    mapOp(group.input),
                    [].concat(group.variables),
                    <A.BoundAggregate[]> group.aggregates.map(mapOp));
            case types.INV:
                const inv: A.Inv = <A.Inv> result;
                return factory.createInv(mapOp(inv.path));
            case types.JOIN:
                const join: A.Join = <A.Join> result;
                return factory.createJoin(mapOp(join.left), mapOp(join.right));
            case types.LEFT_JOIN:
                const leftJoin: A.LeftJoin = <A.LeftJoin> result;
                return factory.createLeftJoin(
                    mapOp(leftJoin.left),
                    mapOp(leftJoin.right),
                    leftJoin.expression ? <A.Expression> mapOp(leftJoin.expression) : undefined);
            case types.LINK:
                const link: A.Link = <A.Link> result;
                return factory.createLink(link.iri);
            case types.MINUS:
                const minus: A.Minus = <A.Minus> result;
                return factory.createMinus(mapOp(minus.left), mapOp(minus.right));
            case types.NPS:
                const nps: A.Nps = <A.Nps> result;
                return factory.createNps([].concat(nps.iris));
            case types.ONE_OR_MORE_PATH:
                const oom: A.OneOrMorePath = <A.OneOrMorePath> result;
                return factory.createOneOrMorePath(mapOp(oom.path));
            case types.ORDER_BY:
                const order: A.OrderBy = <A.OrderBy> result;
                return factory.createOrderBy(mapOp(order.input), <A.Expression[]> order.expressions.map(mapOp));
            case types.PATH:
                const path: A.Path = <A.Path> result;
                return factory.createPath(path.subject, mapOp(path.predicate), path.object, path.graph);
            case types.PATTERN:
                const pattern: A.Pattern = <A.Pattern> result;
                return factory.createPattern(pattern.subject, pattern.predicate, pattern.object, pattern.graph);
            case types.PROJECT:
                const project: A.Project = <A.Project> result;
                return factory.createProject(mapOp(project.input), [].concat(project.variables));
            case types.REDUCED:
                const reduced: A.Reduced = <A.Reduced> result;
                return factory.createReduced(mapOp(reduced.input));
            case types.SEQ:
                const seq: A.Seq = <A.Seq> result;
                return factory.createSeq(mapOp(seq.left), mapOp(seq.right));
            case types.SERVICE:
                const service: A.Service = <A.Service> result;
                return factory.createService(mapOp(service.input), service.name, service.silent);
            case types.SLICE:
                const slice: A.Slice = <A.Slice> result;
                return factory.createSlice(mapOp(slice.input), slice.start, slice.length);
            case types.UNION:
                const union: A.Union = <A.Union> result;
                return factory.createUnion(mapOp(union.left), mapOp(union.right));
            case types.VALUES:
                const values: A.Values = <A.Values> result;
                return factory.createValues([].concat(values.variables), values.bindings.map(b => Object.assign({}, b)));
            case types.ZERO_OR_MORE_PATH:
                const zom: A.ZeroOrMorePath = <A.ZeroOrMorePath> result;
                return factory.createZeroOrMorePath(mapOp(zom.path));
            case types.ZERO_OR_ONE_PATH:
                const zoo: A.ZeroOrOnePath = <A.ZeroOrOnePath> result;
                return factory.createZeroOrOnePath(mapOp(zoo.path));
            default: throw new Error('Unknown Operation type ' + result.type);
        }
    }

    /**
     * Similar to the {@link mapOperation} function but specifically for expressions.
     * Both functions call each other while copying.
     * Should not be called directly since it does not execute the callbacks, these happen in {@link mapOperation}.
     * @param {Expression} expr - The Operation to recurse on.
     * @param { [type: string]: (op: Operation, factory: Factory) => RecurseResult } callbacks - A map of required callback Operations.
     * @param {Factory} factory - Factory used to create new Operations. Will use default factory if none is provided.
     * @returns {Operation} - The copied result.
     */
    private static mapExpression(expr: A.Expression, callbacks: { [type: string]: (op: A.Operation, factory: Factory) => RecurseResult }, factory: Factory): A.Expression
    {
        let recurse = (op: A.Operation) => Util.mapOperation(op, callbacks, factory);

        switch(expr.expressionType)
        {
            case expressionTypes.AGGREGATE:
                if (expr.variable)
                {
                    const bound = <A.BoundAggregate> expr;
                    return factory.createBoundAggregate(bound.variable, bound.aggregator, <Expression> recurse(bound.expression), bound.distinct, bound.separator);
                }
                const aggregate = <A.AggregateExpression> expr;
                return factory.createAggregateExpression(aggregate.aggregator, <Expression> recurse(aggregate.expression), aggregate.distinct, aggregate.separator);
            case expressionTypes.EXISTENCE:
                const exist = <A.ExistenceExpression> expr;
                return factory.createExistenceExpression(exist.not, recurse(exist.input));
            case expressionTypes.NAMED:
                const named = <A.NamedExpression> expr;
                return factory.createNamedExpression(named.name, <A.Expression[]> named.args.map(recurse));
            case expressionTypes.OPERATOR:
                const op = <A.OperatorExpression> expr;
                return factory.createOperatorExpression(op.operator, <A.Expression[]> op.args.map(recurse));
            case expressionTypes.TERM:
                const term = <A.TermExpression> expr;
                return factory.createTermExpression(term.term);
            case expressionTypes.WILDCARD:
                return factory.createWildcardExpression();
            default: throw new Error('Unknown Expression type ' + expr.expressionType);
        }
    }

    public static createUniqueVariable(label: string, variables: {[vLabel: string]: boolean}, dataFactory: RDF.DataFactory): RDF.Variable {
        let counter: number = 0;
        let labelLoop = label;
        while (variables[labelLoop]) {
            labelLoop = label + counter++;
        }
        return dataFactory.variable(labelLoop);
    }

    // separate terms from wildcard since we handle them differently
    public static isTerm(term: any): boolean {
        return term.termType !== undefined && term.termType !== 'Wildcard';
    }

    public static isWildcard(term: any): boolean {
        return term.termType === 'Wildcard';
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
