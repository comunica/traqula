import * as rdfjs from '@rdfjs/types';
import { Wildcard } from 'sparqljs';
import { Term } from '@rdfjs/types';

export enum types {
    ALT=                'alt',
    ASK=                'ask',
    BGP=                'bgp',
    CONSTRUCT=          'construct',
    DESCRIBE=           'describe',
    DISTINCT=           'distinct',
    EXPRESSION=         'expression',
    EXTEND=             'extend',
    FILTER=             'filter',
    FROM=               'from',
    GRAPH=              'graph',
    GROUP=              'group',
    INV=                'inv',
    JOIN=               'join',
    LEFT_JOIN=          'leftjoin',
    LINK=               'link',
    MINUS=              'minus',
    NOP=                'nop',
    NPS=                'nps',
    ONE_OR_MORE_PATH=   'OneOrMorePath',
    ORDER_BY=           'orderby',
    PATH=               'path',
    PATTERN=            'pattern',
    PROJECT=            'project',
    REDUCED=            'reduced',
    SEQ=                'seq',
    SERVICE=            'service',
    SLICE=              'slice',
    UNION=              'union',
    VALUES=             'values',
    ZERO_OR_MORE_PATH=  'ZeroOrMorePath',
    ZERO_OR_ONE_PATH=   'ZeroOrOnePath',

    COMPOSITE_UPDATE=   'compositeupdate',
    DELETE_INSERT=      'deleteinsert',
    LOAD=               'load',
    CLEAR=              'clear',
    CREATE=             'create',
    DROP=               'drop',
    ADD=                'add',
    MOVE=               'move',
    COPY=               'copy',
}

export enum expressionTypes {
    AGGREGATE= 'aggregate',
    EXISTENCE= 'existence',
    NAMED=     'named',
    OPERATOR=  'operator',
    TERM=      'term',
    WILDCARD=  'wildcard',
}

// Helper type
type valueOf<T> = T[keyof T];

// ----------------------- OPERATIONS -----------------------
export type Operation =
  Ask | Expression | Bgp | Construct | Describe | Distinct | Extend | From | Filter | Graph | Group | Join | LeftJoin |
  Minus | Nop | OrderBy | Path | Pattern | Project | PropertyPathSymbol | Reduced | Service | Slice | Union | Values |
  Update;

export type Expression = AggregateExpression | GroupConcatExpression | ExistenceExpression | NamedExpression |
  OperatorExpression | TermExpression | WildcardExpression | BoundAggregate;

export type PropertyPathSymbol = Alt | Inv | Link | Nps | OneOrMorePath | Seq | ZeroOrMorePath | ZeroOrOnePath;

export type Update = CompositeUpdate | DeleteInsert | Load | Clear | Create | Drop | Add | Move | Copy;

// Returns the correct type based on the type enum
export type TypedOperation<T extends types> = Extract<Operation, { type: T }>;
export type TypedExpression<T extends expressionTypes> = Extract<Expression, { expressionType: T }>;
// ----------------------- ABSTRACTS -----------------------

export interface BaseOperation
{
    [key:string]: any;
    type: types;
}

export interface Single extends BaseOperation
{
    input: Operation;
}

export interface Multi extends BaseOperation
{
    input: Operation[];
}

export interface Double extends Multi
{
    input: [Operation, Operation];
}

export interface BaseExpression extends BaseOperation
{
    type: types.EXPRESSION;
    expressionType: expressionTypes;
}

export interface AggregateExpression extends BaseExpression
{
    expressionType: expressionTypes.AGGREGATE,
    aggregator: 'avg' | 'count' | 'group_concat' | 'max' | 'min' | 'sample' | 'sum';
    distinct: boolean;
    expression: Expression;
}

export interface GroupConcatExpression extends AggregateExpression
{
    aggregator: 'group_concat';
    separator?: string;
}


export interface ExistenceExpression extends BaseExpression
{
    expressionType: expressionTypes.EXISTENCE;
    not: boolean;
    input: Operation;
}

export interface NamedExpression extends BaseExpression
{
    expressionType: expressionTypes.NAMED;
    name: rdfjs.NamedNode;
    args: Expression[];
}

export interface OperatorExpression extends BaseExpression
{
    expressionType: expressionTypes.OPERATOR;
    operator: string;
    args: Expression[];
}

export interface TermExpression extends BaseExpression
{
    expressionType: expressionTypes.TERM;
    term: Term;
}

export interface WildcardExpression extends BaseExpression
{
    expressionType: expressionTypes.WILDCARD,
    wildcard: Wildcard;
}


// TODO: currently not differentiating between lists and multisets

// ----------------------- ACTUAL FUNCTIONS -----------------------


export interface Alt extends Multi
{
    type: types.ALT;
    input: PropertyPathSymbol[];
}

export interface Ask extends Single
{
    type: types.ASK;
}

// also an expression
export interface BoundAggregate extends AggregateExpression
{
    variable: rdfjs.Variable;
}

