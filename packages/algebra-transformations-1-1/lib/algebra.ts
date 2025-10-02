import type * as RDF from '@rdfjs/types';

export enum KnownTypes {
  ASK = 'ask',
  BGP = 'bgp',
  CONSTRUCT = 'construct',
  DESCRIBE = 'describe',
  DISTINCT = 'distinct',
  EXPRESSION = 'expression',
  PROPERTY_PATH_SYMBOL = 'propertypathsymbol',
  EXTEND = 'extend',
  FILTER = 'filter',
  FROM = 'from',
  GRAPH = 'graph',
  GROUP = 'group',
  JOIN = 'join',
  LEFT_JOIN = 'leftjoin',
  MINUS = 'minus',
  NOP = 'nop',
  ORDER_BY = 'orderby',
  PATH = 'path',
  PATTERN = 'pattern',
  PROJECT = 'project',
  REDUCED = 'reduced',
  SERVICE = 'service',
  SLICE = 'slice',
  UNION = 'union',
  VALUES = 'values',
  UPDATE = 'update',
  COMPOSITE_UPDATE = 'compositeupdate',
}

export enum KnownExpressionTypes {
  AGGREGATE = 'aggregate',
  EXISTENCE = 'existence',
  NAMED = 'named',
  OPERATOR = 'operator',
  TERM = 'term',
  WILDCARD = 'wildcard',
}

export enum KnownPropertyPathTypes {
  ALT = 'alt',
  INV = 'inv',
  LINK = 'link',
  ONE_OR_MORE_PATH = 'OneOrMorePath',
  SEQ = 'seq',
  NPS = 'nps',
  ZERO_OR_MORE_PATH = 'ZeroOrMorePath',
  ZERO_OR_ONE_PATH = 'ZeroOrOnePath',
}

export enum KnownUpdateTypes {
  DELETE_INSERT = 'deleteinsert',
  LOAD = 'load',
  CLEAR = 'clear',
  CREATE = 'create',
  DROP = 'drop',
  ADD = 'add',
  MOVE = 'move',
  COPY = 'copy',
}

// ----------------------- OPERATIONS -----------------------
/**
 * Open interface describing an operation. This type will often be used to reference to 'input operations'.
 * A closed form of this type is KnownOperation.
 * We provide a version of the algebra that refers to the KnownOperation instead of the open interface.
 */
export interface Operation {
  metadata?: Record<string, unknown>;
  type: string;
}

/**
 * Open interface describing an expression
 */
export interface Expression extends Operation {
  type: KnownTypes.EXPRESSION;
  subType: string;
}

export interface PropertyPathSymbol extends Operation {
  type: KnownTypes.PROPERTY_PATH_SYMBOL;
  subType: string;
}

export interface Update extends Operation {
  type: KnownTypes.UPDATE;
  subType: string;
}

// ----------------------- ABSTRACTS -----------------------

/**
 * Algebra operation taking a single operation as input.
 */
export interface Single extends Operation {
  input: Operation;
}

/**
 * Algebra operation taking multiple operations as input.
 */
export interface Multi extends Operation {
  input: Operation[];
}

/**
 * Algebra operation taking exactly two input operations.
 */
export interface Double extends Multi {
  input: [Operation, Operation];
}

export interface AggregateExpression extends Expression {
  subType: KnownExpressionTypes.AGGREGATE;
  aggregator: 'avg' | 'count' | 'group_concat' | 'max' | 'min' | 'sample' | 'sum';
  distinct: boolean;
  expression: Expression;
  separator?: string;
}

export interface GroupConcatExpression extends AggregateExpression {
  aggregator: 'group_concat';
  separator?: string;
}

export interface ExistenceExpression extends Expression {
  subType: KnownExpressionTypes.EXISTENCE;
  not: boolean;
  input: Operation;
}

export interface NamedExpression extends Expression {
  subType: KnownExpressionTypes.NAMED;
  name: RDF.NamedNode;
  args: Expression[];
}

