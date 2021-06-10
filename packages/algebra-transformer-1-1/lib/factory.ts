
import * as A from './algebra';
import * as RDF from "rdf-js";
import { DataFactory } from 'rdf-data-factory';
import {stringToTerm} from "rdf-string";
const Wildcard = require('sparqljs').Wildcard;

export default class Factory
{
    dataFactory: RDF.DataFactory;
    stringType: RDF.NamedNode;

    constructor(dataFactory?: RDF.DataFactory) {
        this.dataFactory = dataFactory || new DataFactory();
        this.stringType = <RDF.NamedNode>this.createTerm('http://www.w3.org/2001/XMLSchema#string');
    }

    createAlt (left: A.PropertyPathSymbol, right: A.PropertyPathSymbol): A.Alt { return { type: A.types.ALT, left, right }; }
    createAsk (input: A.Operation): A.Ask { return { type: A.types.ASK, input }; }
    createBoundAggregate (variable: RDF.Variable, aggregate: string, expression: A.Expression, distinct: boolean, separator?: string): A.BoundAggregate
    {
        let result = <A.BoundAggregate>this.createAggregateExpression(aggregate, expression, distinct, separator);
        result.variable = variable;
        return result;
    }
    createBgp (patterns: A.Pattern[]): A.Bgp { return { type: A.types.BGP, patterns }; }
    createConstruct (input: A.Operation, template: A.Pattern[]): A.Construct { return { type: A.types.CONSTRUCT, input, template }; }
    createDescribe (input: A.Operation, terms: RDF.Term[]): A.Describe { return { type: A.types.DESCRIBE, input, terms }; }
    createDistinct (input: A.Operation) : A.Distinct { return { type: A.types.DISTINCT, input }; }
    createExtend (input: A.Operation, variable: RDF.Variable, expression: A.Expression) : A.Extend { return { type: A.types.EXTEND, input, variable, expression }; }
    createFrom (input: A.Operation, def: RDF.Term[], named: RDF.Term[]) : A.From { return { type: A.types.FROM, input, default: def, named }; }
    createFilter (input: A.Operation, expression: A.Expression) : A.Filter { return { type: A.types.FILTER, input, expression }; }
    createGraph (input: A.Operation, name: RDF.Term) : A.Graph { return { type: A.types.GRAPH, input, name }; }
    createGroup (input: A.Operation, variables: RDF.Variable[], aggregates: A.BoundAggregate[]) : A.Group { return { type: A.types.GROUP, input, variables, aggregates }; }
    createInv (path: A.PropertyPathSymbol): A.Inv { return { type: A.types.INV, path }; }
    createJoin (left: A.Operation, right: A.Operation): A.Join { return { type: A.types.JOIN, left, right }; }
    createLeftJoin (left: A.Operation, right: A.Operation, expression?: A.Expression): A.LeftJoin
    {
        if (expression)
            return { type: A.types.LEFT_JOIN, left, right, expression };
        return { type: A.types.LEFT_JOIN, left, right };
    }
    createLink (iri: RDF.NamedNode): A.Link { return { type: A.types.LINK, iri }; }
    createMinus (left: A.Operation, right: A.Operation): A.Minus { return { type: A.types.MINUS, left, right }; }
    createNop (): A.Nop { return { type: A.types.NOP }; }
    createNps (iris: RDF.NamedNode[]): A.Nps { return { type: A.types.NPS, iris }; }
    createOneOrMorePath (path: A.PropertyPathSymbol): A.OneOrMorePath { return { type: A.types.ONE_OR_MORE_PATH, path }; }
    createOrderBy (input: A.Operation, expressions: A.Expression[]) : A.OrderBy { return { type: A.types.ORDER_BY, input, expressions }; }
    createPath (subject: RDF.Term, predicate: A.PropertyPathSymbol, object: RDF.Term, graph?: RDF.Term) : A.Path
    {
        if (graph)
            return { type: A.types.PATH, subject, predicate, object, graph };
        return { type: A.types.PATH, subject, predicate, object, graph: this.dataFactory.defaultGraph() };
    }
    createPattern (subject: RDF.Term, predicate: RDF.Term, object: RDF.Term, graph?: RDF.Term): A.Pattern
    {
        let pattern = <A.Pattern>this.dataFactory.quad(<RDF.Quad_Subject>subject, <RDF.Quad_Predicate>predicate, <RDF.Quad_Object>object, <RDF.Quad_Graph>graph);
        pattern.type = A.types.PATTERN;
        return pattern;
    }
    createProject (input: A.Operation, variables: RDF.Variable[]) : A.Project { return { type: A.types.PROJECT, input, variables }; }
    createReduced (input: A.Operation) : A.Reduced { return { type: A.types.REDUCED, input }; }
    createSeq (left: A.PropertyPathSymbol, right: A.PropertyPathSymbol): A.Seq { return { type: A.types.SEQ, left, right }; }
    createService (input: A.Operation, name: RDF.Term, silent?: boolean): A.Service { return { type: A.types.SERVICE, input, name, silent }; }
    createSlice (input: A.Operation, start: number, length?: number) : A.Slice
    {
        start = start || 0;
        if (length !== undefined)
            return { type: A.types.SLICE, input, start, length };
        return { type: A.types.SLICE, input, start };
    }
    createUnion (left: A.Operation, right: A.Operation): A.Union { return { type: A.types.UNION, left, right }; }
    createValues (variables: RDF.Variable[], bindings: {[key: string]: RDF.Term}[]): A.Values { return { type: A.types.VALUES, variables, bindings }; }
    createZeroOrMorePath (path: A.PropertyPathSymbol): A.ZeroOrMorePath { return { type: A.types.ZERO_OR_MORE_PATH, path }; }
    createZeroOrOnePath (path: A.PropertyPathSymbol): A.ZeroOrOnePath { return { type: A.types.ZERO_OR_ONE_PATH, path }; }
    createAggregateExpression (aggregator: string, expression: A.Expression, distinct: boolean, separator?: string): A.AggregateExpression
    {
        if (separator)
            return { type: A.types.EXPRESSION, expressionType: A.expressionTypes.AGGREGATE, aggregator: <any> aggregator, expression, separator, distinct};
        return { type: A.types.EXPRESSION, expressionType: A.expressionTypes.AGGREGATE, aggregator: <any> aggregator, expression, distinct };
    }
    createExistenceExpression (not: boolean, input: A.Operation): A.ExistenceExpression { return { type: A.types.EXPRESSION, expressionType: A.expressionTypes.EXISTENCE, not, input }; }
    createNamedExpression (name: RDF.NamedNode, args: A.Expression[]): A.NamedExpression { return { type: A.types.EXPRESSION, expressionType: A.expressionTypes.NAMED, name, args }; }
    createOperatorExpression (operator: string, args: A.Expression[]): A.OperatorExpression { return { type: A.types.EXPRESSION, expressionType: A.expressionTypes.OPERATOR, operator, args }; }
    createTermExpression (term: RDF.Term): A.TermExpression { return { type: A.types.EXPRESSION, expressionType: A.expressionTypes.TERM, term }; }
    createWildcardExpression (): A.WildcardExpression { return { type: A.types.EXPRESSION, expressionType: A.expressionTypes.WILDCARD, wildcard: new Wildcard() }; }

