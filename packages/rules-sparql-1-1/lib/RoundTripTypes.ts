import type { Node } from '@traqula/core';
import type { Wildcard } from './Wildcard';

export type GraphRefBase = Node & {
  type: 'graphRef';
  graphRefType: string;
};
export type GraphRefDefault = GraphRefBase & {
  graphRefType: 'default';
};
export type GraphRefNamed = GraphRefBase & {
  graphRefType: 'named';
};
export type GraphRefAll = GraphRefBase & {
  graphRefType: 'all';
};
export type GraphRefSpecific = GraphRefBase & {
  graphRefType: 'specific';
  graph: TermIri;
};
export type GraphRef =
  | GraphRefDefault
  | GraphRefNamed
  | GraphRefAll
  | GraphRefSpecific;

export type Quads = PatternBgp | GraphQuads;

export type GraphQuads = Node & {
  type: 'graph';
  graph: TermIri | TermVariable;
  triples: Triple[];
};

export type UpdateOperationBase = Node & { type: 'updateOperation'; operationType: string };
export type UpdateOperationLoad = UpdateOperationBase & {
  operationType: 'load';
  silent: boolean;
  source: TermIri;
  destination?: GraphRefSpecific;
};
type UpdateOperationClearDropCreateBase = UpdateOperationBase & {
  operationType: 'clear' | 'drop' | 'create';
  silent: boolean;
  destination: GraphRef;
};
export type UpdateOperationClear = UpdateOperationClearDropCreateBase & { operationType: 'clear' };
export type UpdateOperationDrop = UpdateOperationClearDropCreateBase & { operationType: 'drop' };
export type UpdateOperationCreate = UpdateOperationClearDropCreateBase & {
  operationType: 'create';
  destination: GraphRefSpecific;
};
type UpdateOperationAddMoveCopy = UpdateOperationBase & {
  operationType: 'add' | 'move' | 'copy';
  silent: boolean;
  source: GraphRefDefault | GraphRefSpecific;
  destination: GraphRefDefault | GraphRefSpecific;
};
export type UpdateOperationAdd = UpdateOperationAddMoveCopy & { operationType: 'add' };
export type UpdateOperationMove = UpdateOperationAddMoveCopy & { operationType: 'move' };
export type UpdateOperationCopy = UpdateOperationAddMoveCopy & { operationType: 'copy' };

type UpdateOperationInsertDeleteDelWhere = UpdateOperationBase & {
  operationType: 'insertdata' | 'deletedata' | 'deletewhere';
  data: Quads[];
};
export type UpdateOperationInsertData = UpdateOperationInsertDeleteDelWhere & { operationType: 'insertdata' };
export type UpdateOperationDeleteData = UpdateOperationInsertDeleteDelWhere & { operationType: 'deletedata' };
export type UpdateOperationDeleteWhere = UpdateOperationInsertDeleteDelWhere & { operationType: 'deletewhere' };

export type UpdateOperationModify = UpdateOperationBase & {
  operationType: 'modify';
  graph: TermIri | undefined;
  insert: Quads[];
  delete: Quads[];
  from: DatasetClauses;
  where: Pattern[];
};
export type UpdateOperation =
  | UpdateOperationLoad
  | UpdateOperationClear
  | UpdateOperationDrop
  | UpdateOperationCreate
  | UpdateOperationAdd
  | UpdateOperationMove
  | UpdateOperationCopy
  | UpdateOperationInsertData
  | UpdateOperationDeleteData
  | UpdateOperationDeleteWhere
  | UpdateOperationModify;

export type Update = Node & {
  type: 'update';
  updates: {
    operation: UpdateOperation;
    context: ContextDefinition[];
  }[];
};

export type QueryBase = Node & {
  type: 'query';
  context?: ContextDefinition[];
  values?: PatternValues;

  queryType: string;
  solutionModifiers?: SolutionModifiers;
  datasets?: DatasetClauses;
  where?: Pattern[];
};
export type QuerySelect = QueryBase & {
  queryType: 'select';
  variables: (TermVariable | PatternBind)[] | [Wildcard];
  distinct?: true;
  reduced?: true;
};
export type QueryConstruct = QueryBase & {
  queryType: 'construct';
  template: Triple[];
};
export type QueryDescribe = QueryBase & {
  queryType: 'describe';
  variables: (TermVariable | TermIri)[] | [Wildcard];
};
export type QueryAsk = QueryBase & {
  queryType: 'ask';
};

export type Query =
  | QuerySelect
  | QueryConstruct
  | QueryDescribe
  | QueryAsk;

export type DatasetClauses = Node & {
  type: 'datasetClauses';
  default: TermIri[];
  named: TermIri[];
};

export type Triple = Node & {
  type: 'triple';
  subject: Term;
  predicate: TermIri | TermVariable | Path;
  object: Term;
};

export type PatternBase = Node & { type: 'pattern'; patternType: string };
export type PatternFilter = PatternBase & {
  patternType: 'filter';
  expression: Expression;
};
export type PatternMinus = PatternBase & {
  patternType: 'minus';
  patterns: Pattern[];
};

export type PatternGroup = PatternBase & {
  patternType: 'group';
  patterns: Pattern[];
};
export type PatternOptional = PatternBase & {
  patternType: 'optional';
  patterns: Pattern[];
};
export type PatternGraph = PatternBase & {
  patternType: 'graph';
  name: TermIri | TermVariable;
  patterns: Pattern[];
};
export type PatternUnion = PatternBase & {
  patternType: 'union';
  patterns: Pattern[];
};
export type PatternBgp = PatternBase & {
  patternType: 'bgp';
  triples: Triple[];
};
export type PatternBind = PatternBase & {
  patternType: 'bind';
  expression: Expression;
  variable: TermVariable;
};
export type PatternService = PatternBase & {
  patternType: 'service';
  name: TermIri | TermVariable;
  silent: boolean;
  patterns: Pattern[];
};
export type ValuePatternRow = Record<string, TermIri | TermBlank | TermLiteral | undefined>;
export type PatternValues = PatternBase & {
  patternType: 'values';
  values: ValuePatternRow[];
};
export type SubSelect = Omit<QuerySelect, 'context' | 'datasets'>;

