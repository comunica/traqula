import type * as RDF from '@rdfjs/types';
import { TransformerSubType } from '@traqula/core';

export enum Types {
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

export enum ExpressionTypes {
  AGGREGATE = 'aggregate',
  EXISTENCE = 'existence',
  NAMED = 'named',
  OPERATOR = 'operator',
  TERM = 'term',
  WILDCARD = 'wildcard',
}

export enum PropertyPathSymbolTypes {
  ALT = 'alt',
  INV = 'inv',
  LINK = 'link',
  ONE_OR_MORE_PATH = 'OneOrMorePath',
  SEQ = 'seq',
  NPS = 'nps',
  ZERO_OR_MORE_PATH = 'ZeroOrMorePath',
  ZERO_OR_ONE_PATH = 'ZeroOrOnePath',
}

export enum UpdateTypes {
  DELETE_INSERT = 'deleteinsert',
  LOAD = 'load',
  CLEAR = 'clear',
  CREATE = 'create',
  DROP = 'drop',
  ADD = 'add',
  MOVE = 'move',
  COPY = 'copy',
}

export type Operation = Ask | Expression | Bgp | Construct | Describe | Distinct | Extend | From | Filter
  | Graph | Group | Join | LeftJoin | Minus | Nop | OrderBy | Path | Pattern | Project | PropertyPathSymbol
  | Reduced | Service | Slice | Union | Values | Update | CompositeUpdate;

export type Expression = AggregateExpression | GroupConcatExpression | ExistenceExpression | NamedExpression |
  OperatorExpression | TermExpression | WildcardExpression | BoundAggregate;

export type PropertyPathSymbol = Alt | Inv | Link | Nps | OneOrMorePath | Seq | ZeroOrMorePath | ZeroOrOnePath;

export type Update = DeleteInsert | Load | Clear | Create | Drop | Add | Move | Copy;

// Returns the correct type based on the type enum
export type TypedOperation<T extends Types> = Extract<Operation, { type: T }>;
export type TypedExpression<T extends ExpressionTypes> = Extract<Expression, { subType: T }>;

// ----------------------- manipulators --------------------

const transformer = new TransformerSubType<Operation>();
export const mapOperationReplace = transformer.transformNode.bind(transformer);
export const mapOperationSubReplace = transformer.transformNodeSpecific.bind(transformer);
export const recurseOperationReplace = transformer.visitNode.bind(transformer);
export const recurseOperationSubReplace = transformer.visitNodeSpecific.bind(transformer);
export const traverseOperation = transformer.traverseNodes.bind(transformer);
export const traverseOperationSubReplace = transformer.traverseSubNodes.bind(transformer);

// ----------------------- OPERATIONS -----------------------
/**
 * Open interface describing an operation. This type will often be used to reference to 'input operations'.
 * A closed form of this type is KnownOperation.
 * We provide a version of the algebra that refers to the KnownOperation instead of the open interface.
 */
export interface BaseOperation {
  metadata?: Record<string, unknown>;
  type: string;
  subType?: string;
  input?: BaseOperation | BaseOperation[];
}

/**
 * Open interface describing an expression
 */
export interface BaseExpression extends BaseOperation {
  type: Types.EXPRESSION;
  subType: string;
}

export interface BasePropertyPathSymbol extends BaseOperation {
  type: Types.PROPERTY_PATH_SYMBOL;
  subType: string;
}

export interface BaseUpdate extends BaseOperation {
  type: Types.UPDATE;
  subType: string;
}

// ----------------------- ABSTRACTS -----------------------

/**
 * Algebra operation taking a single operation as input.
 */
export interface Single extends BaseOperation {
  input: Operation;
}

/**
 * Algebra operation taking multiple operations as input.
 */
export interface Multi extends BaseOperation {
  input: Operation[];
}

/**
 * Algebra operation taking exactly two input operations.
 */
export interface Double extends Multi {
  input: [Operation, Operation];
}

export interface AggregateExpression extends BaseExpression {
  subType: ExpressionTypes.AGGREGATE;
  aggregator: 'avg' | 'count' | 'group_concat' | 'max' | 'min' | 'sample' | 'sum';
  distinct: boolean;
  expression: Expression;
  separator?: string;
}

export interface GroupConcatExpression extends AggregateExpression {
  aggregator: 'group_concat';
  separator?: string;
}

export interface ExistenceExpression extends BaseExpression {
  subType: ExpressionTypes.EXISTENCE;
  not: boolean;
  input: Operation;
}

export interface NamedExpression extends BaseExpression {
  subType: ExpressionTypes.NAMED;
  name: RDF.NamedNode;
  args: Expression[];
}

export interface OperatorExpression extends BaseExpression {
  subType: ExpressionTypes.OPERATOR;
  operator: string;
  args: Expression[];
}

export interface TermExpression extends BaseExpression {
  subType: ExpressionTypes.TERM;
  term: RDF.Term;
}

export interface WildcardExpression extends BaseExpression {
  subType: ExpressionTypes.WILDCARD;
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
export interface Alt extends Multi, BasePropertyPathSymbol {
  type: Types.PROPERTY_PATH_SYMBOL;
  subType: PropertyPathSymbolTypes.ALT;
  input: PropertyPathSymbol[];
}

export interface Ask extends Single {
  type: Types.ASK;
}

export interface Bgp extends BaseOperation {
  type: Types.BGP;
  patterns: Pattern[];
}

export interface Construct extends Single {
  type: Types.CONSTRUCT;
  template: Pattern[];
}

export interface Describe extends Single {
  type: Types.DESCRIBE;
  terms: (RDF.Variable | RDF.NamedNode)[];
}

export interface Distinct extends Single {
  type: Types.DISTINCT;
}

export interface Extend extends Single {
  type: Types.EXTEND;
  variable: RDF.Variable;
  expression: Expression;
}

export interface From extends Single {
  type: Types.FROM;
  default: RDF.NamedNode[];
  named: RDF.NamedNode[];
}

export interface Filter extends Single {
  type: Types.FILTER;
  expression: Expression;
}

export interface Graph extends Single {
  type: Types.GRAPH;
  name: RDF.Variable | RDF.NamedNode;
}

// Also an expression
export interface BoundAggregate extends AggregateExpression {
  variable: RDF.Variable;
}

export interface Group extends Single {
  type: Types.GROUP;
  variables: RDF.Variable[];
  aggregates: BoundAggregate[];
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) inverse (`^`).
 * Having a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 * This operation, besides basic mode is the reason SPARQL can contain literals in the subject position.
 */
export interface Inv extends BaseOperation, BasePropertyPathSymbol {
  type: Types.PROPERTY_PATH_SYMBOL;
  subType: PropertyPathSymbolTypes.INV;
  path: PropertyPathSymbol;
}

export interface Join extends Multi {
  type: Types.JOIN;
}

export interface LeftJoin extends Double {
  type: Types.LEFT_JOIN;
  expression?: Expression;
}

/**
 * Algebra operation representing the property of a [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths).
 * Property paths have a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 * This operation, is just a way of saying to a Propery Path operation that nothing fancy is going on,
 * and it should just match this property.
 */
export interface Link extends BaseOperation {
  type: Types.PROPERTY_PATH_SYMBOL;
  subType: PropertyPathSymbolTypes.LINK;
  iri: RDF.NamedNode;
}

export interface Minus extends Double {
  type: Types.MINUS;
}

/**
 * An empty operation.
 * For example used for the algebra representation of a query string that does not contain any operation.
 */
export interface Nop extends BaseOperation {
  type: Types.NOP;
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) negated property set (`!`).
 * Property paths have a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface Nps extends BaseOperation, BasePropertyPathSymbol {
  type: Types.PROPERTY_PATH_SYMBOL;
  subType: PropertyPathSymbolTypes.NPS;
  iris: RDF.NamedNode[];
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) one or more (`+`).
 * Property paths have a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface OneOrMorePath extends BaseOperation, BasePropertyPathSymbol {
  type: Types.PROPERTY_PATH_SYMBOL;
  subType: PropertyPathSymbolTypes.ONE_OR_MORE_PATH;
  path: PropertyPathSymbol;
}

export interface OrderBy extends Single {
  type: Types.ORDER_BY;
  expressions: Expression[];
}

export interface Path extends BaseOperation {
  type: Types.PATH;
  subject: RDF.Term;
  predicate: PropertyPathSymbol;
  object: RDF.Term;
  graph: RDF.Term;
}

/**
 * Simple BGP entry (triple)
 */
export interface Pattern extends BaseOperation, RDF.BaseQuad {
  type: Types.PATTERN;
}

export interface Project extends Single {
  type: Types.PROJECT;
  variables: RDF.Variable[];
}

export interface Reduced extends Single {
  type: Types.REDUCED;
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) sequence (`/`).
 * Property paths have a specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface Seq extends Multi, BasePropertyPathSymbol {
  type: Types.PROPERTY_PATH_SYMBOL;
  subType: PropertyPathSymbolTypes.SEQ;
  input: PropertyPathSymbol[];
}

export interface Service extends Single {
  type: Types.SERVICE;
  name: RDF.Variable | RDF.NamedNode;
  silent: boolean;
}

export interface Slice extends Single {
  type: Types.SLICE;
  start: number;
  length?: number;
}

export interface Union extends Multi {
  type: Types.UNION;
}

/**
 * Algebra operation representing the [VALUES pattern](https://www.w3.org/TR/sparql11-query/#inline-data)
 * Has a list of variables that will be assigned.
 * The assignments are represented as a list of object containing bindings.
 * Each binging links the variable value to the appropriate Term for this binding.
 * Does not take any input.
 */
export interface Values extends BaseOperation {
  type: Types.VALUES;
  variables: RDF.Variable[];
  bindings: Record<string, RDF.Literal | RDF.NamedNode>[];
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) zero or more (`*`).
 * The having specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface ZeroOrMorePath extends BaseOperation, BasePropertyPathSymbol {
  type: Types.PROPERTY_PATH_SYMBOL;
  subType: PropertyPathSymbolTypes.ZERO_OR_MORE_PATH;
  path: PropertyPathSymbol;
}

/**
 * Algebra operation representing the [Property path](https://www.w3.org/TR/sparql11-query/#propertypaths) zero or one (`?`).
 * The having specific [SPARQL definition](https://www.w3.org/TR/sparql11-query/#sparqlPropertyPaths)
 */
export interface ZeroOrOnePath extends BaseOperation, BasePropertyPathSymbol {
  type: Types.PROPERTY_PATH_SYMBOL;
  subType: PropertyPathSymbolTypes.ZERO_OR_ONE_PATH;
  path: PropertyPathSymbol;
}

// ----------------------- UPDATE FUNCTIONS -----------------------
export interface CompositeUpdate extends BaseOperation {
  type: Types.COMPOSITE_UPDATE;
  updates: (Update | Nop)[];
}

export interface DeleteInsert extends BaseOperation, BaseUpdate {
  type: Types.UPDATE;
  subType: UpdateTypes.DELETE_INSERT;
  delete?: Pattern[];
  insert?: Pattern[];
  where?: Operation;
}

export interface UpdateGraph extends BaseUpdate {
  type: Types.UPDATE;
  silent?: boolean;
}

export interface Load extends UpdateGraph {
  subType: UpdateTypes.LOAD;
  source: RDF.NamedNode;
  destination?: RDF.NamedNode;
}

export interface Clear extends UpdateGraph {
  subType: UpdateTypes.CLEAR;
  source: 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode;
}

export interface Create extends UpdateGraph {
  subType: UpdateTypes.CREATE;
  source: RDF.NamedNode;
}

export interface Drop extends UpdateGraph {
  subType: UpdateTypes.DROP;
  source: 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode;
}

export interface UpdateGraphShortcut extends UpdateGraph {
  source: 'DEFAULT' | RDF.NamedNode;
  destination: 'DEFAULT' | RDF.NamedNode;
}

export interface Add extends UpdateGraphShortcut {
  subType: UpdateTypes.ADD;
}

export interface Move extends UpdateGraphShortcut {
  subType: UpdateTypes.MOVE;
}

export interface Copy extends UpdateGraphShortcut {
  subType: UpdateTypes.COPY;
}
