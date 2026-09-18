/**
 * Structural mirror of the AST types produced by `sparqljs` (https://github.com/RubenVerborgh/SPARQL.js).
 *
 * These are intentionally declared locally instead of depending on the `sparqljs` or `@types/sparqljs`
 * packages: sparqljs is deprecated, this package only needs to describe the *shape* of the objects it
 * receives, and consumers of {@link fromSparqlJs.ts} do not need to install sparqljs' types to use it
 * since a real `sparqljs` parse result is structurally assignable to these types.
 *
 * The shapes below are derived from two MIT-licensed sources:
 *  - SPARQL.js itself (https://github.com/RubenVerborgh/SPARQL.js), Copyright (c) 2014 Ruben Verborgh.
 *    License: https://github.com/RubenVerborgh/SPARQL.js/blob/master/LICENSE.md
 *  - The community `@types/sparqljs` declaration file on DefinitelyTyped, Copyright (c) its contributors
 *    (https://github.com/DefinitelyTyped/DefinitelyTyped/commits/master/types/sparqljs/index.d.ts), mirrored
 *    as of commit 982edf5d9655b7eca3825d113f90ebdbed4aaa39:
 *    https://github.com/DefinitelyTyped/DefinitelyTyped/blob/982edf5d9655b7eca3825d113f90ebdbed4aaa39/types/sparqljs/index.d.ts
 *    License: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/LICENSE
 *
 * Both licenses are reproduced in full below.
 *
 * -----------------------------------------------------------------------------------------------------
 * SPARQL.js license (MIT):
 *
 * The MIT License (MIT)
 * Copyright (c) 2014 Ruben Verborgh
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
 * LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
 * EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
 * THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * -----------------------------------------------------------------------------------------------------
 * DefinitelyTyped license (MIT):
 *
 * This project is licensed under the MIT license.
 * Copyrights are respective of each contributor listed at the beginning of each definition file.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
 * LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
 * EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
 * THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * -----------------------------------------------------------------------------------------------------
 */
import type * as RDF from '@rdfjs/types';

export type Term = VariableTerm | IriTerm | LiteralTerm | BlankTerm | QuadTerm;
export type VariableTerm = RDF.Variable;
export type IriTerm = RDF.NamedNode;
export type LiteralTerm = RDF.Literal;
export type BlankTerm = RDF.BlankNode;
export type QuadTerm = RDF.Quad;

export interface Wildcard {
  readonly termType: 'Wildcard';
  readonly value: '*';
}

export type SparqlQuery = Query | Update;
export type Query = SelectQuery | ConstructQuery | AskQuery | DescribeQuery;

