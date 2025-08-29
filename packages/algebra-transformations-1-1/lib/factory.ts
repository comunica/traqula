import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import { stringToTerm } from 'rdf-string';
import * as A from './algebra';

export class Factory {
  public dataFactory: RDF.DataFactory<RDF.BaseQuad, RDF.BaseQuad>;
  public stringType: RDF.NamedNode;

  public constructor(dataFactory?: RDF.DataFactory<RDF.BaseQuad>) {
    this.dataFactory = dataFactory ?? new DataFactory();
    this.stringType = <RDF.NamedNode> this.createTerm('http://www.w3.org/2001/XMLSchema#string');
  }

  public createAlt(input: A.PropertyPathSymbol[], flatten = true): A.Alt {
    return this.flattenMulti({ type: A.Types.ALT, input }, flatten);
  }

  public createAsk(input: A.Operation): A.Ask {
    return { type: A.Types.ASK, input };
  }

  public createBoundAggregate(
    variable: RDF.Variable,
    aggregate: string,
    expression: A.Expression,
    distinct: boolean,
    separator?: string,
  ): A.BoundAggregate {
    const result = <A.BoundAggregate> this.createAggregateExpression(aggregate, expression, distinct, separator);
    result.variable = variable;
    return result;
  }

  public createBgp(patterns: A.Pattern[]): A.Bgp {
    return { type: A.Types.BGP, patterns };
  }

  public createConstruct(input: A.Operation, template: A.Pattern[]): A.Construct {
    return { type: A.Types.CONSTRUCT, input, template };
  }

  public createDescribe(input: A.Operation, terms: (RDF.Variable | RDF.NamedNode)[]): A.Describe {
    return { type: A.Types.DESCRIBE, input, terms };
  }

  public createDistinct(input: A.Operation): A.Distinct {
    return { type: A.Types.DISTINCT, input };
  }

  public createExtend(input: A.Operation, variable: RDF.Variable, expression: A.Expression): A.Extend {
    return { type: A.Types.EXTEND, input, variable, expression };
  }

  public createFrom(input: A.Operation, def: RDF.NamedNode[], named: RDF.NamedNode[]): A.From {
    return { type: A.Types.FROM, input, default: def, named };
  }

  public createFilter(input: A.Operation, expression: A.Expression): A.Filter {
    return { type: A.Types.FILTER, input, expression };
  }

  public createGraph(input: A.Operation, name: RDF.Variable | RDF.NamedNode): A.Graph {
    return { type: A.Types.GRAPH, input, name };
  }

  public createGroup(input: A.Operation, variables: RDF.Variable[], aggregates: A.BoundAggregate[]): A.Group {
    return { type: A.Types.GROUP, input, variables, aggregates };
  }

  public createInv(path: A.PropertyPathSymbol): A.Inv {
    return { type: A.Types.INV, path };
  }

  public createJoin(input: A.Operation[], flatten = true): A.Join {
    return this.flattenMulti({ type: A.Types.JOIN, input }, flatten);
  }

  public createLeftJoin(left: A.Operation, right: A.Operation, expression?: A.Expression): A.LeftJoin {
    if (expression) {
      return { type: A.Types.LEFT_JOIN, input: [ left, right ], expression };
    }
    return { type: A.Types.LEFT_JOIN, input: [ left, right ]};
  }

  public createLink(iri: RDF.NamedNode): A.Link {
    return { type: A.Types.LINK, iri };
  }

  public createMinus(left: A.Operation, right: A.Operation): A.Minus {
    return { type: A.Types.MINUS, input: [ left, right ]};
  }

  public createNop(): A.Nop {
    return { type: A.Types.NOP };
  }

  public createNps(iris: RDF.NamedNode[]): A.Nps {
    return { type: A.Types.NPS, iris };
  }

  public createOneOrMorePath(path: A.PropertyPathSymbol): A.OneOrMorePath {
    return { type: A.Types.ONE_OR_MORE_PATH, path };
  }

  public createOrderBy(input: A.Operation, expressions: A.Expression[]): A.OrderBy {
    return { type: A.Types.ORDER_BY, input, expressions };
  }

  public createPath(subject: RDF.Term, predicate: A.PropertyPathSymbol, object: RDF.Term, graph?: RDF.Term): A.Path {
    if (graph) {
      return { type: A.Types.PATH, subject, predicate, object, graph };
    }
    return { type: A.Types.PATH, subject, predicate, object, graph: this.dataFactory.defaultGraph() };
  }

  public createPattern(subject: RDF.Term, predicate: RDF.Term, object: RDF.Term, graph?: RDF.Term): A.Pattern {
    const pattern = <A.Pattern> this.dataFactory.quad(subject, predicate, object, graph);
    pattern.type = A.Types.PATTERN;
    return pattern;
  }

  public createProject(input: A.Operation, variables: RDF.Variable[]): A.Project {
    return { type: A.Types.PROJECT, input, variables };
  }

  public createReduced(input: A.Operation): A.Reduced {
    return { type: A.Types.REDUCED, input };
  }

  public createSeq(input: A.PropertyPathSymbol[], flatten = true): A.Seq {
    return this.flattenMulti({ type: A.Types.SEQ, input }, flatten);
  }

  public createService(input: A.Operation, name: RDF.NamedNode | RDF.Variable, silent?: boolean): A.Service {
    return { type: A.Types.SERVICE, input, name, silent: Boolean(silent) };
  }

  public createSlice(input: A.Operation, start: number, length?: number): A.Slice {
    start = start || 0;
    if (length !== undefined) {
      return { type: A.Types.SLICE, input, start, length };
    }
    return { type: A.Types.SLICE, input, start };
  }

