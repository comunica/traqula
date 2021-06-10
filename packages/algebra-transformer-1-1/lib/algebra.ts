
import * as rdfjs from "rdf-js";
import {Wildcard} from "./wildcard";
import {Term} from "rdf-js";

// TODO: add aggregates?
export const types = {
    ALT:                'alt',
    ASK:                'ask',
    BGP:                'bgp',
    CONSTRUCT:          'construct',
    DESC:               'desc',
    DESCRIBE:           'describe',
    DISTINCT:           'distinct',
    EXPRESSION:         'expression',
    EXTEND:             'extend',
    FILTER:             'filter',
    FROM:               'from',
    GRAPH:              'graph',
    GROUP:              'group',
    INV:                'inv',
    JOIN:               'join',
    LEFT_JOIN:          'leftjoin',
    LINK:               'link',
    MINUS:              'minus',
    NOP:                'nop',
    NPS:                'nps',
    ONE_OR_MORE_PATH:   'OneOrMorePath',
    ORDER_BY:           'orderby',
    PATH:               'path',
    PATTERN:            'pattern',
    PROJECT:            'project',
    REDUCED:            'reduced',
    SEQ:                'seq',
    SERVICE:            'service',
    SLICE:              'slice',
    UNION:              'union',
    VALUES:             'values',
    ZERO_OR_MORE_PATH:  'ZeroOrMorePath',
    ZERO_OR_ONE_PATH:   'ZeroOrOnePath',

    COMPOSITE_UPDATE:   'compositeupdate',
    DELETE_INSERT:      'deleteinsert',
    LOAD:               'load',
    CLEAR:              'clear',
    CREATE:             'create',
    DROP:               'drop',
    ADD:                'add',
    MOVE:               'move',
    COPY:               'copy',
} as const;

export const expressionTypes = {
    AGGREGATE: 'aggregate',
    EXISTENCE: 'existence',
    NAMED:     'named',
    OPERATOR:  'operator',
    TERM:      'term',
    WILDCARD:  'wildcard',
} as const;

// Helper type
type valueOf<T> = T[keyof T];

// ----------------------- ABSTRACTS -----------------------

export interface Operation
{
    [key:string]: any;
    type: valueOf<typeof types>;
}

export interface Single extends Operation
{
    input: Operation;
}

export interface Double extends Operation
{
    left: Operation;
    right: Operation;
}

export interface PropertyPathSymbol extends Operation
{
}

export interface Expression extends Operation
{
    type: typeof types.EXPRESSION;
    expressionType: valueOf<typeof expressionTypes>;
}

export interface AggregateExpression extends Expression
{
    expressionType: typeof expressionTypes.AGGREGATE,
    aggregator: 'avg' | 'count' | 'group_concat' | 'max' | 'min' | 'sample' | 'sum';
    distinct: boolean;
    expression: Expression;
}

export interface GroupConcatExpression extends AggregateExpression
{
    aggregator: 'group_concat';
    separator?: string;
}


export interface ExistenceExpression extends Expression
{
    expressionType: typeof expressionTypes.EXISTENCE;
    not: boolean;
    input: Operation;
}

export interface NamedExpression extends Expression
{
    expressionType: typeof expressionTypes.NAMED;
    name: rdfjs.NamedNode;
    args: Expression[];
}

export interface OperatorExpression extends Expression
{
    expressionType: typeof expressionTypes.OPERATOR;
    operator: string;
    args: Expression[];
}

export interface TermExpression extends Expression
{
    expressionType: typeof expressionTypes.TERM;
    term: Term;
}

export interface WildcardExpression extends Expression
{
    expressionType: typeof expressionTypes.WILDCARD,
    wildcard: Wildcard;
}


// TODO: currently not differentiating between lists and multisets

// ----------------------- ACTUAL FUNCTIONS -----------------------


export interface Alt extends Double, PropertyPathSymbol
{
    type: typeof types.ALT;
    left: PropertyPathSymbol;
    right: PropertyPathSymbol;
}

export interface Ask extends Single
{
    type: typeof types.ASK;
}

// also an expression
export interface BoundAggregate extends AggregateExpression
{
    variable: rdfjs.Variable;
}

export interface Bgp extends Operation
{
    type: typeof types.BGP;
    patterns: Pattern[];
}

export interface Construct extends Single
{
    type: typeof types.CONSTRUCT;
    template: Pattern[];
}

export interface Describe extends Single
{
    type: typeof types.DESCRIBE;
    terms: rdfjs.Term[];
}

export interface Distinct extends Single
{
    type: typeof types.DISTINCT;
}

export interface Extend extends Single
{
    type: typeof types.EXTEND;
    variable: rdfjs.Variable;
    expression: Expression;
}

