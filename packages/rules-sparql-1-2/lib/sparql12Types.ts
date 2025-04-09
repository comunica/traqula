import type * as RDF from '@rdfjs/types';
import type { Patch } from '@traqula/core';
import type * as T11 from '@traqula/rules-sparql-1-1';

export type BaseQuadTerm = RDF.BaseQuad & { subject: Term; predicate: Term; object: Term };
export type GraphTerm = IriTerm | BlankTerm | LiteralTerm | BaseQuadTerm;
export type Term = GraphTerm | VariableTerm;

export type Expression = T11.Expression | BaseQuadTerm;

// Overriding other types
export type Triple = Patch<T11.Triple, { subject: Term; object: Term }>;

export type IGraphNode = Patch<T11.IGraphNode, { triples: Triple[]; node: ITriplesNode['node'] | Term }>;

export type ITriplesNode = Patch<T11.ITriplesNode, { triples: Triple[] }>;

/**
 * Overrides {@link T11.Pattern}
 */
export type Pattern =
  | BgpPattern
  | BlockPattern
  | FilterPattern
  | BindPattern
  | ValuesPattern
  | Omit<SelectQuery, 'prefixes'>;

export type FunctionCallExpression = Patch<T11.FunctionCallExpression, { args: Expression[] }>;

export type BgpPattern = Patch<T11.BgpPattern, { triples: Triple[] }>;

export type GraphQuads = Patch<T11.GraphQuads, { triples: Triple[] }>;

export type VariableTerm = T11.VariableTerm;
export type IriTerm<IRI extends string = string> = T11.IriTerm<IRI>;
export type LiteralTerm = T11.LiteralTerm;
export type BlankTerm = T11.BlankTerm;

export type PropertyPath = NegatedPropertySet | {
  type: 'path';
  pathType: '|' | '/' | '^' | '+' | '*' | '?';
  items: (IriTerm | PropertyPath)[];
};

/**
 * Overrides {@link T11.SparqlQuery}
 */
export type SparqlQuery = Query | Update | Pick<Update, 'base' | 'prefixes'>;

/**
 * Overrides {@link T11.Query}
 */
export type Query = SelectQuery | ConstructQuery | AskQuery | DescribeQuery;

export type SelectQuery = Patch<T11.SelectQuery, BaseQuery>;

export type Grouping = Patch<T11.Grouping, { expression: Expression }>;

export type Ordering = Patch<T11.Ordering, { expression: Expression }>;

export type ConstructQuery = Patch<T11.ConstructQuery, BaseQuery & { template?: Triple[] | undefined }>;

export type AskQuery = Patch<T11.AskQuery, BaseQuery>;

export type DescribeQuery = Patch<T11.DescribeQuery, BaseQuery>;

export type Update = Patch<T11.Update, { updates: UpdateOperation }>;

/**
 * Overrides {@link T11.UpdateOperation}
 */
export type UpdateOperation = InsertDeleteOperation | ManagementOperation;

/**
 * Overrides {@link T11.InsertDeleteOperation}
 */
export type InsertDeleteOperation = InsertOperation | DeleteOperation | ModifyOperation | DeleteWhereOperation;

export type InsertOperation = Patch<T11.InsertOperation, { insert: Quads[] }>;

export type DeleteOperation = Patch<T11.DeleteOperation, { delete: Quads[] }>;

export type ModifyOperation = Patch<T11.ModifyOperation, {
  insert: Quads[];
  delete: Quads[];
  where: Pattern[];
}>;

export type DeleteWhereOperation = Patch<T11.DeleteWhereOperation, { delete: Quads[] }>;

/**
 * Overrides {@link T11.Quads}
 */
export type Quads = BgpPattern | GraphQuads;

/**
 * Overrides {@link T11.ManagementOperation}
 */
export type ManagementOperation =
  | CopyMoveAddOperation
  | LoadOperation
  | CreateOperation
  | ClearDropOperation;

export type CopyMoveAddOperation = T11.CopyMoveAddOperation;
export type LoadOperation = T11.LoadOperation;
export type CreateOperation = T11.CreateOperation;
export type ClearDropOperation = T11.ClearDropOperation;
export type GraphOrDefault = T11.GraphOrDefault;
export type GraphReference = T11.GraphReference;
export type Variable = T11.Variable;

export type VariableExpression = Patch<T11.VariableExpression, { expression: Expression }>;

export type BaseQuery = Patch<T11.BaseQuery, {
  where?: Pattern[] | undefined;
  values?: ValuePatternRow[] | undefined;
  having?: Expression[] | undefined;
  group?: Grouping[] | undefined;
  order: Ordering[] | undefined;
}>;

export type IriTermOrElt = T11.IriTermOrElt;
export type NegatedPropertySet = T11.NegatedPropertySet;

export type GroupPattern = Patch<T11.GroupPattern, { patterns: Pattern[] }>;
export type GraphPattern = Patch<T11.GraphPattern, { patterns: Pattern[] }>;
export type MinusPattern = Patch<T11.MinusPattern, { patterns: Pattern[] }>;
export type ServicePattern = Patch<T11.ServicePattern, { patterns: Pattern[] }>;

/**
 * Overrides {@link T11.BlockPattern}
 */
export type BlockPattern =
  | OptionalPattern
  | UnionPattern
  | GroupPattern
  | GraphPattern
  | MinusPattern
  | ServicePattern;

export type OptionalPattern = Patch<T11.OptionalPattern, { patterns: Pattern[] }>;
export type UnionPattern = Patch<T11.UnionPattern, { patterns: Pattern[] }>;

/**
 * Overrides {@link T11.ValuePatternRow}
 */
export type ValuePatternRow = Record<string, IriTerm | BlankTerm | LiteralTerm | BaseQuery | undefined>;

export type FilterPattern = Patch<T11.FilterPattern, { expression: Expression }>;
export type BindPattern = Patch<T11.BindPattern, { expression: Expression }>;
export type ValuesPattern = Patch<T11.ValuesPattern, { values: ValuePatternRow[] }>;
export type BaseExpression = T11.BaseExpression;

export type OperationExpression = Patch<T11.OperationExpression, BaseExpression & {
  args: Expression[] | [Pattern];
}>;
export type AggregateExpression = Patch<T11.AggregateExpression, BaseExpression & {
  expression: Expression | T11.Wildcard;
}>;
