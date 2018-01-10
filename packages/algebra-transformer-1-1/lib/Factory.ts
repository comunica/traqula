
import * as A from './algebra';
import * as RDF from "rdf-js";
import {Util as N3Util} from "n3";
import * as _ from "lodash";

export default class Factory
{
    static createAlt (left: A.Operation, right: A.Operation): A.Alt { return { type: 'alt', left, right }; }
    static createBoundAggregate (variable: RDF.Variable, aggregate: string, expression: A.Expression, distinct: boolean, separator?: string): A.BoundAggregate
    {
        let result = <A.BoundAggregate>Factory.createAggregateExpression(aggregate, expression, distinct, separator);
        result.variable = variable;
        return result;
    }
    static createBgp (patterns: A.Pattern[]): A.Bgp { return { type: 'bgp', patterns }; }
    static createConstruct (input: A.Operation, template: A.Pattern[]): A.Construct { return { type: 'construct', input, template }; }
    static createDistinct (input: A.Operation) : A.Distinct { return { type: 'distinct', input }; }
    static createExtend (input: A.Operation, variable: RDF.Variable, expression: A.Expression) : A.Extend { return { type: 'extend', input, variable, expression }; }
    static createFilter (input: A.Operation, expression: A.Expression) : A.Filter { return { type: 'filter', input, expression }; }
    static createGraph (input: A.Operation, name: RDF.Term) : A.Graph { return { type: 'graph', input, name }; }
    static createGroup (input: A.Operation, variables: RDF.Variable[], aggregates: A.BoundAggregate[]) : A.Group { return { type: 'group', input, variables, aggregates }; }
    static createInv (path: A.Operation): A.Inv { return { type: 'inv', path }; }
    static createJoin (left: A.Operation, right: A.Operation): A.Join { return { type: 'join', left, right }; }
    static createLeftJoin (left: A.Operation, right: A.Operation, expression?: A.Expression): A.LeftJoin
    {
        if (expression)
            return { type: 'leftjoin', left, right, expression };
        return { type: 'leftjoin', left, right };
    }
    static createLink (iri: RDF.NamedNode): A.Link { return { type: 'link', iri }; }
    static createMinus (left: A.Operation, right: A.Operation): A.Minus { return { type: 'minus', left, right }; }
    static createNps (iris: RDF.NamedNode[]): A.Nps { return { type: 'nps', iris }; }
    static createOneOrMorePath (path: A.Operation): A.OneOrMorePath { return { type: 'OneOrMorePath', path }; }
    static createOrderBy (input: A.Operation, expressions: A.Expression[]) : A.OrderBy { return { type: 'orderby', input, expressions }; }
    static createPath (subject: RDF.Term, predicate: A.Operation, object: RDF.Term, graph?: RDF.Term) : A.Path
    {
        if (graph)
            return { type: 'path', subject, predicate, object, graph };
        return { type: 'path', subject, predicate, object, graph: defaultGraph };
    }
    // TODO: cast needed due to missing equals method (could use https://github.com/rdf-ext/rdf-data-model )
    static createPattern (subject: RDF.Term, predicate: RDF.Term, object: RDF.Term, graph?: RDF.Term) : A.Pattern
    {
        if (graph)
            return <A.Pattern><any>{ type: 'pattern', subject, predicate, object, graph };
        return <A.Pattern><any>{ type: 'pattern', subject, predicate, object, graph: defaultGraph };
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
    static createValues (variables: RDF.Variable[], bindings: Map<RDF.Variable, RDF.Term>[]): A.Values { return { type: 'values', variables, bindings }; }
    static createZeroOrMorePath (path: A.Operation): A.ZeroOrMorePath { return { type: 'ZeroOrMorePath', path }; }
    static createZeroOrOnePath (path: A.Operation): A.ZeroOrOnePath { return { type: 'ZeroOrOnePath', path }; }

    static createAggregateExpression (aggregator: string, expression: A.Expression, distinct: boolean, separator?: string): A.AggregateExpression
    {
        if (separator)
            return { type: 'expression', expressionType: 'aggregate', aggregator, expression, separator, distinct};
        return { type: 'expression', expressionType: 'aggregate', aggregator, expression, distinct };
    }
    static createExistenceExpression (not: boolean, input: A.Operation): A.ExistenceExpression { return { type: 'expression', expressionType: 'existence', not, input }; }
    static createNamedExpression (name: RDF.NamedNode, args: A.Expression[]): A.NamedExpression { return { type: 'expression', expressionType: 'named', name, args }; }
    static createOperatorExpression (operator: string, args: A.Expression[]): A.OperatorExpression { return { type: 'expression', expressionType: 'operator', operator, args }; }
    static createTermExpression (term: RDF.Term): A.TermExpression { return { type: 'expression', expressionType: 'term', term }; }

    static createTerm (str: string): RDF.Term
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
                    literal.datatype = <RDF.NamedNode>Factory.createTerm(type);
            }
            return literal;
        }
        return <RDF.NamedNode> { termType: 'NamedNode', value: str };
    }
}

const defaultGraph: RDF.DefaultGraph = <RDF.DefaultGraph>{ termType: 'DefaultGraph', value: ''};
const stringType = <RDF.NamedNode>Factory.createTerm('http://www.w3.org/2001/XMLSchema#string');
const langStringType = <RDF.NamedNode>Factory.createTerm('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');