export interface From extends Single
{
    type: typeof types.FROM;
    default: rdfjs.Term[];
    named: rdfjs.Term[];
}

export interface Filter extends Single
{
    type: typeof types.FILTER;
    expression: Expression;
}

export interface Graph extends Single
{
    type: typeof types.GRAPH;
    name: rdfjs.Term;
}

export interface Group extends Single
{
    type: typeof types.GROUP;
    variables: rdfjs.Variable[];
    aggregates: BoundAggregate[];
}

export interface Inv extends Operation, PropertyPathSymbol
{
    type: typeof types.INV;
    path: PropertyPathSymbol;
}

export interface Join extends Double
{
    type: typeof types.JOIN
}

export interface LeftJoin extends Double
{
    type: typeof types.LEFT_JOIN;
    expression?: Expression;
}

export interface Link extends Operation, PropertyPathSymbol
{
    type: typeof types.LINK;
    iri: rdfjs.NamedNode;
}

export interface Minus extends Double
{
    type: typeof types.MINUS;
}

export interface Nop extends Operation
{
    type: typeof types.NOP;
}

export interface Nps extends Operation, PropertyPathSymbol
{
    type: typeof types.NPS;
    iris: rdfjs.NamedNode[];
}

export interface OneOrMorePath extends Operation, PropertyPathSymbol
{
    type: typeof types.ONE_OR_MORE_PATH;
    path: PropertyPathSymbol;
}

export interface OrderBy extends Single
{
    type: typeof types.ORDER_BY;
    expressions: Expression[];
}

export interface Path extends Operation
{
    type: typeof types.PATH;
    subject: rdfjs.Term;
    predicate: PropertyPathSymbol;
    object: rdfjs.Term;
    graph: rdfjs.Term;
}

export interface Pattern extends Operation, rdfjs.BaseQuad
{
    type: typeof types.PATTERN;
}

export interface Project extends Single
{
    type: typeof types.PROJECT;
    variables: rdfjs.Variable[];
}

export interface Reduced extends Single
{
    type: typeof types.REDUCED;
}

export interface Seq extends Double, PropertyPathSymbol
{
    type: typeof types.SEQ;
    left: PropertyPathSymbol;
    right: PropertyPathSymbol;
}

export interface Service extends Single
{
    type: typeof types.SERVICE;
    name: rdfjs.Term;
    silent: boolean;
}

export interface Slice extends Single
{
    type: typeof types.SLICE;
    start: number;
    length?: number;
}

export interface Union extends Double
{
    type: typeof types.UNION;
}

export interface Values extends Operation
{
    type: typeof types.VALUES;
    variables: rdfjs.Variable[];
    bindings: {[key: string]: rdfjs.Term}[];
}

export interface ZeroOrMorePath extends Operation, PropertyPathSymbol
{
    type: typeof types.ZERO_OR_MORE_PATH;
    path: PropertyPathSymbol;
}

export interface ZeroOrOnePath extends Operation, PropertyPathSymbol
{
    type: typeof types.ZERO_OR_ONE_PATH;
    path: PropertyPathSymbol;
}

// ----------------------- UPDATE FUNCTIONS -----------------------
export interface CompositeUpdate extends Operation {
    type: typeof types.COMPOSITE_UPDATE;
    updates: Update[];
}

export interface Update extends Operation {}

export interface DeleteInsert extends Update
{
    type: typeof types.DELETE_INSERT;
    delete?: Pattern[];
    insert?: Pattern[];
    where?: Operation;
}

export interface UpdateGraph extends Update
{
    silent?: boolean;
}

export interface Load extends UpdateGraph
{
    type: typeof types.LOAD;
    source: rdfjs.NamedNode;
    destination?: rdfjs.NamedNode;
}

export interface Clear extends UpdateGraph
{
    type: typeof types.CLEAR;
    source: 'DEFAULT' | 'NAMED' | 'ALL' | rdfjs.NamedNode;
}

export interface Create extends UpdateGraph
{
    type: typeof types.CREATE;
    source: rdfjs.NamedNode;
}

export interface Drop extends UpdateGraph
{
    type: typeof types.DROP;
    source: 'DEFAULT' | 'NAMED' | 'ALL' | rdfjs.NamedNode;
}

export interface UpdateGraphShortcut extends UpdateGraph
{
    source: 'DEFAULT' | rdfjs.NamedNode;
    destination: 'DEFAULT' | rdfjs.NamedNode;
}

export interface Add extends UpdateGraphShortcut
{
    type: typeof types.ADD;
}

export interface Move extends UpdateGraphShortcut
{
    type: typeof types.MOVE;
}

export interface Copy extends UpdateGraphShortcut
{
    type: typeof types.COPY;
}