  public createUnion(input: A.Operation[], flatten = true): A.Union {
    return this.flattenMulti({ type: A.Types.UNION, input }, flatten);
  }

  public createValues(variables: RDF.Variable[], bindings: Record<string, RDF.Literal | RDF.NamedNode>[]): A.Values {
    return { type: A.Types.VALUES, variables, bindings };
  }

  public createZeroOrMorePath(path: A.PropertyPathSymbol): A.ZeroOrMorePath {
    return { type: A.Types.ZERO_OR_MORE_PATH, path };
  }

  public createZeroOrOnePath(path: A.PropertyPathSymbol): A.ZeroOrOnePath {
    return { type: A.Types.ZERO_OR_ONE_PATH, path };
  }

  public createAggregateExpression(
    aggregator: string,
    expression: A.Expression,
    distinct: boolean,
    separator?: string,
  ): A.AggregateExpression {
    if (separator !== undefined) {
      return {
        type: A.Types.EXPRESSION,
        expressionType: A.expressionTypes.AGGREGATE,
        aggregator: <any> aggregator,
        expression,
        separator,
        distinct,
      };
    }
    return {
      type: A.Types.EXPRESSION,
      expressionType: A.expressionTypes.AGGREGATE,
      aggregator: <any> aggregator,
      expression,
      distinct,
    };
  }

  public createExistenceExpression(not: boolean, input: A.Operation): A.ExistenceExpression {
    return { type: A.Types.EXPRESSION, expressionType: A.expressionTypes.EXISTENCE, not, input };
  }

  public createNamedExpression(name: RDF.NamedNode, args: A.Expression[]): A.NamedExpression {
    return { type: A.Types.EXPRESSION, expressionType: A.expressionTypes.NAMED, name, args };
  }

  public createOperatorExpression(operator: string, args: A.Expression[]): A.OperatorExpression {
    return { type: A.Types.EXPRESSION, expressionType: A.expressionTypes.OPERATOR, operator, args };
  }

  public createTermExpression(term: RDF.Term): A.TermExpression {
    return { type: A.Types.EXPRESSION, expressionType: A.expressionTypes.TERM, term };
  }

  public createWildcardExpression(): A.WildcardExpression {
    return { type: A.Types.EXPRESSION, expressionType: A.expressionTypes.WILDCARD, wildcard: { type: 'wildcard' }};
  }

  public createTerm(str: string): RDF.Term {
    if (str.startsWith('$')) {
      str = str.replace('$', '?');
    }
    return stringToTerm(str, this.dataFactory);
  }

  // Update functions
  public createCompositeUpdate(updates: A.Update[]): A.CompositeUpdate {
    return { type: A.Types.COMPOSITE_UPDATE, updates };
  }

  public createDeleteInsert(deleteQuads?: A.Pattern[], insertQuads?: A.Pattern[], where?: A.Operation): A.DeleteInsert {
    const result: A.DeleteInsert = { type: A.Types.DELETE_INSERT };
    if (deleteQuads) {
      result.delete = deleteQuads;
    }
    if (insertQuads) {
      result.insert = insertQuads;
    }
    if (where) {
      result.where = where;
    }
    return result;
  }

  public createLoad(source: RDF.NamedNode, destination?: RDF.NamedNode, silent?: boolean): A.Load {
    const result: A.Load = { type: A.Types.LOAD, source };
    if (destination) {
      result.destination = destination;
    }
    return this.addSilent(result, Boolean(silent));
  }

  public createClear(source: 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode, silent?: boolean): A.Clear {
    return this.addSilent({ type: A.Types.CLEAR, source }, Boolean(silent));
  }

  public createCreate(source: RDF.NamedNode, silent?: boolean): A.Create {
    return this.addSilent({ type: A.Types.CREATE, source }, Boolean(silent));
  }

  public createDrop(source: 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode, silent?: boolean): A.Drop {
    return this.addSilent({ type: A.Types.DROP, source }, Boolean(silent));
  }

  public createAdd(source: 'DEFAULT' | RDF.NamedNode, destination: 'DEFAULT' | RDF.NamedNode, silent?: boolean): A.Add {
    return this.addSilent({ type: A.Types.ADD, source, destination }, Boolean(silent));
  }

  public createMove(
    source: 'DEFAULT' | RDF.NamedNode,
    destination: 'DEFAULT' | RDF.NamedNode,
    silent?: boolean,
  ): A.Move {
    return this.addSilent({
      type: A.Types.MOVE,
      source,
      destination,
    }, Boolean(silent));
  }

  public createCopy(
    source: 'DEFAULT' | RDF.NamedNode,
    destination: 'DEFAULT' | RDF.NamedNode,
    silent?: boolean,
  ): A.Copy {
    return this.addSilent({
      type: A.Types.COPY,
      source,
      destination,
    }, Boolean(silent));
  }

  private addSilent<T extends A.UpdateGraph>(input: T, silent: boolean): T {
    if (silent) {
      input.silent = silent;
    }
    return input;
  }

  private flattenMulti<T extends A.Multi>(input: T, flatten: boolean): T {
    if (!flatten) {
      return input;
    }
    const type = input.type;
    const children = input.input;
    const newChildren: A.Operation[] = [];
    for (const child of children) {
      if (child.type === type) {
        newChildren.push(...(<A.Multi> child).input);
      } else {
        newChildren.push(child);
      }
    }
    input.input = newChildren;
    return input;
  }
}
