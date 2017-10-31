
import _ = require('lodash');

// TODO: add aggregates?
// TODO: can't find a way to use these values as string types in the interfaces
export const Algebra = Object.freeze({
    AGGREGATE:          'aggregate',
    ALT:                'alt',
    BGP:                'bgp',
    DESC:               'desc',
    DISTINCT:           'distinct',
    EXISTS:             'exists',
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
    REDUCED:            'reduced',
    ROW:                'row',
    SEQ:                'seq',
    SEQUENCE:           'sequence',
    SLICE:              'slice',
    TABLE:              'table',
    TRIPLE:             'triple',
    TO_MULTISET:        'tomultiset',
    UNION:              'union',
    UNIT:               'unit',
    VARS:               'vars',
    VALUES:             'values',
    ZERO_OR_MORE_PATH:  'ZeroOrMorePath',
    ZERO_OR_ONE_PATH:   'ZeroOrOnePath',
});

// ----------------------- ABSTRACTS -----------------------

export interface Operator
{
    type: string;
}

export interface Single extends Operator
{
    input: Operator;
}

export interface Double extends Operator
{
    left: Operator;
    right: Operator;
}

export interface Expression extends Operator
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

export interface Aggregate extends Operator
{
    type: 'aggregate';
    symbol: string;
    expression: Expression|string; // TODO: eh... (needed for vars)
}

export interface BoundAggregate extends Aggregate
{
    variable: string;
}

export interface Bgp extends Operator
{
    type: 'bgp';
    // TODO: update to rdf js instead of own object
    patterns: Triple[];
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
    aggregators: BoundAggregate[];
}

export interface Inv extends Operator
{
    type: 'inv';
    path: Operator;
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

export interface Link extends Operator
{
    type: 'link';
    iri: string;
}

export interface Minus extends Double
{
    type: 'minus';
}

export interface Nps extends Operator
{
    type: 'nps';
    iris: string[];
}

export interface OneOrMorePath extends Operator
{
    type: 'OneOrMorePath';
    path: Operator;
}

export interface OrderBy extends Single
{
    type: 'orderby';
    expressions: Expression[];
}

export interface Path extends Operator
{
    type: 'path';
    path: Operator;
}

export interface Project extends Single
{
    type: 'project';
    variables: String[];
}

export interface Reduced extends Single
{
    type: 'reduced';
    input: Operator;
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

export interface Values extends Operator
{
    type: 'values';
    variables: string[];
    bindings: any[];
}

export interface ZeroOrMorePath extends Operator
{
    type: 'ZeroOrMorePath';
    path: Operator;
}

export interface ZeroOrOnePath extends Operator
{
    type: 'ZeroOrOnePath';
    path: Operator;
}

export interface Triple extends Operator
{
    type: 'triple';
    subject: string;
    predicate: string;
    object: string;
}