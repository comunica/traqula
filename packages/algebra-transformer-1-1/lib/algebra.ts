
import _ = require('lodash');

// TODO: add aggregates?
const Algebra = Object.freeze({
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

export abstract class Operator
{
    type: string;

    constructor (type: string)
    {
        this.type = type;
    }
}

export interface Single
{
    input: Operator;
}

export interface Double
{
    left: Operator;
    right: Operator;
}

// TODO: currently not differentiating between lists and multisets

// ----------------------- ACTUAL FUNCTIONS -----------------------


export class Aggregator extends Operator implements Single
{
    symbol: string;
    input: Expression; // TODO: this means variables also need to be expressions...

    constructor (symbol: string, input: Expression)
    {
        super('aggregator');
        this.symbol = symbol;
        this.input = input;
    }
}

export class BoundAggregator extends Aggregator
{
    variable: string;

    constructor (variable: string, symbol: string, input: Expression)
    {
        super(symbol, input);
        this.variable = variable;
    }
}

export class Bgp extends Operator
{
    // TODO: update to rdf js instead of own object
    patterns: Triple[];

    constructor (patterns: Triple[])
    {
        super(Algebra.BGP);
        this.patterns = patterns;
    }
}

export class Distinct extends Operator implements Single
{
    input: Operator;

    constructor (input: Operator)
    {
        super(Algebra.DISTINCT);
        this.input = input;
    }
}

export class Expression extends Operator
{
    symbol: string;
    args: Expression[]; // TODO: this means variables also need to be expressions...

    constructor (symbol: string, args: Expression[])
    {
        super('expression');
        this.symbol = symbol;
        this.args = args;
    }
}

export class Extend extends Operator implements Single
{
    input: Operator;
    variable: string;
    expression: Expression;

    constructor (input: Operator, variable: string, expression: Expression)
    {
        super(Algebra.EXTEND);
        this.input = input;
        this.variable = variable;
        this.expression = expression;
    }
}

export class Filter extends Operator implements Single
{
    input: Operator;
    expression: Expression;

    constructor (input: Operator, expression: Expression)
    {
        super(Algebra.FILTER);
        this.input = input;
        this.expression = expression;
    }
}

export class Graph extends Operator implements Single
{
    input: Operator;
    graph: string;

    constructor (input: Operator, graph: string)
    {
        super(Algebra.GRAPH);
        this.input = input;
        this.graph = graph;
    }
}

export class Group extends Operator implements Single
{
    input: Operator;
    variables: string[];
    aggregators: BoundAggregator[];

    constructor (input: Operator, variables: string[], aggregators: BoundAggregator[])
    {
        super(Algebra.GROUP);
        this.input = input;
        this.variables = variables;
        this.aggregators = aggregators;
    }
}

export class Join extends Operator implements Double
{
    left: Operator;
    right: Operator;

    constructor (left: Operator, right: Operator)
    {
        super(Algebra.JOIN);
        this.left = left;
        this.right = right;
    }
}

export class LeftJoin extends Operator implements Double
{
    left: Operator;
    right: Operator;
    expression: Expression;

    constructor (left: Operator, right: Operator, expression?: Expression)
    {
        super(Algebra.LEFT_JOIN);
        this.left = left;
        this.right = right;
        this.expression = expression;
    }
}

export class Minus extends Operator implements Double
{
    left: Operator;
    right: Operator;

    constructor (left: Operator, right: Operator)
    {
        super(Algebra.MINUS);
        this.left = left;
        this.right = right;
    }
}

export class OrderBy extends Operator implements Single
{
    input: Operator;
    expressions: Expression[];

    constructor (input: Operator, expressions: Expression[])
    {
        super(Algebra.ORDER_BY);
        this.input = input;
        this.expressions = expressions;
    }
}

export class Project extends Operator implements Single
{
    input: Operator;
    variables: String[];

    constructor (input: Operator, variables: string[])
    {
        super(Algebra.PROJECT);
        this.input = input;
        this.variables = variables;
    }
}

export class Reduced extends Operator implements Single
{
    input: Operator;

    constructor (input: Operator)
    {
        super(Algebra.REDUCED);
        this.input = input;
    }
}

export class Slice extends Operator implements Single
{
    input: Operator;
    start: number;
    length: number;

    constructor (input: Operator, start: number, length: number)
    {
        super(Algebra.SLICE);
        this.input = input;
        this.start = start;
        if (length)
            this.length = length;
        else
            this.length = Infinity;
    }
}

export class Union extends Operator implements Double
{
    left: Operator;
    right: Operator;

    constructor (left: Operator, right: Operator)
    {
        super(Algebra.UNION);
        this.left = left;
        this.right = right;
    }
}

export class Values extends Operator
{
    variables: string[];
    bindings: any[];

    constructor (variables: string[], bindings: any[])
    {
        super(Algebra.VALUES);
        this.variables = variables;
        this.bindings = bindings;
    }
}

export class Triple extends Operator
{
    subject: string;
    predicate: string;
    object: string;

    constructor (subject: string, predicate: string, object: string)
    {
        super(Algebra.TRIPLE);
        this.subject = subject;
        this.predicate = predicate;
        this.object = object;
    }
}