    createTerm (str: string): RDF.Term
    {
        return stringToTerm(str, this.dataFactory);
    }

    // Update functions
    createCompositeUpdate (updates: A.Update[]): A.CompositeUpdate { return { type: A.types.COMPOSITE_UPDATE, updates }; }
    createDeleteInsert (deleteQuads?: A.Pattern[], insertQuads?: A.Pattern[], where?: A.Operation): A.DeleteInsert {
        const result: A.DeleteInsert = { type: A.types.DELETE_INSERT };
        if (deleteQuads)
            result.delete = deleteQuads;
        if (insertQuads)
            result.insert = insertQuads;
        if (where)
            result.where = where;
        return result;
    }
    createLoad (source: RDF.NamedNode, destination?: RDF.NamedNode, silent?: boolean): A.Load {
        const result: A.Load = { type: A.types.LOAD, source };
        if (destination)
            result.destination = destination;
        return this.addSilent(result, silent);
    }
    createClear (source: 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode, silent?: boolean): A.Clear {
        return this.addSilent({ type: A.types.CLEAR, source }, silent);
    }
    createCreate (source: RDF.NamedNode, silent?: boolean): A.Create {
        return this.addSilent({ type: A.types.CREATE, source }, silent);
    }
    createDrop (source: 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode, silent?: boolean): A.Drop {
        return this.addSilent({ type: A.types.DROP, source }, silent);
    }
    createAdd (source: 'DEFAULT' | RDF.NamedNode, destination: 'DEFAULT' | RDF.NamedNode, silent?: boolean): A.Add {
        return this.addSilent({ type: A.types.ADD, source, destination }, silent);
    }
    createMove (source: 'DEFAULT' | RDF.NamedNode, destination: 'DEFAULT' | RDF.NamedNode, silent?: boolean): A.Move {
        return this.addSilent({ type: A.types.MOVE, source, destination }, silent);
    }
    createCopy (source: 'DEFAULT' | RDF.NamedNode, destination: 'DEFAULT' | RDF.NamedNode, silent?: boolean): A.Copy {
        return this.addSilent({ type: A.types.COPY, source, destination }, silent);
    }
    private addSilent<T extends A.UpdateGraph>(input: T, silent: boolean): T {
        if (silent)
            input.silent = silent;
        return input;
    }
}
