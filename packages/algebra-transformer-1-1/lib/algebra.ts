
import * as rdfjs from "rdf-js";
import {Wildcard} from "./wildcard";
import {Term} from "rdf-js";

// TODO: add aggregates?
// TODO: can't find a way to use these values as string types in the interfaces
export const types = Object.freeze({
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
});

export const expressionTypes = Object.freeze({
    AGGREGATE: 'aggregate',
    EXISTENCE: 'existence',
    NAMED:     'named',
    OPERATOR:  'operator',
    TERM:      'term',
    WILDCARD:  'wildcard',
});

// ----------------------- ABSTRACTS -----------------------

export interface Operation
{
    [key:string]: any;
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

export interface PropertyPathSymbol extends Operation
{
}

export interface Expression extends Operation
{
    type: 'expression';
    expressionType: 'aggregate'|'existence'|'named'|'operator'|'term'|'wildcard';
}

export interface AggregateExpression extends Expression
{
    expressionType: 'aggregate',
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
    term: Term;
}

export interface WildcardExpression extends Expression
{
    expressionType: 'wildcard',
    wildcard: Wildcard;
}


// TODO: currently not differentiating between lists and multisets

// ----------------------- ACTUAL FUNCTIONS -----------------------


export interface Alt extends Double, PropertyPathSymbol
{
    type: 'alt';
    left: PropertyPathSymbol;
    right: PropertyPathSymbol;
}

export interface Ask extends Single
{
    type: 'ask';
}

// also an expression
export interface BoundAggregate extends AggregateExpression
{
    variable: rdfjs.Variable;
}

export interface Bgp extends Operation
{
    type: 'bgp';
    patterns: Pattern[];
}

export interface Construct extends Single
{
    type: 'construct';
    template: Pattern[];
}

export interface Describe extends Single
{
    type: 'describe';
    terms: rdfjs.Term[];
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

export interface From extends Single
{
    type: 'from';
    default: rdfjs.Term[];
    named: rdfjs.Term[];
}

export interface Filter extends Single
{
    type: 'filter';
    expression: Expression;
}

export interface Graph extends Single
{
    type: 'graph';
    name: rdfjs.Term;
}

export interface Group extends Single
{
    type: 'group';
    variables: rdfjs.Variable[];
    aggregates: BoundAggregate[];
}

export interface Inv extends Operation, PropertyPathSymbol
{
    type: 'inv';
    path: PropertyPathSymbol;
}

export interface Join extends Double
{
    type: 'join'
}

export interface LeftJoin extends Double
{
    type: 'leftjoin';
    expression?: Expression;
}

export interface Link extends Operation, PropertyPathSymbol
{
    type: 'link';
    iri: rdfjs.NamedNode;
}

export interface Minus extends Double
{
    type: 'minus';
}

export interface Nps extends Operation, PropertyPathSymbol
{
    type: 'nps';
    iris: rdfjs.NamedNode[];
}

export interface OneOrMorePath extends Operation, PropertyPathSymbol
{
    type: 'OneOrMorePath';
    path: PropertyPathSymbol;
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
    predicate: PropertyPathSymbol;
    object: rdfjs.Term;
    graph: rdfjs.Term;
}

export interface Pattern extends Operation, rdfjs.BaseQuad
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
}

export interface Seq extends Double, PropertyPathSymbol
{
    type: 'seq'
    left: PropertyPathSymbol;
    right: PropertyPathSymbol;
}

export interface Service extends Single
{
    type: 'service',
    name: rdfjs.Term,
    silent: boolean
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
    bindings: {[key: string]: rdfjs.Term}[];
}

export interface ZeroOrMorePath extends Operation, PropertyPathSymbol
{
    type: 'ZeroOrMorePath';
    path: PropertyPathSymbol;
}

export interface ZeroOrOnePath extends Operation, PropertyPathSymbol
{
    type: 'ZeroOrOnePath';
    path: PropertyPathSymbol;
}