export type Pattern =
  | PatternBgp
  | PatternGroup
  | PatternUnion
  | PatternOptional
  | PatternMinus
  | PatternGraph
  | PatternService
  | PatternFilter
  | PatternBind
  | PatternValues
  | SubSelect;

export type SolutionModifiers = {
  group?: SolutionModifierGroup;
  having?: SolutionModifierHaving;
  order?: SolutionModifierOrder;
  limitOffset?: SolutionModifierLimitOffset;
};
export type SolutionModifierBase = Node & { type: 'solutionModifier'; modifierType: string };
export type SolutionModifierGroupBind = {
  variable: TermVariable;
  value: Expression;
};
export type SolutionModifierGroup = SolutionModifierBase & {
  modifierType: 'group';
  groupings: (Expression | SolutionModifierGroupBind)[];
};
export type SolutionModifierHaving = SolutionModifierBase & {
  modifierType: 'having';
  having: Expression[];
};
export type Ordering =
  | Expression
  | ({ descending: boolean; expression: Expression });
export type SolutionModifierOrder = SolutionModifierBase & {
  modifierType: 'order';
  orderDefs: Ordering[];
};
export type SolutionModifierLimitOffset = SolutionModifierBase
  & { modifierType: 'limitOffset' }
  & ({ limit: number; offset: number | undefined } | { limit: number | undefined; offset: number });

export type ExpressionBase = Node & { type: 'expression' };

type ExpressionAggregateBase = ExpressionBase & {
  expressionType: 'aggregate';
  distinct: boolean;
};
export type ExpressionAggregateDefault = ExpressionAggregateBase & {
  expression: [Expression];
  aggregation: string;
};
export type ExpressionAggregateOnWildcard = ExpressionAggregateBase & {
  expression: [Wildcard];
  aggregation: string;
};
export type ExpressionAggregateSeparator = ExpressionAggregateBase & {
  expression: [Expression];
  aggregation: string;
  separator: string;
};
export type ExpressionAggregate =
  | ExpressionAggregateDefault
  | ExpressionAggregateOnWildcard
  | ExpressionAggregateSeparator;

export type ExpressionOperation = ExpressionBase & {
  expressionType: 'operation';
  operator: string;
  args: Expression[];
};

export type ExpressionPatternOperation = ExpressionBase & {
  expressionType: 'patternOperation';
  operator: string;
  // Can be a pattern in case of exists and not exists
  args: Pattern[];
};

export type ExpressionFunctionCall = ExpressionBase & {
  expressionType: 'functionCall';
  function: TermIri;
  distinct: boolean;
  args: Expression[];
};

export type Expression =
  | ExpressionOperation
  | ExpressionPatternOperation
  | ExpressionFunctionCall
  | ExpressionAggregate
  | TermIri
  | TermVariable
  | TermLiteral;

type PropertyPathBase = Node & { type: 'path' };
export type PropertyPathChain = PropertyPathBase & {
  pathType: '|' | '/';
  items: [Path, ...Path[]];
};

export type PathModified = PropertyPathBase & {
  pathType: '?' | '*' | '+' | '^';
  items: [Path];
};

export type PathNegatedElt = PropertyPathBase & {
  pathType: '^';
  items: [TermIri];
};

export type PathAlternativeLimited = PropertyPathBase & {
  pathType: '|';
  items: [TermIri | PathNegatedElt, ...(TermIri | PathNegatedElt)[]];
};

export type PathNegated = PropertyPathBase & {
  pathType: '!';
  items: [TermIri | PathNegatedElt | PathAlternativeLimited];
};

// [[88]](https://www.w3.org/TR/sparql11-query/#rPath)
export type Path =
  | TermIri
  | PropertyPathChain
  | PathModified
  | PathNegated;

type ContextDefinitionBase = Node & { type: 'contextDef' };
export type ContextDefinitionPrefixDecl = ContextDefinitionBase & {
  contextType: 'prefix';
  key: string;
  value: TermIriFull;
};
export type ContextDefinitionBaseDecl = ContextDefinitionBase & {
  contextType: 'base';
  value: TermIriFull;
};
export type ContextDefinition = ContextDefinitionPrefixDecl | ContextDefinitionBaseDecl;

type TermBase = Node & { type: 'term' };
type TermLiteralBase = TermBase & {
  termType: 'Literal';
  value: string;
};
export type TermLiteralStr = TermLiteralBase & { langOrIri: undefined };
export type TermLiteralLangStr = TermLiteralBase & { langOrIri: string };
export type TermLiteralTyped = TermLiteralBase & { langOrIri: TermIri };
export type TermLiteral = TermLiteralStr | TermLiteralLangStr | TermLiteralTyped;

export type TermVariable = TermBase & {
  termType: 'Variable';
  value: string;
};

type TermIriBase = TermBase & { termType: 'NamedNode' };
export type TermIriFull = TermIriBase & { value: string };
export type TermIriPrefixed = TermIriBase & {
  value: string;
  prefix: string;
};
export type TermIri = TermIriFull | TermIriPrefixed;

export type TermBlank = TermBase & { termType: 'BlankNode' } & { label: string };

export type GraphTerm = TermIri | TermBlank | TermLiteral;
export type Term = GraphTerm | TermVariable;