export interface OperatorExpression extends Expression {
  subType: KnownExpressionTypes.OPERATOR;
  operator: string;
  args: Expression[];
}

export interface TermExpression extends Expression {
  subType: KnownExpressionTypes.TERM;
  term: RDF.Term;
}

export interface WildcardExpression extends Expression {
  subType: KnownExpressionTypes.WILDCARD;
  wildcard: {
    type: 'wildcard';
  };
}

// TODO: currently not differentiating between lists and multisets

// ----------------------- ACTUAL FUNCTIONS -----------------------

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) alternative (`|`).
 * Property paths have a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface Alt extends Multi, PropertyPathSymbol {
  type: KnownTypes.PROPERTY_PATH_SYMBOL;
  subType: KnownPropertyPathTypes.ALT;
  input: PropertyPathSymbol[];
}

export interface Ask extends Single {
  type: KnownTypes.ASK;
}

export interface Bgp extends Operation {
  type: KnownTypes.BGP;
  patterns: Pattern[];
}

export interface Construct extends Single {
  type: KnownTypes.CONSTRUCT;
  template: Pattern[];
}

export interface Describe extends Single {
  type: KnownTypes.DESCRIBE;
  terms: (RDF.Variable | RDF.NamedNode)[];
}

export interface Distinct extends Single {
  type: KnownTypes.DISTINCT;
}

export interface Extend extends Single {
  type: KnownTypes.EXTEND;
  variable: RDF.Variable;
  expression: Expression;
}

export interface From extends Single {
  type: KnownTypes.FROM;
  default: RDF.NamedNode[];
  named: RDF.NamedNode[];
}

export interface Filter extends Single {
  type: KnownTypes.FILTER;
  expression: Expression;
}

export interface Graph extends Single {
  type: KnownTypes.GRAPH;
  name: RDF.Variable | RDF.NamedNode;
}

// Also an expression
export interface BoundAggregate extends AggregateExpression {
  variable: RDF.Variable;
}

export interface Group extends Single {
  type: KnownTypes.GROUP;
  variables: RDF.Variable[];
  aggregates: BoundAggregate[];
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) inverse (`^`).
 * Having a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 * This operation, besides basic mode is the reason SPARQL can contain literals in the subject position.
 */
export interface Inv extends Operation, PropertyPathSymbol {
  type: KnownTypes.PROPERTY_PATH_SYMBOL;
  subType: KnownPropertyPathTypes.INV;
  path: PropertyPathSymbol;
}

export interface Join extends Multi {
  type: KnownTypes.JOIN;
}

export interface LeftJoin extends Double {
  type: KnownTypes.LEFT_JOIN;
  expression?: Expression;
}

/**
 * Algebra operation representing the property of a [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths).
 * Property paths have a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 * This operation, is just a way of saying to a Propery Path operation that nothing fancy is going on,
 * and it should just match this property.
 */
export interface Link extends Operation {
  type: KnownTypes.PROPERTY_PATH_SYMBOL;
  subType: KnownPropertyPathTypes.LINK;
  iri: RDF.NamedNode;
}

export interface Minus extends Double {
  type: KnownTypes.MINUS;
}

/**
 * An empty operation.
 * For example used for the algebra representation of a query string that does not contain any operation.
 */
export interface Nop extends Operation {
  type: KnownTypes.NOP;
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) negated property set (`!`).
 * Property paths have a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface Nps extends Operation, PropertyPathSymbol {
  type: KnownTypes.PROPERTY_PATH_SYMBOL;
  subType: KnownPropertyPathTypes.NPS;
  iris: RDF.NamedNode[];
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) one or more (`+`).
 * Property paths have a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface OneOrMorePath extends Operation, PropertyPathSymbol {
  type: KnownTypes.PROPERTY_PATH_SYMBOL;
  subType: KnownPropertyPathTypes.ONE_OR_MORE_PATH;
  path: PropertyPathSymbol;
}

export interface OrderBy extends Single {
  type: KnownTypes.ORDER_BY;
  expressions: Expression[];
}

