
import * as rdfjs from "rdf-js";

// TODO: add aggregates?
// TODO: can't find a way to use these values as string types in the interfaces
export const types = Object.freeze({
    AGGREGATE:          'aggregate',
    ALT:                'alt',
    BGP:                'bgp',
    DESC:               'desc',
    DISTINCT:           'distinct',
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
    TO_MULTISET:        'tomultiset',
    UNION:              'union',
    UNIT:               'unit',
    VARS:               'vars',
    VALUES:             'values',
    ZERO_OR_MORE_PATH:  'ZeroOrMorePath',
    ZERO_OR_ONE_PATH:   'ZeroOrOnePath',
});

export const expressionTypes = Object.freeze({
    EXISTENCE: 'existence',
    NAMED:     'named',
    OPERATOR:  'operator',
    TERM:      'term',
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
    type: 'expression';
    expressionType: 'existence'|'named'|'operator'|'term';
}

export interface ExistenceExpression extends Expression
{
    expressionType: 'existence';
    not: boolean;
    input: Operation;
}

export interface NamedExpression extends Expression
{
    expressionType: 'named';
    name: rdfjs.NamedNode;
    args: Expression[];
}

export interface OperatorExpression extends Expression
{
    expressionType: 'operator';
    operator: string;
    args: Expression[];
}

export interface TermExpression extends Expression
{
    expressionType: 'term';
    term: rdfjs.Term;
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
    aggregate: string;
    separator?: string; // used by GROUP_CONCAT
    expression: Expression;
}

export interface BoundAggregate extends Aggregate
{
    variable: rdfjs.Variable;
}

export interface Bgp extends Operation
{
    type: 'bgp';
    patterns: rdfjs.Term[];
}

export interface Distinct extends Single
{
    type: 'distinct';
}

export interface Extend extends Single
{
    type: 'extend';
    variable: rdfjs.Variable;
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
    graph: rdfjs.Term;
}

export interface Group extends Single
{
    type: 'group';
    expressions: Expression[]; // TODO: this one might need to change
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
    expressions: Expression[];
}

export interface Path extends Operation
{
    type: 'path';
    subject: rdfjs.Term;
    predicate: Operation;
    object: rdfjs.Term;
    graph?: rdfjs.Term;
}

export interface Project extends Single
{
    type: 'project';
    variables: rdfjs.Variable[];
}

export interface Reduced extends Single
{
    type: 'reduced';
}

export interface Seq extends Double
{
    type: 'seq'
}

export interface Slice extends Single
{
    type: 'slice';
    start: number;
    length?: number;
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
