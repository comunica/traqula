
import * as A from './algebra';
import * as RDF from "rdf-js";

export default class Factory
{
    static createAlt (left: A.Operation, right: A.Operation): A.Alt { return { type: 'alt', left, right }; }
    static createAggregate (aggregate: string, expression: A.Expression, separator?: string): A.Aggregate
    {
        if (separator)
            return { type: 'aggregate', aggregate, expression, separator};
        return { type: 'aggregate', aggregate, expression };
    }
    static createBoundAggregate (variable: RDF.Variable, aggregate: string, expression: A.Expression, separator?: string): A.BoundAggregate
    {
        let result = <A.BoundAggregate>Factory.createAggregate(aggregate, expression, separator);
        result.variable = variable;
        return result;
    }
    static createBgp (patterns: RDF.Term[]): A.Bgp { return { type: 'bgp', patterns }; }
    static createDistinct (input: A.Operation) : A.Distinct { return { type: 'distinct', input }; }
    static createExtend (input: A.Operation, variable: RDF.Variable, expression: A.Expression) : A.Extend { return { type: 'extend', input, variable, expression }; }
    static createFilter (input: A.Operation, expression: A.Expression) : A.Filter { return { type: 'filter', input, expression }; }
    static createGraph (input: A.Operation, graph: RDF.Term) : A.Graph { return { type: 'graph', input, graph }; }
    static createGroup (input: A.Operation, expressions: A.Expression[], aggregates: A.BoundAggregate[]) : A.Group { return { type: 'group', input, expressions, aggregates }; }
    static createInv (path: A.Operation): A.Inv { return { type: 'inv', path }; }
    static createJoin (left: A.Operation, right: A.Operation): A.Join { return { type: 'join', left, right }; }
    static createLeftJoin (left: A.Operation, right: A.Operation, expression: A.Expression): A.LeftJoin { return { type: 'leftjoin', left, right, expression }; }
    static createLink (iri: RDF.NamedNode): A.Link { return { type: 'link', iri }; }
    static createMinus (left: A.Operation, right: A.Operation): A.Minus { return { type: 'minus', left, right }; }
    static createNps (iris: RDF.NamedNode[]): A.Nps { return { type: 'nps', iris }; }
    static createOneOrMorePath (path: A.Operation): A.OneOrMorePath { return { type: 'OneOrMorePath', path }; }
    static createOrderBy (input: A.Operation, expressions: A.Expression[]) : A.OrderBy { return { type: 'orderby', input, expressions }; }
    static createPath (subject: RDF.Term, predicate: A.Path, object: RDF.Term, graph?: RDF.Term) : A.Path
    {
        if (graph)
            return { type: 'path', subject, predicate, object, graph };
        return { type: 'path', subject, predicate, object };
    }
    static createProject (input: A.Operation, variables: RDF.Variable[]) : A.Project { return { type: 'project', input, variables }; }
    static createReduced (input: A.Operation) : A.Reduced { return { type: 'reduced', input }; }
    static createSeq (left: A.Operation, right: A.Operation): A.Seq { return { type: 'seq', left, right }; }
    static createSlice (input: A.Operation, start: number, length?: number) : A.Slice
    {
        if (length !== undefined)
            return { type: 'slice', input, start, length };
        return { type: 'slice', input, start };
    }
    static createUnion (left: A.Operation, right: A.Operation): A.Union { return { type: 'union', left, right }; }
    static createValues (variables: RDF.Variable[], bindings: any[]): A.Values { return { type: 'values', variables, bindings }; }
    static createZeroOrMorePath (path: A.Operation): A.ZeroOrMorePath { return { type: 'ZeroOrMorePath', path }; }
    static createZeroOrOnePath (path: A.Operation): A.ZeroOrOnePath { return { type: 'ZeroOrOnePath', path }; }
}