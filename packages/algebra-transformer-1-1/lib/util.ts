
import { open } from 'fs';
import { Wildcard } from 'sparqljs';
import * as A from "./algebra";
import { Expression, Operation, expressionTypes, types, TypedOperation } from './algebra';
import Factory from "./factory";
import { BaseQuad, Variable } from "@rdfjs/types";
import * as RDF from '@rdfjs/types'
import * as rdfjs from '@rdfjs/types';
import Dict = NodeJS.Dict;


export default class Util
{
    /**
     * Flattens an array of arrays to an array.
     * @param arr - Array of arrays
     */
    public static flatten<T>(arr: T[][]): T[]
    {
        return Array.prototype.concat(...arr).filter(x => x);
    }

    /**
     * Outputs a JSON object corresponding to the input algebra-like.
     */
    public static objectify (algebra: any): any
    {
        if (algebra.termType)
        {
            if (algebra.termType === 'Quad') {
                return {
                    type: 'pattern',
                    termType: 'Quad',
                    subject: Util.objectify(algebra.subject),
                    predicate: Util.objectify(algebra.predicate),
                    object: Util.objectify(algebra.object),
                    graph: Util.objectify(algebra.graph),
                }
            } else {
                let result: any = {termType: algebra.termType, value: algebra.value};
                if (algebra.language)
                    result.language = algebra.language;
                if (algebra.datatype)
                    result.datatype = Util.objectify(algebra.datatype);
                return result;
            }
        }
        if (Array.isArray(algebra))
            return algebra.map(e => Util.objectify(e));
        if (algebra === Object(algebra))
        {
            let result: any = {};
            for (let key of Object.keys(algebra))
                result[key] = Util.objectify(algebra[key]);
            return result;
        }
        return algebra;
    }

