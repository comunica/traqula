import type * as rdfjs from '@rdfjs/types';

export enum Types {
  ALT = 'alt',
  ASK = 'ask',
  BGP = 'bgp',
  CONSTRUCT = 'construct',
  DESCRIBE = 'describe',
  DISTINCT = 'distinct',
  EXPRESSION = 'expression',
  EXTEND = 'extend',
  FILTER = 'filter',
  FROM = 'from',
  GRAPH = 'graph',
  GROUP = 'group',
  INV = 'inv',
  JOIN = 'join',
  LEFT_JOIN = 'leftjoin',
  LINK = 'link',
  MINUS = 'minus',
  NOP = 'nop',
  NPS = 'nps',
  ONE_OR_MORE_PATH = 'OneOrMorePath',
  ORDER_BY = 'orderby',
  PATH = 'path',
  PATTERN = 'pattern',
  PROJECT = 'project',
  REDUCED = 'reduced',
  SEQ = 'seq',
  SERVICE = 'service',
  SLICE = 'slice',
  UNION = 'union',
  VALUES = 'values',
  ZERO_OR_MORE_PATH = 'ZeroOrMorePath',
  ZERO_OR_ONE_PATH = 'ZeroOrOnePath',

  COMPOSITE_UPDATE = 'compositeupdate',
  DELETE_INSERT = 'deleteinsert',
  LOAD = 'load',
  CLEAR = 'clear',
  CREATE = 'create',
  DROP = 'drop',
  ADD = 'add',
  MOVE = 'move',
  COPY = 'copy',
}

export enum expressionTypes {
  AGGREGATE = 'aggregate',
  EXISTENCE = 'existence',
  NAMED = 'named',
  OPERATOR = 'operator',
  TERM = 'term',
  WILDCARD = 'wildcard',
}

// ----------------------- OPERATIONS -----------------------
export type Operation =
  Ask | Expression | Bgp | Construct | Describe | Distinct | Extend | From | Filter | Graph | Group | Join | LeftJoin |
  Minus | Nop | OrderBy | Path | Pattern | Project | PropertyPathSymbol | Reduced | Service | Slice | Union | Values |
  Update;

export type Expression = AggregateExpression | GroupConcatExpression | ExistenceExpression | NamedExpression |
  OperatorExpression | TermExpression | WildcardExpression | BoundAggregate;

export type PropertyPathSymbol = Alt | Inv | Link | Nps | OneOrMorePath | Seq | ZeroOrMorePath | ZeroOrOnePath;

export type Update = CompositeUpdate | DeleteInsert | Load | Clear | Create | Drop | Add | Move | Copy | Nop;

// Returns the correct type based on the type enum
export type TypedOperation<T extends Types> = Extract<Operation, { type: T }>;
export type TypedExpression<T extends expressionTypes> = Extract<Expression, { expressionType: T }>;
// ----------------------- ABSTRACTS -----------------------

export interface BaseOperation {
  [key: string]: any;
  metadata?: Record<string, unknown>;
  type: Types;
}

export interface Single extends BaseOperation {
  input: Operation;
}

export interface Multi extends BaseOperation {
  input: Operation[];
}

export interface Double extends Multi {
  input: [Operation, Operation];
}

export interface BaseExpression extends BaseOperation {
  type: Types.EXPRESSION;
  expressionType: expressionTypes;
}

export interface AggregateExpression extends BaseExpression {
  expressionType: expressionTypes.AGGREGATE;
  aggregator: 'avg' | 'count' | 'group_concat' | 'max' | 'min' | 'sample' | 'sum';
  distinct: boolean;
  expression: Expression;
}

export interface GroupConcatExpression extends AggregateExpression {
  aggregator: 'group_concat';
  separator?: string;
}

export interface ExistenceExpression extends BaseExpression {
  expressionType: expressionTypes.EXISTENCE;
  not: boolean;
  input: Operation;
}

export interface NamedExpression extends BaseExpression {
  expressionType: expressionTypes.NAMED;
  name: rdfjs.NamedNode;
  args: Expression[];
}

export interface OperatorExpression extends BaseExpression {
  expressionType: expressionTypes.OPERATOR;
  operator: string;
  args: Expression[];
}

export interface TermExpression extends BaseExpression {
  expressionType: expressionTypes.TERM;
  term: rdfjs.Term;
}

export interface WildcardExpression extends BaseExpression {
  expressionType: expressionTypes.WILDCARD;
  wildcard: {
    type: 'wildcard';
  };
}

// TODO: currently not differentiating between lists and multisets

// ----------------------- ACTUAL FUNCTIONS -----------------------

export interface Alt extends Multi {
  type: Types.ALT;
  input: PropertyPathSymbol[];
}

