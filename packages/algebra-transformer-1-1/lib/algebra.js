"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: add aggregates?
const Algebra = Object.freeze({
    ALT: 'alt',
    BGP: 'bgp',
    DESC: 'desc',
    DISTINCT: 'distinct',
    EXISTS: 'exists',
    EXTEND: 'extend',
    FILTER: 'filter',
    FN_NOT: 'fn:not',
    GRAPH: 'graph',
    GROUP: 'group',
    INV: 'inv',
    JOIN: 'join',
    LEFT_JOIN: 'leftjoin',
    LINK: 'link',
    MINUS: 'minus',
    NOT_EXISTS: 'notexists',
    NPS: 'nps',
    ONE_OR_MORE_PATH: 'OneOrMorePath',
    ORDER_BY: 'orderby',
    PATH: 'path',
    PROJECT: 'project',
    REDUCED: 'reduced',
    ROW: 'row',
    SEQ: 'seq',
    SEQUENCE: 'sequence',
    SLICE: 'slice',
    TABLE: 'table',
    TRIPLE: 'triple',
    TO_MULTISET: 'tomultiset',
    UNION: 'union',
    UNIT: 'unit',
    VARS: 'vars',
    VALUES: 'values',
    ZERO_OR_MORE_PATH: 'ZeroOrMorePath',
    ZERO_OR_ONE_PATH: 'ZeroOrOnePath',
});
// ----------------------- ABSTRACTS -----------------------
class Operator {
    constructor(type) {
        this.type = type;
    }
}
exports.Operator = Operator;
// TODO: currently not differentiating between lists and multisets
// ----------------------- ACTUAL FUNCTIONS -----------------------
class Aggregator extends Operator {
    constructor(symbol, input) {
        super('aggregator');
        this.symbol = symbol;
        this.input = input;
    }
}
exports.Aggregator = Aggregator;
class BoundAggregator extends Aggregator {
    constructor(variable, symbol, input) {
        super(symbol, input);
        this.variable = variable;
    }
}
exports.BoundAggregator = BoundAggregator;
class Bgp extends Operator {
    constructor(patterns) {
        super(Algebra.BGP);
        this.patterns = patterns;
    }
}
exports.Bgp = Bgp;
class Distinct extends Operator {
    constructor(input) {
        super(Algebra.DISTINCT);
        this.input = input;
    }
}
exports.Distinct = Distinct;
class Expression extends Operator {
    constructor(symbol, args) {
        super('expression');
        this.symbol = symbol;
        this.args = args;
    }
}
exports.Expression = Expression;
class Extend extends Operator {
    constructor(input, variable, expression) {
        super(Algebra.EXTEND);
        this.input = input;
        this.variable = variable;
        this.expression = expression;
    }
}
exports.Extend = Extend;
class Filter extends Operator {
    constructor(input, expression) {
        super(Algebra.FILTER);
        this.input = input;
        this.expression = expression;
    }
}
exports.Filter = Filter;
class Graph extends Operator {
    constructor(input, graph) {
        super(Algebra.GRAPH);
        this.input = input;
        this.graph = graph;
    }
}
exports.Graph = Graph;
class Group extends Operator {
    constructor(input, variables, aggregators) {
        super(Algebra.GROUP);
        this.input = input;
        this.variables = variables;
        this.aggregators = aggregators;
    }
}
exports.Group = Group;
class Join extends Operator {
    constructor(left, right) {
        super(Algebra.JOIN);
        this.left = left;
        this.right = right;
    }
}
exports.Join = Join;
class LeftJoin extends Operator {
    constructor(left, right, expression) {
        super(Algebra.LEFT_JOIN);
        this.left = left;
        this.right = right;
        this.expression = expression;
    }
}
exports.LeftJoin = LeftJoin;
class Minus extends Operator {
    constructor(left, right) {
        super(Algebra.MINUS);
        this.left = left;
        this.right = right;
    }
}
exports.Minus = Minus;
class OrderBy extends Operator {
    constructor(input, expressions) {
        super(Algebra.ORDER_BY);
        this.input = input;
        this.expressions = expressions;
    }
}
exports.OrderBy = OrderBy;
class Project extends Operator {
    constructor(input, variables) {
        super(Algebra.PROJECT);
        this.input = input;
        this.variables = variables;
    }
}
exports.Project = Project;
class Reduced extends Operator {
    constructor(input) {
        super(Algebra.REDUCED);
        this.input = input;
    }
}
exports.Reduced = Reduced;
class Slice extends Operator {
    constructor(input, start, length) {
        super(Algebra.SLICE);
        this.input = input;
        this.start = start;
        if (length)
            this.length = length;
        else
            this.length = Infinity;
    }
}
exports.Slice = Slice;
class Union extends Operator {
    constructor(left, right) {
        super(Algebra.UNION);
        this.left = left;
        this.right = right;
    }
}
exports.Union = Union;
class Values extends Operator {
    constructor(variables, bindings) {
        super(Algebra.VALUES);
        this.variables = variables;
        this.bindings = bindings;
    }
}
exports.Values = Values;
class Triple extends Operator {
    constructor(subject, predicate, object) {
        super(Algebra.TRIPLE);
        this.subject = subject;
        this.predicate = predicate;
        this.object = object;
    }
}
exports.Triple = Triple;
//# sourceMappingURL=algebra.js.map