    /**
     * Detects all in-scope variables.
     * In practice this means iterating through the entire algebra tree, finding all variables,
     * and stopping when a project function is found.
     * @param {Operation} op - Input algebra tree.
     * @returns {Variable[]} - List of unique in-scope variables.
     */
    public static inScopeVariables(op: A.Operation): (Variable | Wildcard)[]
    {
        const variables: (Variable | Wildcard)[] = [];

        function addVariable(v: Variable | Wildcard)
        {
            if (!variables.find(v2 => v.value === v2.value))
                variables.push(v);
        }

        function recurseTerm(quad: BaseQuad) {
            if (quad.subject.termType === 'Variable')
                addVariable(<Variable> quad.subject);
            if (quad.predicate.termType === 'Variable')
                addVariable(<Variable> quad.predicate);
            if (quad.object.termType === 'Variable')
                addVariable(<Variable> quad.object);
            if (quad.graph.termType === 'Variable')
                addVariable(<Variable> quad.graph);
            if (quad.subject.termType === 'Quad')
                recurseTerm(quad.subject);
            if (quad.predicate.termType === 'Quad')
                recurseTerm(quad.predicate);
            if (quad.object.termType === 'Quad')
                recurseTerm(quad.object);
            if (quad.graph.termType === 'Quad')
                recurseTerm(quad.graph);
        }

        // https://www.w3.org/TR/sparql11-query/#variableScope
        Util.recurseOperation(op, {
            [types.EXPRESSION]: (op) =>
            {
                if (op.expressionType === expressionTypes.AGGREGATE && op.variable)
                {
                    addVariable(op.variable);
                }
                return true;
            },
            [types.EXTEND]: (op) =>
            {
                addVariable(op.variable);
                return true;
            },
            [types.GRAPH]: (op) =>
            {
                if (op.name.termType === 'Variable')
                    addVariable(<Variable> op.name);
                return true;
            },
            [types.GROUP]: (op) =>
            {
                op.variables.forEach(addVariable);
                return true;
            },
            [types.PATH]: (op) =>
            {
                if (op.subject.termType === 'Variable')
                    addVariable(<Variable> op.subject);
                if (op.object.termType === 'Variable')
                    addVariable(<Variable> op.object);
                if (op.graph.termType === 'Variable')
                    addVariable(<Variable> op.graph);
                if (op.subject.termType === 'Quad')
                    recurseTerm(op.subject);
                if (op.object.termType === 'Quad')
                    recurseTerm(op.object);
                if (op.graph.termType === 'Quad')
                    recurseTerm(op.graph);
                return true;
            },
            [types.PATTERN]: (op) =>
            {
                recurseTerm(op);
                return true;
            },
            [types.PROJECT]: (op) =>
            {
                op.variables.forEach(addVariable);
                return false;
            },
            [types.SERVICE]: (op) =>
            {
                if (op.name.termType === 'Variable')
                    addVariable(<Variable> op.name);
                return true;
            },
            [types.VALUES]: (op) =>
            {
                op.variables.forEach(addVariable);
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
    public static recurseOperation(op: A.Operation, callbacks:{ [T in A.types]?: (op: TypedOperation<T>,) => boolean }): void
    {
        let result: A.Operation = op;
        let doRecursion = true;

        const callback = callbacks[op.type];
        if (callback)
            // Not sure how to get typing correct for op here
            doRecursion = callback(op as any);

        if (!doRecursion)
            return;

        let recurseOp = (op: A.Operation) => Util.recurseOperation(op, callbacks);

        switch (result.type)
        {
            case types.ALT:
                result.input.map(recurseOp);
                break;
            case types.ASK:
               recurseOp(result.input);
               break;
            case types.BGP:
                result.patterns.forEach(recurseOp);
                break;
            case types.CONSTRUCT:
                recurseOp(result.input);
                result.template.map(recurseOp);
                break;
            case types.DESCRIBE:
                recurseOp(result.input);
                break;
            case types.DISTINCT:
                recurseOp(result.input);
                break;
            case types.EXPRESSION:
                if (result.expressionType === expressionTypes.EXISTENCE)
                {
                    recurseOp(result.input);
                }
                break;
            case types.EXTEND:
                recurseOp(result.input);
                recurseOp(result.expression);
                break;
            case types.FILTER:
                recurseOp(result.input);
                recurseOp(result.expression);
                break;
            case types.FROM:
                recurseOp(result.input);
                break;
            case types.GRAPH:
                recurseOp(result.input);
                break;
            case types.GROUP:
                recurseOp(result.input);
                result.aggregates.forEach(recurseOp);
                break;
            case types.INV:
                recurseOp(result.path);
                break;
            case types.JOIN:
                result.input.map(recurseOp);
                break;
            case types.LEFT_JOIN:
                result.input.map(recurseOp);
                if (result.expression) recurseOp(result.expression);
                break;
            case types.LINK:
                break;
            case types.MINUS:
                result.input.map(recurseOp);
                break;
            case types.NOP:
                break;
            case types.NPS:
                break;
            case types.ONE_OR_MORE_PATH:
                recurseOp(result.path);
                break;
            case types.ORDER_BY:
                recurseOp(result.input);
                result.expressions.forEach(recurseOp);
                break;
            case types.PATH:
                recurseOp(result.predicate);
                break;
            case types.PATTERN:
                break;
            case types.PROJECT:
                recurseOp(result.input);
                break;
            case types.REDUCED:
                recurseOp(result.input);
                break;
            case types.SEQ:
                result.input.map(recurseOp);
                break;
            case types.SERVICE:
                recurseOp(result.input);
                break;
            case types.SLICE:
                recurseOp(result.input);
                break;
            case types.UNION:
                result.input.map(recurseOp);
                break;
            case types.VALUES:
                break;
            case types.ZERO_OR_MORE_PATH:
                recurseOp(result.path);
                break;
            case types.ZERO_OR_ONE_PATH:
                recurseOp(result.path);
                break;
            // UPDATE operations
            case types.COMPOSITE_UPDATE:
                result.updates.forEach(update => recurseOp(update));
                break;
            case types.DELETE_INSERT:
                if (result.delete)
                    result.delete.forEach(pattern => recurseOp(pattern));
                if (result.insert)
                    result.insert.forEach(pattern => recurseOp(pattern));
                if (result.where)
                    recurseOp(result.where);
                break;
            // all of these only have graph IDs as values
            case types.LOAD: break;
            case types.CLEAR: break;
            case types.CREATE: break;
            case types.DROP: break;
            case types.ADD: break;
            case types.MOVE: break;
            case types.COPY: break;
            default: throw new Error(`Unknown Operation type ${(result as any).type}`);
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
    public static mapOperation(op: A.Operation,
      callbacks:{ [T in A.types]?: (op: TypedOperation<T>, factory: Factory) => RecurseResult },
      factory?: Factory): A.Operation
    {
        let result: A.Operation = op;
        let doRecursion = true;

        factory = factory || new Factory();

        const callback = callbacks[op.type];
        if (callback)
            // Not sure how to get typing correct for op here
            ({ result, recurse: doRecursion } = callback(op as any, factory));

        if (!doRecursion)
            return result;

        let mapOp = (op: A.Operation) => Util.mapOperation(op, callbacks, factory);

        // Several casts here might be wrong though depending on the callbacks output
        switch (result.type)
        {
            case types.ALT:
                return factory.createAlt(<A.PropertyPathSymbol[]> result.input.map(mapOp));
            case types.ASK:
                return factory.createAsk(mapOp(result.input));
            case types.BGP:
                return factory.createBgp(<A.Pattern[]> result.patterns.map(mapOp));
            case types.CONSTRUCT:
                return factory.createConstruct(mapOp(result.input), <A.Pattern[]> result.template.map(mapOp));
            case types.DESCRIBE:
                return factory.createDescribe(mapOp(result.input), result.terms);
            case types.DISTINCT:
                return factory.createDistinct(mapOp(result.input));
            case types.EXPRESSION:
                return Util.mapExpression(result, callbacks, factory);
            case types.EXTEND:
                return factory.createExtend(mapOp(result.input), result.variable, <A.Expression> mapOp(result.expression));
            case types.FILTER:
                return factory.createFilter(mapOp(result.input), <A.Expression> mapOp(result.expression));
            case types.FROM:
                return factory.createFrom(mapOp(result.input), [ ...result.default ], [ ...result.named ]);
            case types.GRAPH:
                return factory.createGraph(mapOp(result.input), result.name);
            case types.GROUP:
                return factory.createGroup(
                    mapOp(result.input),
                    (<RDF.Variable[]>[]).concat(result.variables),
                    <A.BoundAggregate[]> result.aggregates.map(mapOp));
            case types.INV:
                return factory.createInv(<A.PropertyPathSymbol> mapOp(result.path));
            case types.JOIN:
                return factory.createJoin(result.input.map(mapOp));
            case types.LEFT_JOIN:
                return factory.createLeftJoin(
                    mapOp(result.input[0]),
                    mapOp(result.input[1]),
                  result.expression ? <A.Expression> mapOp(result.expression) : undefined);
            case types.LINK:
                return factory.createLink(result.iri);
            case types.MINUS:
                return factory.createMinus(mapOp(result.input[0]), mapOp(result.input[1]));
            case types.NOP:
                return factory.createNop();
            case types.NPS:
                return factory.createNps((<RDF.NamedNode[]>[]).concat(result.iris));
            case types.ONE_OR_MORE_PATH:
                return factory.createOneOrMorePath(<A.PropertyPathSymbol> mapOp(result.path));
            case types.ORDER_BY:
                return factory.createOrderBy(mapOp(result.input), <A.Expression[]> result.expressions.map(mapOp));
            case types.PATH:
                return factory.createPath(result.subject, <A.PropertyPathSymbol> mapOp(result.predicate), result.object, result.graph);
            case types.PATTERN:
                return factory.createPattern(result.subject, result.predicate, result.object, result.graph);
            case types.PROJECT:
                return factory.createProject(mapOp(result.input), [ ...result.variables ]);
            case types.REDUCED:
                return factory.createReduced(mapOp(result.input));
            case types.SEQ:
                return factory.createSeq(<A.PropertyPathSymbol[]> result.input.map(mapOp));
            case types.SERVICE:
                return factory.createService(mapOp(result.input), result.name, result.silent);
            case types.SLICE:
                return factory.createSlice(mapOp(result.input), result.start, result.length);
            case types.UNION:
                return factory.createUnion(result.input.map(mapOp));
            case types.VALUES:
                return factory.createValues((<RDF.Variable[]>[]).concat(result.variables), result.bindings.map(b => Object.assign({}, b)));
            case types.ZERO_OR_MORE_PATH:
                return factory.createZeroOrMorePath(<A.PropertyPathSymbol> mapOp(result.path));
            case types.ZERO_OR_ONE_PATH:
                return factory.createZeroOrOnePath(<A.PropertyPathSymbol> mapOp(result.path));
          // UPDATE operations
            case types.COMPOSITE_UPDATE:
                return factory.createCompositeUpdate(<A.Update[]> result.updates.map(mapOp));
            case types.DELETE_INSERT:
                return factory.createDeleteInsert(
                  result.delete ? <A.Pattern[]> result.delete.map(mapOp) : undefined,
                  result.insert ? <A.Pattern[]> result.insert.map(mapOp) : undefined,
                  result.where ? mapOp(result.where) : undefined,
                  );
            case types.LOAD:
                return factory.createLoad(result.source, result.destination, result.silent);
            case types.CLEAR:
                return factory.createClear(result.source, result.silent);
            case types.CREATE:
                return factory.createCreate(result.source, result.silent);
            case types.DROP:
                return factory.createDrop(result.source, result.silent);
            case types.ADD:
                return factory.createAdd(result.source, result.destination);
            case types.MOVE:
                return factory.createMove(result.source, result.destination);
            case types.COPY:
                return factory.createCopy(result.source, result.destination);
            default: throw new Error(`Unknown Operation type ${(result as any).type}`);
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
    private static mapExpression(expr: A.Expression,
      callbacks:{ [T in A.types]?: (op: TypedOperation<T>, factory: Factory) => RecurseResult },
      factory: Factory): A.Expression
    {
        let recurse = (op: A.Operation) => Util.mapOperation(op, callbacks, factory);

        switch(expr.expressionType)
        {
            case expressionTypes.AGGREGATE:
                if (expr.variable)
                {
                    return factory.createBoundAggregate(expr.variable, expr.aggregator, <Expression> recurse(expr.expression), expr.distinct, expr.separator);
                }
                return factory.createAggregateExpression(expr.aggregator, <Expression> recurse(expr.expression), expr.distinct, expr.separator);
            case expressionTypes.EXISTENCE:
                return factory.createExistenceExpression(expr.not, recurse(expr.input));
            case expressionTypes.NAMED:
                return factory.createNamedExpression(expr.name, <A.Expression[]> expr.args.map(recurse));
            case expressionTypes.OPERATOR:
                return factory.createOperatorExpression(expr.operator, <A.Expression[]> expr.args.map(recurse));
            case expressionTypes.TERM:
                return factory.createTermExpression(expr.term);
            case expressionTypes.WILDCARD:
                return factory.createWildcardExpression();
            default: throw new Error(`Unknown Expression type ${(expr as any).expressionType}`);
        }
    }

    public static createUniqueVariable(label: string, variables: {[vLabel: string]: boolean}, dataFactory: RDF.DataFactory): RDF.Variable {
        let counter: number = 0;
        let labelLoop = label;
        while (variables[labelLoop]) {
            labelLoop = `${label}${counter++}`;
        }
        return dataFactory.variable!(labelLoop);
    }

    // separate terms from wildcard since we handle them differently
    public static isSimpleTerm(term: any): term is RDF.Term {
        return term.termType !== undefined && term.termType !== 'Quad' && term.termType !== 'Wildcard';
    }

    public static isQuad(term: any): term is RDF.Quad {
        return term.termType === 'Quad';
    }

    public static isWildcard(term: any): term is Wildcard {
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
