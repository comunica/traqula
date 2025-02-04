import type * as RDF from '@rdfjs/types';
import type { ParserRule, GeneratorRule } from '@traqula/core';
import type { BlankNode, DataFactory } from 'rdf-data-factory';
import type { CommonIRIs } from './grammar-helpers/utils';
import type { Wildcard } from './Wildcard';

export type GraphTerm = IriTerm | BlankTerm | LiteralTerm;
export type Term = GraphTerm | VariableTerm;
export type VerbA = IriTerm<CommonIRIs.TYPE>;

export type Triple = {
  subject: Term;
  predicate: IriTerm | VariableTerm | PropertyPath;
  object: Term;
};

export interface IGraphNode {
  node: ITriplesNode['node'] | Term;
  triples: Triple[];
}

export interface ITriplesNode {
  node: IriTerm | BlankNode;
  triples: Triple[];
}

export type Pattern =
  | BgpPattern
  | BlockPattern
  | FilterPattern
  | BindPattern
  | ValuesPattern
  | Omit<SelectQuery, 'prefixes'>;

export type Expression =
  | OperationExpression
  | FunctionCallExpression
  | AggregateExpression
  // Used in `IN` operator
  | Expression[]
  | IriTerm
  | VariableTerm
  | LiteralTerm;

export interface FunctionCallExpression extends BaseExpression {
  type: 'functionCall';
  function: IriTerm;
  args: Expression[];
}

/**
 * Basic Graph Pattern
 */
export interface BgpPattern {
  type: 'bgp';
  triples: Triple[];
}

export interface GraphQuads {
  type: 'graph';
  name: IriTerm | VariableTerm;
  triples: Triple[];
}

export type VariableTerm = RDF.Variable;
export type IriTerm<IRI extends string = string> = RDF.NamedNode<IRI>;
export type LiteralTerm = RDF.Literal;
export type BlankTerm = RDF.BlankNode;

export type PropertyPath = NegatedPropertySet | {
  type: 'path';
  pathType: '|' | '/' | '^' | '+' | '*' | '?';
  items: (IriTerm | PropertyPath)[];
};

export type SparqlQuery = Query | Update | Pick<Update, 'base' | 'prefixes'>;

export type Query = SelectQuery | ConstructQuery | AskQuery | DescribeQuery;

export interface SelectQuery extends BaseQuery {
  queryType: 'SELECT';
  variables: Variable[] | [Wildcard];
  distinct?: true | undefined;
  reduced?: true | undefined;
}

export interface Grouping {
  expression: Expression;
  variable?: VariableTerm;
}

export interface Ordering {
  expression: Expression;
  descending?: true | undefined;
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

export type InsertDeleteOperation = InsertOperation | DeleteOperation | ModifyOperation | DeleteWhereOperation;
export interface InsertOperation {
  updateType: 'insert';
  insert: Quads[];
}
export interface DeleteOperation {
  updateType: 'delete';
  delete: Quads[];
}
export interface ModifyOperation {
  updateType: 'insertdelete';
  insert: Quads[];
  delete: Quads[];
  graph?: IriTerm;
  using?: {
    default: IriTerm[];
    named: IriTerm[];
  };
  where: Pattern[];
}
export interface DeleteWhereOperation {
  updateType: 'deletewhere';
  delete: Quads[];
}

export type Quads = BgpPattern | GraphQuads;

export type ManagementOperation =
  | CopyMoveAddOperation
  | LoadOperation
  | CreateOperation
  | ClearDropOperation;

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
  destination?: IriTerm;
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
  type?: 'graph';
  name?: IriTerm | undefined;
  default?: true | undefined;
}

export interface GraphReference extends GraphOrDefault {
  named?: true | undefined;
  all?: true | undefined;
}

/**
 * Examples: '?var', '*',
 *   SELECT (?a as ?b) ... ==> { expression: '?a', variable: '?b' }
 */
export type Variable = VariableExpression | VariableTerm;

export interface VariableExpression {
  expression: Expression;
  variable: VariableTerm;
}

export interface BaseQuery {
  type: 'query';
  base?: string | undefined;
  prefixes: Record<string, string>;
  from?:
    | {
      default: IriTerm[];
      named: IriTerm[];
    }
    | undefined;
  where?: Pattern[] | undefined;
  values?: ValuePatternRow[] | undefined;
  having?: Expression[] | undefined;
  group?: Grouping[] | undefined;
  order?: Ordering[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export type IriTermOrElt = IriTerm | {
  type: 'path';
  pathType: '^';
  items: [IriTerm];
};

export interface NegatedPropertySet {
  type: 'path';
  pathType: '!';
  items: [IriTermOrElt] | [{
    type: 'path';
    pathType: '|';
    items: (IriTermOrElt)[];
  }];
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

export type ValuePatternRow = Record<string, IriTerm | BlankTerm | LiteralTerm | undefined>;

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

export interface BaseExpression {
  type: string;
  distinct?: boolean | undefined;
}

export interface OperationExpression extends BaseExpression {
  type: 'operation';
  operator: string;
  // Can be a pattern in case of exists and not exists
  args: (Expression)[] | [Pattern];
}

export interface AggregateExpression extends BaseExpression {
  type: 'aggregate';
  expression: Expression | Wildcard;
  aggregation: string;
  separator?: string | undefined;
}

export type SparqlRule<
  /**
   * Name of grammar rule, should be a strict subtype of string like 'myGrammarRule'.
   */
  NameType extends string = string,
  /**
   * Type that will be returned after a correct parse of this rule.
   * This type will be the return type of calling SUBRULE with this grammar rule.
   */
  ReturnType = unknown,
  /**
   * Function arguments that can be given to convey the state of the current parse operation.
   */
  ParamType = undefined,
> = ParserRule<SparqlContext, NameType, ReturnType, ParamType>
  & GeneratorRule<undefined, NameType, ReturnType, ParamType>;

export type SparqlGrammarRule<
  /**
   * Name of grammar rule, should be a strict subtype of string like 'myGrammarRule'.
   */
  NameType extends string = string,
  /**
   * Type that will be returned after a correct parse of this rule.
   * This type will be the return type of calling SUBRULE with this grammar rule.
   */
  ReturnType = unknown,
  /**
   * Function arguments that can be given to convey the state of the current parse operation.
   */
  ParamType = undefined,
> = ParserRule<SparqlContext, NameType, ReturnType, ParamType>;

export interface SparqlContext {
  /**
   * Data-factory to be used when constructing rdf primitives.
   */
  dataFactory: DataFactory<RDF.BaseQuad>;
  /**
   * Current scoped prefixes. Used for resolving prefixed names.
   */
  prefixes: Record<string, string>;
  /**
   * The base IRI for the query. Used for resolving relative IRIs.
   */
  baseIRI: string | undefined;
  /**
   * Can be used to disable the validation that used variables in a select clause are in scope.
   */
  skipValidation: boolean;
  /**
   * Set of queryModes. Primarily used for note 8, 14.
   */
  parseMode: Set<'canParseVars' | 'canCreateBlankNodes' | 'inAggregate' | 'canParseAggregate' | string>;
}
