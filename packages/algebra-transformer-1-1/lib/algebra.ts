
import * as rdfjs from "rdf-js";

// TODO: add aggregates?
// TODO: can't find a way to use these values as string types in the interfaces
export const types = Object.freeze({
    AGGREGATE:          'aggregate',
    ALT:                'alt',
    BGP:                'bgp',
    DESC:               'desc',
    DISTINCT:           'distinct',
    EXISTS:             'exists',
    EXPRESSION:         'expression',
    EXTEND:             'extend',
    FILTER:             'filter',
    FN_NOT:             'fn:not',
    GRAPH:              'graph',
    GROUP:              'group',
    INV:                'inv',
    JOIN:               'join',
    LEFT_JOIN:          'leftjoin',
    LINK:               'link',
    MINUS:              'minus',
    NOT_EXISTS:         'notexists',
    NPS:                'nps',
    ONE_OR_MORE_PATH:   'OneOrMorePath',
    ORDER_BY:           'orderby',
    PATH:               'path',
    PATTERN:            'pattern',
    PROJECT:            'project',
    REDUCED:            'reduced',
    ROW:                'row',
    SEQ:                'seq',
    SEQUENCE:           'sequence',
    SLICE:              'slice',
    TABLE:              'table',
    TO_MULTISET:        'tomultiset',
    UNION:              'union',
    UNIT:               'unit',
    VARS:               'vars',
    VALUES:             'values',
    ZERO_OR_MORE_PATH:  'ZeroOrMorePath',
    ZERO_OR_ONE_PATH:   'ZeroOrOnePath',
});

// ----------------------- ABSTRACTS -----------------------

export interface Operation
{
    type: string;
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

export type ExpressionOrTerm = (Expression|rdfjs.Term);

export interface Expression extends Operation
{
    type: 'expression'
    symbol: string;
    args: ExpressionOrTerm[]; // TODO: could find cleaner solution
}


// TODO: currently not differentiating between lists and multisets

// ----------------------- ACTUAL FUNCTIONS -----------------------


export interface Alt extends Double
{
    type: 'alt';
}

export interface Aggregate extends Operation
{
    type: 'aggregate';
    symbol: string;
    separator?: string; // used by GROUP_CONCAT
    expression: ExpressionOrTerm;
}

export interface BoundAggregate extends Aggregate
{
    variable: rdfjs.Variable;
}

export interface Bgp extends Operation
{
    type: 'bgp';
    patterns: Pattern[];
}

export interface Distinct extends Single
{
    type: 'distinct';
}

export interface Extend extends Single
{
    type: 'extend';
    variable: rdfjs.Variable;
    expression: ExpressionOrTerm;
}

export interface Filter extends Single
{
    type: 'filter';
    expression: ExpressionOrTerm;
}

export interface Graph extends Single
{
    type: 'graph';
    graph: rdfjs.Term;
}

export interface Group extends Single
{
    type: 'group';
    expressions: ExpressionOrTerm[]; // TODO: this one might need to change
    aggregates: BoundAggregate[];
}

export interface Inv extends Operation
{
    type: 'inv';
    path: Operation;
}

export interface Join extends Double
{
    type: 'join'
}

export interface LeftJoin extends Double
{
    type: 'leftjoin';
    expression: ExpressionOrTerm;
}

export interface Link extends Operation
{
    type: 'link';
    iri: rdfjs.NamedNode;
}

export interface Minus extends Double
{
    type: 'minus';
}

export interface Nps extends Operation
{
    type: 'nps';
    iris: rdfjs.NamedNode[];
}

export interface OneOrMorePath extends Operation
{
    type: 'OneOrMorePath';
    path: Operation;
}

export interface OrderBy extends Single
{
    type: 'orderby';
    expressions: ExpressionOrTerm[];
}

export interface Path extends Operation
{
    type: 'path';
    subject: rdfjs.Term;
    predicate: Operation;
    object: rdfjs.Term;
    graph?: rdfjs.Term;
}

export interface Pattern extends Operation, rdfjs.Quad
{
    type: 'pattern';
}

export interface Project extends Single
{
    type: 'project';
    variables: rdfjs.Variable[];
}

export interface Reduced extends Single
{
    type: 'reduced';
    input: Operation;
}

export interface Seq extends Double
{
    type: 'seq'
}

export interface Slice extends Single
{
    type: 'slice';
    start: number;
    length: number;
}

export interface Union extends Double
{
    type: 'union';
}

export interface Values extends Operation
{
    type: 'values';
    variables: rdfjs.Variable[];
    bindings: any[];
}

export interface ZeroOrMorePath extends Operation
{
    type: 'ZeroOrMorePath';
    path: Operation;
}

export interface ZeroOrOnePath extends Operation
{
    type: 'ZeroOrOnePath';
    path: Operation;
}
