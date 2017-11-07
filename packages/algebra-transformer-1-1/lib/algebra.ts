
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
    PROJECT:            'project',
    QUAD_PATH:          'quadpath',
    QUAD_PATTERN:       'quadpattern',
    REDUCED:            'reduced',
    ROW:                'row',
    SEQ:                'seq',
    SEQUENCE:           'sequence',
    SLICE:              'slice',
    TABLE:              'table',
    TRIPLE_PATTERN:     'triplepattern',
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

export interface Expression extends Operation
{
    type: 'expression'
    symbol: string;
    args: (Expression|string)[]; // TODO: could find cleaner solution (string is needed for variables)
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
    expression: Expression|string; // TODO: eh... (needed for vars)
}

export interface BoundAggregate extends Aggregate
{
    variable: string;
}

export interface Bgp extends Operation
{
    type: 'bgp';
    // TODO: update to rdf js instead of own object
    patterns: TriplePattern[];
}

export interface Distinct extends Single
{
    type: 'distinct';
}

export interface Extend extends Single
{
    type: 'extend';
    variable: string;
    expression: Expression;
}

export interface Filter extends Single
{
    type: 'filter';
    expression: Expression;
}

export interface Graph extends Single
{
    type: 'graph';
    graph: string;
}

export interface Group extends Single
{
    type: 'group';
    variables: string[];
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
    expression: Expression;
}

export interface Link extends Operation
{
    type: 'link';
    iri: string;
}

export interface Minus extends Double
{
    type: 'minus';
}

export interface Nps extends Operation
{
    type: 'nps';
    iris: string[];
}

export interface OneOrMorePath extends Operation
{
    type: 'OneOrMorePath';
    path: Operation;
}

export interface OrderBy extends Single
{
    type: 'orderby';
    expressions: Expression[];
}

export interface Path extends Operation
{
    type: 'path';
    subject: string;
    predicate: Operation;
    object: string;
}

export interface Project extends Single
{
    type: 'project';
    variables: String[];
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
    variables: string[];
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

export interface TriplePattern extends Operation
{
    type: 'triplepattern';
    subject: string;
    predicate: string;
    object: string;
}

// Interfaces for quad algebra
export interface QuadPattern extends Operation
{
    type: 'quadpattern';
    subject: string;
    predicate: string;
    object: string;
    graph: string;
}

export interface QuadPath extends Operation
{
    type: 'quadpath';
    subject: string;
    predicate: Operation;
    object: string;
    graph: string;
}