export interface Bgp extends BaseOperation
{
    type: types.BGP;
    patterns: Pattern[];
}

export interface Construct extends Single
{
    type: types.CONSTRUCT;
    template: Pattern[];
}

export interface Describe extends Single
{
    type: types.DESCRIBE;
    terms: (rdfjs.Variable | rdfjs.NamedNode)[];
}

export interface Distinct extends Single
{
    type: types.DISTINCT;
}

export interface Extend extends Single
{
    type: types.EXTEND;
    variable: rdfjs.Variable;
    expression: Expression;
}

export interface From extends Single
{
    type: types.FROM;
    default: rdfjs.NamedNode[];
    named: rdfjs.NamedNode[];
}

export interface Filter extends Single
{
    type: types.FILTER;
    expression: Expression;
}

export interface Graph extends Single
{
    type: types.GRAPH;
    name: rdfjs.Variable | rdfjs.NamedNode;
}

export interface Group extends Single
{
    type: types.GROUP;
    variables: rdfjs.Variable[];
    aggregates: BoundAggregate[];
}

export interface Inv extends BaseOperation
{
    type: types.INV;
    path: PropertyPathSymbol;
}

export interface Join extends Multi
{
    type: types.JOIN
}

export interface LeftJoin extends Double
{
    type: types.LEFT_JOIN;
    expression?: Expression;
}

export interface Link extends BaseOperation
{
    type: types.LINK;
    iri: rdfjs.NamedNode;
}

export interface Minus extends Double
{
    type: types.MINUS;
}

export interface Nop extends BaseOperation
{
    type: types.NOP;
}

export interface Nps extends BaseOperation
{
    type: types.NPS;
    iris: rdfjs.NamedNode[];
}

export interface OneOrMorePath extends BaseOperation
{
    type: types.ONE_OR_MORE_PATH;
    path: PropertyPathSymbol;
}

export interface OrderBy extends Single
{
    type: types.ORDER_BY;
    expressions: Expression[];
}

export interface Path extends BaseOperation
{
    type: types.PATH;
    subject: rdfjs.Term;
    predicate: PropertyPathSymbol;
    object: rdfjs.Term;
    graph: rdfjs.Term;
}

export interface Pattern extends BaseOperation, rdfjs.BaseQuad
{
    type: types.PATTERN;
}

export interface Project extends Single
{
    type: types.PROJECT;
    variables: rdfjs.Variable[];
}

export interface Reduced extends Single
{
    type: types.REDUCED;
}

export interface Seq extends Multi
{
    type: types.SEQ;
    input: PropertyPathSymbol[];
}

export interface Service extends Single
{
    type: types.SERVICE;
    name: rdfjs.Variable | rdfjs.NamedNode;
    silent: boolean;
}

export interface Slice extends Single
{
    type: types.SLICE;
    start: number;
    length?: number;
}

export interface Union extends Multi
{
    type: types.UNION;
}

export interface Values extends BaseOperation
{
    type: types.VALUES;
    variables: rdfjs.Variable[];
    bindings: {[key: string]: rdfjs.Literal | rdfjs.NamedNode}[];
}

export interface ZeroOrMorePath extends BaseOperation
{
    type: types.ZERO_OR_MORE_PATH;
    path: PropertyPathSymbol;
}

export interface ZeroOrOnePath extends BaseOperation
{
    type: types.ZERO_OR_ONE_PATH;
    path: PropertyPathSymbol;
}

// ----------------------- UPDATE FUNCTIONS -----------------------
export interface CompositeUpdate extends BaseOperation {
    type: types.COMPOSITE_UPDATE;
    updates: Update[];
}

export interface DeleteInsert extends BaseOperation
{
    type: types.DELETE_INSERT;
    delete?: Pattern[];
    insert?: Pattern[];
    where?: Operation;
}

export interface UpdateGraph extends BaseOperation
{
    silent?: boolean;
}

export interface Load extends UpdateGraph
{
    type: types.LOAD;
    source: rdfjs.NamedNode;
    destination?: rdfjs.NamedNode;
}

export interface Clear extends UpdateGraph
{
    type: types.CLEAR;
    source: 'DEFAULT' | 'NAMED' | 'ALL' | rdfjs.NamedNode;
}

export interface Create extends UpdateGraph
{
    type: types.CREATE;
    source: rdfjs.NamedNode;
}

export interface Drop extends UpdateGraph
{
    type: types.DROP;
    source: 'DEFAULT' | 'NAMED' | 'ALL' | rdfjs.NamedNode;
}

export interface UpdateGraphShortcut extends UpdateGraph
{
    source: 'DEFAULT' | rdfjs.NamedNode;
    destination: 'DEFAULT' | rdfjs.NamedNode;
}

export interface Add extends UpdateGraphShortcut
{
    type: types.ADD;
}

export interface Move extends UpdateGraphShortcut
{
    type: types.MOVE;
}

export interface Copy extends UpdateGraphShortcut
{
    type: types.COPY;
}
