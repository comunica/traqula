import type { Localized, Node } from '@traqula/core';

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
  triples: PatternBgp;
};

// https://www.w3.org/TR/sparql11-query/#rUpdate1
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

// https://www.w3.org/TR/sparql11-query/#rUpdate
export type Update = Node & {
  type: 'update';
  updates: {
    operation?: UpdateOperation;
    context: ContextDefinition[];
  }[];
};

// https://www.w3.org/TR/sparql11-query/#rQueryUnit
export type QueryBase = Node & {
  type: 'query';
  queryType: string;

  context: ContextDefinition[];
  values?: PatternValues;
  solutionModifiers: SolutionModifiers;
  datasets: DatasetClauses;
  where?: PatternGroup;
};
export type QuerySelect = QueryBase & {
  queryType: 'select';
  variables: (TermVariable | PatternBind)[] | [Wildcard];
  distinct?: true;
  reduced?: true;
  where: PatternGroup;
};
export type QueryConstruct = QueryBase & {
  queryType: 'construct';
  template: PatternBgp;
  where: PatternGroup;
};
export type QueryDescribe = QueryBase & {
  queryType: 'describe';
  variables: (TermVariable | TermIri)[] | [Wildcard];
};
export type QueryAsk = QueryBase & {
  queryType: 'ask';
  where: PatternGroup;
};
export type Query =
  | QuerySelect
  | QueryConstruct
  | QueryDescribe
  | QueryAsk;

export type SparqlQuery = Query | Update;

// https://www.w3.org/TR/sparql11-query/#rDatasetClause
export type DatasetClauses = Node & {
  type: 'datasetClauses';
  clauses: { clauseType: 'default' | 'named'; value: TermIri }[];
};

// https://www.w3.org/TR/sparql11-query/#rGraphNode
export type TripleCollectionBase = Node & {
  type: 'tripleCollection';
  triples: TripleNesting[];
  tripleCollectionType: string;
  identifier: Term;
};
/**
 * The subject of the triples does not have a string manifestation.
 */
export type TripleCollectionList = TripleCollectionBase & {
  tripleCollectionType: 'list';
  identifier: TermBlank;
};
/**
 * Bot subject and predicate of the triples do not have a string manifestation.
 */
export type TripleCollectionBlankNodeProperties = TripleCollectionBase & {
  tripleCollectionType: 'blankNodeProperties';
  identifier: TermBlank;
};
export type TripleCollection =
  | TripleCollectionList
  | TripleCollectionBlankNodeProperties;

// https://www.w3.org/TR/sparql11-query/#rGraphNode
export type GraphNode = Term | TripleCollection;

// https://www.w3.org/TR/sparql11-query/#rTriplesBlock
export type TripleNesting = Node & {
  type: 'triple';
  subject: GraphNode;
  predicate: TermIri | TermVariable | Path;
  object: GraphNode;
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
  patterns: PatternGroup[];
};
export type BasicGraphPattern = (TripleNesting | TripleCollection)[];
export type PatternBgp = PatternBase & {
  patternType: 'bgp';
  /**
   * Only the first appearance of a subject and predicate have a string manifestation
   */
  triples: BasicGraphPattern;
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
/**
 * A single list of assignments maps the variable identifier to the value
 */
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
export type SolutionModifierGroupBind = Pick<Node, 'loc'> & {
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
  | (Localized & { descending: boolean; expression: Expression });
export type SolutionModifierOrder = SolutionModifierBase & {
  modifierType: 'order';
  orderDefs: Ordering[];
};
export type SolutionModifierLimitOffset = SolutionModifierBase
  & { modifierType: 'limitOffset'; limit: number | undefined; offset: number | undefined };

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

export type ExpressionBracketted = ExpressionBase & {
  expressionType: 'bracketted';
  expression: Expression;
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
  | ExpressionBracketted
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

type ContextDefinitionBase_ = Node & { type: 'contextDef' };
export type ContextDefinitionPrefix = ContextDefinitionBase_ & {
  contextType: 'prefix';
  key: string;
  value: TermIriFull;
};
export type ContextDefinitionBase = ContextDefinitionBase_ & {
  contextType: 'base';
  value: TermIriFull;
};
export type ContextDefinition = ContextDefinitionPrefix | ContextDefinitionBase;

export type Wildcard = Node & {
  type: 'wildcard';
};

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