export interface Path extends Operation {
  type: KnownTypes.PATH;
  subject: RDF.Term;
  predicate: PropertyPathSymbol;
  object: RDF.Term;
  graph: RDF.Term;
}

/**
 * Simple BGP entry (triple)
 */
export interface Pattern extends Operation, RDF.BaseQuad {
  type: KnownTypes.PATTERN;
}

export interface Project extends Single {
  type: KnownTypes.PROJECT;
  variables: RDF.Variable[];
}

export interface Reduced extends Single {
  type: KnownTypes.REDUCED;
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) sequence (`/`).
 * Property paths have a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface Seq extends Multi, PropertyPathSymbol {
  type: KnownTypes.PROPERTY_PATH_SYMBOL;
  subType: KnownPropertyPathTypes.SEQ;
  input: PropertyPathSymbol[];
}

export interface Service extends Single {
  type: KnownTypes.SERVICE;
  name: RDF.Variable | RDF.NamedNode;
  silent: boolean;
}

export interface Slice extends Single {
  type: KnownTypes.SLICE;
  start: number;
  length?: number;
}

export interface Union extends Multi {
  type: KnownTypes.UNION;
}

/**
 * Algebra operation representing the [VALUES pattern](https://www.w3.org/TR/sparql11-query/#inline-data)
 * Has a list of variables that will be assigned.
 * The assignments are represented as a list of object containing bindings.
 * Each binging links the variable value to the appropriate Term for this binding.
 * Does not take any input.
 */
export interface Values extends Operation {
  type: KnownTypes.VALUES;
  variables: RDF.Variable[];
  bindings: Record<string, RDF.Literal | RDF.NamedNode>[];
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) zero or more (`*`).
 * The having specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface ZeroOrMorePath extends Operation, PropertyPathSymbol {
  type: KnownTypes.PROPERTY_PATH_SYMBOL;
  subType: KnownPropertyPathTypes.ZERO_OR_MORE_PATH;
  path: PropertyPathSymbol;
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) zero or one (`?`).
 * The having specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface ZeroOrOnePath extends Operation, PropertyPathSymbol {
  type: KnownTypes.PROPERTY_PATH_SYMBOL;
  subType: KnownPropertyPathTypes.ZERO_OR_ONE_PATH;
  path: PropertyPathSymbol;
}

// ----------------------- UPDATE FUNCTIONS -----------------------
export interface CompositeUpdate extends Operation {
  type: KnownTypes.COMPOSITE_UPDATE;
  updates: Update[];
}

export interface DeleteInsert extends Operation, Update {
  type: KnownTypes.UPDATE;
  subType: KnownUpdateTypes.DELETE_INSERT;
  delete?: Pattern[];
  insert?: Pattern[];
  where?: Operation;
}

export interface UpdateGraph extends Operation, Update {
  type: KnownTypes.UPDATE;
  silent?: boolean;
}

export interface Load extends UpdateGraph {
  subType: KnownUpdateTypes.LOAD;
  source: RDF.NamedNode;
  destination?: RDF.NamedNode;
}

export interface Clear extends UpdateGraph {
  subType: KnownUpdateTypes.CLEAR;
  source: 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode;
}

export interface Create extends UpdateGraph {
  subType: KnownUpdateTypes.CREATE;
  source: RDF.NamedNode;
}

export interface Drop extends UpdateGraph {
  subType: KnownUpdateTypes.DROP;
  source: 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode;
}

export interface UpdateGraphShortcut extends UpdateGraph {
  source: 'DEFAULT' | RDF.NamedNode;
  destination: 'DEFAULT' | RDF.NamedNode;
}

export interface Add extends UpdateGraphShortcut {
  subType: KnownUpdateTypes.ADD;
}

export interface Move extends UpdateGraphShortcut {
  subType: KnownUpdateTypes.MOVE;
}

export interface Copy extends UpdateGraphShortcut {
  subType: KnownUpdateTypes.COPY;
}