export interface Ask extends Single {
  type: Types.ASK;
}

// Also an expression
export interface BoundAggregate extends AggregateExpression {
  variable: rdfjs.Variable;
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
  terms: (rdfjs.Variable | rdfjs.NamedNode)[];
}

export interface Distinct extends Single {
  type: Types.DISTINCT;
}

export interface Extend extends Single {
  type: Types.EXTEND;
  variable: rdfjs.Variable;
  expression: Expression;
}

export interface From extends Single {
  type: Types.FROM;
  default: rdfjs.NamedNode[];
  named: rdfjs.NamedNode[];
}

export interface Filter extends Single {
  type: Types.FILTER;
  expression: Expression;
}

export interface Graph extends Single {
  type: Types.GRAPH;
  name: rdfjs.Variable | rdfjs.NamedNode;
}

export interface Group extends Single {
  type: Types.GROUP;
  variables: rdfjs.Variable[];
  aggregates: BoundAggregate[];
}

export interface Inv extends BaseOperation {
  type: Types.INV;
  path: PropertyPathSymbol;
}

export interface Join extends Multi {
  type: Types.JOIN;
}

export interface LeftJoin extends Double {
  type: Types.LEFT_JOIN;
  expression?: Expression;
}

export interface Link extends BaseOperation {
  type: Types.LINK;
  iri: rdfjs.NamedNode;
}

export interface Minus extends Double {
  type: Types.MINUS;
}

export interface Nop extends BaseOperation {
  type: Types.NOP;
}

export interface Nps extends BaseOperation {
  type: Types.NPS;
  iris: rdfjs.NamedNode[];
}

export interface OneOrMorePath extends BaseOperation {
  type: Types.ONE_OR_MORE_PATH;
  path: PropertyPathSymbol;
}

export interface OrderBy extends Single {
  type: Types.ORDER_BY;
  expressions: Expression[];
}

export interface Path extends BaseOperation {
  type: Types.PATH;
  subject: rdfjs.Term;
  predicate: PropertyPathSymbol;
  object: rdfjs.Term;
  graph: rdfjs.Term;
}

/**
 * Simple BGP entry (triple)
 */
export interface Pattern extends BaseOperation, rdfjs.BaseQuad {
  type: Types.PATTERN;
}

export interface Project extends Single {
  type: Types.PROJECT;
  variables: rdfjs.Variable[];
}

export interface Reduced extends Single {
  type: Types.REDUCED;
}

export interface Seq extends Multi {
  type: Types.SEQ;
  input: PropertyPathSymbol[];
}

export interface Service extends Single {
  type: Types.SERVICE;
  name: rdfjs.Variable | rdfjs.NamedNode;
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

export interface Values extends BaseOperation {
  type: Types.VALUES;
  variables: rdfjs.Variable[];
  bindings: Record<string, rdfjs.Literal | rdfjs.NamedNode>[];
}

export interface ZeroOrMorePath extends BaseOperation {
  type: Types.ZERO_OR_MORE_PATH;
  path: PropertyPathSymbol;
}

export interface ZeroOrOnePath extends BaseOperation {
  type: Types.ZERO_OR_ONE_PATH;
  path: PropertyPathSymbol;
}

// ----------------------- UPDATE FUNCTIONS -----------------------
export interface CompositeUpdate extends BaseOperation {
  type: Types.COMPOSITE_UPDATE;
  updates: Update[];
}

export interface DeleteInsert extends BaseOperation {
  type: Types.DELETE_INSERT;
  delete?: Pattern[];
  insert?: Pattern[];
  where?: Operation;
}

export interface UpdateGraph extends BaseOperation {
  silent?: boolean;
}

export interface Load extends UpdateGraph {
  type: Types.LOAD;
  source: rdfjs.NamedNode;
  destination?: rdfjs.NamedNode;
}

export interface Clear extends UpdateGraph {
  type: Types.CLEAR;
  source: 'DEFAULT' | 'NAMED' | 'ALL' | rdfjs.NamedNode;
}

export interface Create extends UpdateGraph {
  type: Types.CREATE;
  source: rdfjs.NamedNode;
}

export interface Drop extends UpdateGraph {
  type: Types.DROP;
  source: 'DEFAULT' | 'NAMED' | 'ALL' | rdfjs.NamedNode;
}

export interface UpdateGraphShortcut extends UpdateGraph {
  source: 'DEFAULT' | rdfjs.NamedNode;
  destination: 'DEFAULT' | rdfjs.NamedNode;
}

export interface Add extends UpdateGraphShortcut {
  type: Types.ADD;
}

export interface Move extends UpdateGraphShortcut {
  type: Types.MOVE;
}

export interface Copy extends UpdateGraphShortcut {
  type: Types.COPY;
}