export interface BaseQuery {
  type: 'query';
  base?: string | undefined;
  prefixes: Record<string, string>;
  from?: {
    default: IriTerm[];
    named: IriTerm[];
  } | undefined;
  where?: Pattern[] | undefined;
  values?: ValuePatternRow[] | undefined;
  /**
   * The SPARQL grammar applies SolutionModifier to SELECT, CONSTRUCT, DESCRIBE and ASK alike
   * (see sparqljs' sparql.jison, rules [9]-[13]), so these live on BaseQuery rather than only
   * on SelectQuery even though some community type definitions only declare them there.
   */
  group?: Grouping[] | undefined;
  having?: Expression[] | undefined;
  order?: Ordering[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface SelectQuery extends BaseQuery {
  queryType: 'SELECT';
  variables: Variable[] | [Wildcard];
  distinct?: boolean | undefined;
  reduced?: boolean | undefined;
}

export interface Grouping {
  expression: Expression;
  variable?: VariableTerm;
}

export interface Ordering {
  expression: Expression;
  descending?: boolean | undefined;
}

export interface ConstructQuery extends BaseQuery {
  queryType: 'CONSTRUCT';
  template?: Triple[] | undefined;
}

export interface AskQuery extends BaseQuery {
  queryType: 'ASK';
}

export interface DescribeQuery extends BaseQuery {
  queryType: 'DESCRIBE';
  variables: (VariableTerm | IriTerm)[] | [Wildcard];
}

export interface Update {
  type: 'update';
  base?: string | undefined;
  prefixes: Record<string, string>;
  updates: UpdateOperation[];
}

export type UpdateOperation = InsertDeleteOperation | ManagementOperation;

export type InsertDeleteOperation =
  | { updateType: 'insert'; graph?: GraphOrDefault; insert: Quads[] }
  | { updateType: 'delete'; graph?: GraphOrDefault; delete: Quads[] }
  | {
    updateType: 'insertdelete';
    graph?: IriTerm;
    insert: Quads[];
    delete: Quads[];
    using?: { default: IriTerm[]; named: IriTerm[] };
    where: Pattern[];
  }
  | { updateType: 'deletewhere'; graph?: GraphOrDefault; delete: Quads[] };

export type Quads = BgpPattern | GraphQuads;

export type ManagementOperation = CopyMoveAddOperation | LoadOperation | CreateOperation | ClearDropOperation;

export interface CopyMoveAddOperation {
  type: 'copy' | 'move' | 'add';
  silent: boolean;
  source: GraphOrDefault;
  destination: GraphOrDefault;
}

export interface LoadOperation {
  type: 'load';
  silent: boolean;
  source: IriTerm;
  destination: IriTerm | false;
}

export interface CreateOperation {
  type: 'create';
  silent: boolean;
  graph: GraphOrDefault;
}

export interface ClearDropOperation {
  type: 'clear' | 'drop';
  silent: boolean;
  graph: GraphReference;
}

export interface GraphOrDefault {
  type: 'graph';
  name?: IriTerm | undefined;
  default?: boolean | undefined;
}

export interface GraphReference extends GraphOrDefault {
  named?: boolean | undefined;
  all?: boolean | undefined;
}

/**
 * Examples: '?var', '*', SELECT (?a as ?b) ... ==> { expression: '?a', variable: '?b' }
 */
export type Variable = VariableExpression | VariableTerm;

export interface VariableExpression {
  expression: Expression;
  variable: VariableTerm;
}

export type Pattern =
  | BgpPattern
  | BlockPattern
  | FilterPattern
  | BindPattern
  | ValuesPattern
  | SelectQuery;

export interface BgpPattern {
  type: 'bgp';
  triples: Triple[];
}

export interface GraphQuads {
  type: 'graph';
  name: IriTerm | VariableTerm;
  triples: Triple[];
}

export type BlockPattern =
  | OptionalPattern
  | UnionPattern
  | GroupPattern
  | GraphPattern
  | MinusPattern
  | ServicePattern;

export interface OptionalPattern {
  type: 'optional';
  patterns: Pattern[];
}

export interface UnionPattern {
  type: 'union';
  patterns: Pattern[];
}

export interface GroupPattern {
  type: 'group';
  patterns: Pattern[];
}

export interface GraphPattern {
  type: 'graph';
  name: IriTerm | VariableTerm;
  patterns: Pattern[];
}

export interface MinusPattern {
  type: 'minus';
  patterns: Pattern[];
}

export interface ServicePattern {
  type: 'service';
  name: IriTerm | VariableTerm;
  silent: boolean;
  patterns: Pattern[];
}

export interface FilterPattern {
  type: 'filter';
  expression: Expression;
}

export interface BindPattern {
  type: 'bind';
  expression: Expression;
  variable: VariableTerm;
}

export interface ValuesPattern {
  type: 'values';
  values: ValuePatternRow[];
}

export type ValuePatternRow = Record<string, IriTerm | BlankTerm | LiteralTerm | undefined>;

export interface Triple {
  subject: IriTerm | BlankTerm | VariableTerm | QuadTerm;
  predicate: IriTerm | VariableTerm | PropertyPath;
  object: Term;
}

/**
 * `!` (negated property set) is not a distinct shape at runtime: sparqljs always wraps its single negated
 * element (an IRI, an inverse `^p`, or a `|`-alternative) as the lone entry of `items`, exactly like the
 * other unary path operators - it is not a flattened array of alternatives as some type definitions suggest.
 */
export interface PropertyPath {
  type: 'path';
  pathType: '|' | '/' | '^' | '+' | '*' | '?' | '!';
  items: (IriTerm | PropertyPath)[];
}

export type Expression =
  | OperationExpression
  | FunctionCallExpression
  | AggregateExpression
  | Tuple
  | IriTerm
  | VariableTerm
  | LiteralTerm
  | QuadTerm;

// Allow Expression to circularly reference itself
export interface Tuple extends Array<Expression> {}

export interface BaseExpression {
  type: string;
  distinct?: boolean | undefined;
}

export interface OperationExpression extends BaseExpression {
  type: 'operation';
  operator: string;
  args: (Expression | Pattern)[];
}

export interface FunctionCallExpression extends BaseExpression {
  type: 'functionCall';
  function: IriTerm;
  args: Expression[];
}

export interface AggregateExpression extends BaseExpression {
  type: 'aggregate';
  expression: Expression | Wildcard;
  aggregation: string;
  separator?: string | undefined;
}
