import type * as r from './TypeHelpersRTT';
import type { Wildcard } from './Wildcard';

export type GraphRefBase = {
  type: 'graphRef';
  graphRefType: string;
};
export type GraphRefDefault = GraphRefBase & r.ReconstructRTT & {
  graphRefType: 'default';
};
export type GraphRefNamed = GraphRefBase & r.ReconstructRTT & {
  graphRefType: 'named';
};
export type GraphRefAll = GraphRefBase & r.ReconstructRTT & {
  graphRefType: 'all';
};
export type GraphRefSpecific = GraphRefBase & r.ReconstructRTT & {
  graphRefType: 'specific';
  graph: TermIri;
};
export type GraphRef =
  | GraphRefDefault
  | GraphRefNamed
  | GraphRefAll
  | GraphRefSpecific;

export type Quads = PatternBgp | GraphQuads;

export type GraphQuads = r.ImageRTT & r.IgnoredRTT & {
  type: 'graph';
  graph: TermIri | TermVariable;
  triples: Triple[];
  RTT: {
    tripleBraces: [r.ITOS, r.ITOS];
    ignored: r.ITOS[];
  };
};

export type UpdateOperationBase = { type: 'updateOperation'; operationType: string };
export type UpdateOperationLoad = UpdateOperationBase & r.ImageRTT3 & r.IgnoredRTT2 & {
  operationType: 'load';
  silent: boolean;
  source: TermIri;
  destination?: GraphRefSpecific;
};
export type UpdateOperationClearDrop = UpdateOperationBase & r.ImageRTT2 & r.IgnoredRTT1 & {
  operationType: 'clear' | 'drop';
  silent: boolean;
  destination: GraphRef;
};
export type UpdateOperationCreate = Omit<UpdateOperationClearDrop, 'operationType' | 'destination'> & {
  operationType: 'create';
  destination: GraphRefSpecific;
};
export type UpdateOperationAddMoveCopy = UpdateOperationBase & r.ImageRTT3 & r.IgnoredRTT2 & {
  operationType: 'add' | 'move' | 'copy';
  silent: boolean;
  source: GraphRefDefault | GraphRefSpecific;
  destination: GraphRefDefault | GraphRefSpecific;
};
export type UpdateOperationInsertDeleteDelWhere = UpdateOperationBase & r.ImageRTT2 & r.IgnoredRTT1 & {
  operationType: 'insertdata' | 'deletedata' | 'deletewhere';
  data: Quads[];
  RTT: {
    dataBraces: [r.ITOS, r.ITOS];
  };
};
/**
 * RTT order: WITH, DELETE, INSERT, USING, WHERE
 */
export type UpdateOperationModify = UpdateOperationBase & r.ImageRTT4 & r.IgnoredRTT3 & {
  operationType: 'modify';
  graph: TermIri | undefined;
  insert: Quads[];
  delete: Quads[];
  from: DatasetClauses;
  where: Pattern[];
  RTT: {
    deleteBraces: [r.ITOS, r.ITOS] | [];
    insertBraces: [r.ITOS, r.ITOS] | [];
    patternBraces: BracketWrapper;
  };
};
export type UpdateOperation =
  | UpdateOperationLoad
  | UpdateOperationClearDrop
  | UpdateOperationCreate
  | UpdateOperationAddMoveCopy
  | UpdateOperationInsertDeleteDelWhere
  | UpdateOperationModify;

export type Update = {
  type: 'update';
  updates: {
    operation: UpdateOperation;
    context: ContextDefinition[];
    i0: r.ITOS;
  }[];
};

export type QueryBase = {
  type: 'query';
  context?: ContextDefinition[];
  values?: PatternValues;

  queryType: string;
  solutionModifiers?: SolutionModifiers;
  datasets?: DatasetClauses;
  where?: Pattern[];
  RTT: {
    where: [r.ITOS, string];
    whereBraces: BracketWrapper;
  };
};
export type QuerySelect = QueryBase & r.ImageRTT2 & r.IgnoredRTT2 & {
  queryType: 'select';
  variables: (TermVariable | PatternBind)[] | [Wildcard];
  distinct?: true;
  reduced?: true;
};
export type QueryConstruct = QueryBase & r.ImageRTT & r.IgnoredRTT & {
  queryType: 'construct';
  template: Triple[];
  RTT: {
    templateIgnored: r.ITOS[];
    templateBraces: [r.ITOS, r.ITOS];
  };
};
export type QueryDescribe = QueryBase & r.ImageRTT & r.IgnoredRTT1 & {
  queryType: 'describe';
  variables: (TermVariable | TermIri)[] | [Wildcard];
};
export type QueryAsk = QueryBase & r.ImageRTT & r.IgnoredRTT & {
  queryType: 'ask';
};

export type Query =
  | QuerySelect
  | QueryConstruct
  | QueryDescribe
  | QueryAsk;

export type DatasetClauses = {
  type: 'datasetClauses';
  default: TermIri[];
  named: TermIri[];
  RTT: {
    namedIndexes: number[];
    completion: r.CTOS[];
  };
};

/**
 * ShareSubjectDef: ; or ,
 * sharePrefixDef: ,
 * i0 should be [] when false, false
 */
export type RTTTripleBase =
  | { shareSubjectDef: false; sharePrefixDef: false }
  | { shareSubjectDef: true; sharePrefixDef: true; i0: r.ITOS }
  // Rather special approach here since the rule allows repetition of ;.
  // As such, a triple ; sequences after, and only the first one will require a normal ITOS.
  // CONTRACT: only first item in chain of ; has i0 !== [].
  | { shareSubjectDef: true; sharePrefixDef: false; i0: r.ITOS; ignoredAfter: r.ITOS[] };
export type RTTTriplePartStartCollection = r.Ignores1 & {
  collectionSize: number;
};
export type RTTTriplePartStartBlankNodeList = r.Ignores1 & {
  blankNodeListSize: number;
};
export type RTTTriplePart = RTTTriplePartStartCollection | RTTTriplePartStartBlankNodeList;

export type Triple = {
  subject: Term & { RTT?: { triplePart?: RTTTriplePart }};
  predicate: TermIri | TermVariable | Path;
  object: Term & { RTT?: { triplePart?: RTTTriplePart }};
  RTT: RTTTripleBase;
};

export type PatternBase = { type: 'pattern'; patternType: string };
export type PatternFilter = r.ImageRTT & r.IgnoredRTT & PatternBase & {
  patternType: 'filter';
  expression: Expression;
};
export type PatternMinus = r.ImageRTT & r.IgnoredRTT2 & PatternBase & {
  patternType: 'minus';
  patterns: Pattern[];
};
export type PatternGroup = r.IgnoredRTT1 & PatternBase & {
  patternType: 'group';
  patterns: Pattern[];
  RTT: {
    dotTracker: [number, r.ITOS][];
  };
};
export type PatternOptional = r.IgnoredRTT & r.ImageRTT & PatternBase & {
  patternType: 'optional';
  patterns: Pattern[];
};
export type PatternGraph = r.IgnoredRTT & r.ImageRTT & PatternBase & {
  patternType: 'graph';
  name: TermIri | TermVariable;
  patterns: Pattern[];
};
export type PatternUnion = PatternBase & {
  patternType: 'union';
  patterns: Pattern[];
  RTT: {
    images: string[];
    ignores: r.ITOS[];
  };
};
export type PatternBgp = PatternBase & {
  patternType: 'bgp';
  triples: Triple[];
  RTT: {
    ignored: r.ITOS[];
  };
};
export type PatternBind = r.IgnoredRTT3 & r.ImageRTT2 & PatternBase & {
  patternType: 'bind';
  expression: Expression;
  variable: TermVariable;
};
export type PatternService = r.IgnoredRTT3 & r.ImageRTT2 & PatternBase & {
  patternType: 'service';
  name: TermIri | TermVariable;
  silent: boolean;
  patterns: Pattern[];
};
export type ValuePatternRow = Record<string, TermIri | TermBlank | TermLiteral | undefined>;
export type PatternValues = r.IgnoredRTT & r.ImageRTT & PatternBase & {
  patternType: 'values';
  values: ValuePatternRow[];
  RTT: {
    varBrackets: [r.ITOS, r.ITOS] | [];
    vars: TermVariable[];
    valueBrackets: [r.ITOS, r.ITOS];
    valueInnerBrackets: [r.ITOS, r.ITOS][];
    undefRtt: [number, string, r.ITOS][];
  };
};
export type SubSelect = Omit<QuerySelect, 'context' | 'datasets'>;
// Curlies are pushed up instead of down because the syntax `{ { } }` is valid,
// but does not resolve in a pattern
export type Pattern = CurliedRTT & (
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
  | SubSelect
);

export type SolutionModifiers = {
  group?: SolutionModifierGroup;
  having?: SolutionModifierHaving;
  order?: SolutionModifierOrder;
  limitOffset?: SolutionModifierLimitOffset;
};
export type SolutionModifierBase = { type: 'solutionModifier'; modifierType: string };
export type SolutionModifierGroupBind = r.IgnoredRTT2 & r.ImageRTT & {
  variable: TermVariable;
  value: Expression;
};
export type SolutionModifierGroup = r.IgnoredRTT1 & r.ImageRTT2 & SolutionModifierBase & {
  modifierType: 'group';
  groupings: (Expression | SolutionModifierGroupBind)[];
};
export type SolutionModifierHaving = r.IgnoredRTT & r.ImageRTT & SolutionModifierBase & {
  modifierType: 'having';
  having: Expression[];
};
export type Ordering =
  | Expression
  | (r.ImageRTT & r.IgnoredRTT & { descending: boolean; expression: Expression });
export type SolutionModifierOrder = r.IgnoredRTT1 & r.ImageRTT2 & SolutionModifierBase & {
  modifierType: 'order';
  orderDefs: Ordering[];
};
export type SolutionModifierLimitOffset = r.ImageRTT2 & r.IgnoredRTT3 & SolutionModifierBase
  & { modifierType: 'limitOffset' }
  & ({ limit: number; offset: number | undefined } | { limit: number | undefined; offset: number });

export type ExpressionBase = { type: 'expression' };
/**
 * RTT.img2 image and RTT.i2 can be ignored if not distinct.
 */
type ExpressionAggregateBase = ExpressionBase & r.ImageRTT2 & r.IgnoredRTT3 & {
  expressionType: 'aggregate';
  distinct: boolean;
};
export type ExpressionAggregateDefault = ExpressionAggregateBase & {
  expression: [Expression];
  aggregation: string;
};
export type ExpressionAggregateOnWildcard = ExpressionAggregateBase & r.IgnoredRTT4 & {
  expression: [Wildcard];
  aggregation: string;
};
export type ExpressionAggregateSeparator = ExpressionAggregateBase & r.ImageRTT4 & r.IgnoredRTT7 & {
  expression: [Expression];
  aggregation: string;
  separator: string;
};
export type ExpressionAggregate =
  | ExpressionAggregateDefault
  | ExpressionAggregateOnWildcard
  | ExpressionAggregateSeparator;

export type ExpressionOperation = ExpressionBase & r.ImageRTT & {
  expressionType: 'operation';
  operator: string;
  args: Expression[];
  RTT: {
    /**
     * For builtInCall Having length = min(2, args.length +1)
     */
    ignored: r.ITOS[];
  };
};

export type ExpressionPatternOperation = ExpressionBase & r.ImageRTT & r.IgnoredRTT & {
  expressionType: 'patternOperation';
  operator: string;
  // Can be a pattern in case of exists and not exists
  args: Pattern[];
};

export type ExpressionFunctionCall = ExpressionBase & r.ImageRTT & {
  expressionType: 'functionCall';
  function: TermIri;
  distinct: boolean;
  args: Expression[];
  RTT: {
    ignored: r.ITOS[];
  };
};

export type Expression = BrackettedRTT & (
  | ExpressionOperation
  | ExpressionPatternOperation
  | ExpressionFunctionCall
  | ExpressionAggregate
  | TermIri
  | TermVariable
  | TermLiteral);

/**
 * Each tuple handles a single bracket recursion
 */
export type BracketWrapper = { idx: number; braceSpaces: [r.ITOS, r.ITOS][] }[];
export type BrackettedRTT = { RTT: { preBracket?: [r.ITOS, r.ITOS][] }};
export type CurliedRTT = { RTT: { preCurls?: BracketWrapper }};

type PropertyPathBase = { type: 'path' };
export type PropertyPathChain = PropertyPathBase & {
  pathType: '|' | '/';
  items: [Path, ...Path[]];
  RTT: {
    preSepIgnores: [r.ITOS, ...r.ITOS[]];
  };
};

export type PathModified = r.IgnoredRTT & PropertyPathBase & {
  pathType: '?' | '*' | '+' | '^';
  items: [Path];
};

export type PathNegatedElt = r.IgnoredRTT & PropertyPathBase & {
  pathType: '^';
  items: [TermIri];
};

export type PathAlternativeLimited = PropertyPathBase & {
  pathType: '|';
  items: [TermIri | PathNegatedElt, ...(TermIri | PathNegatedElt)[]];
  RTT: {
    preSepIgnores: [r.ITOS, ...r.ITOS[]];
  };
};

type PathNegatedNoRTT<T> = PropertyPathBase & {
  pathType: '!';
  items: [T];
};
// Bracketted or non-bracketted
export type PathNegated =
  | r.IgnoredRTT & PathNegatedNoRTT<TermIri | PathNegatedElt>
  | r.IgnoredRTT2 & PathNegatedNoRTT<TermIri | PathNegatedElt | PathAlternativeLimited>;

// [[88]](https://www.w3.org/TR/sparql11-query/#rPath)
export type Path = BrackettedRTT & (
  | TermIri
  | PropertyPathChain
  | PathModified
  | PathNegated);

type ContextDefinitionBase = { type: 'contextDef' };
export type ContextDefinitionPrefixDecl = r.IgnoredRTT2 & r.ImageRTT & ContextDefinitionBase & {
  contextType: 'prefix';
  key: string;
  value: TermIriFull;
};
export type ContextDefinitionBaseDecl = r.IgnoredRTT & r.ImageRTT & ContextDefinitionBase & {
  contextType: 'base';
  value: TermIriFull;
};
export type ContextDefinition = ContextDefinitionPrefixDecl | ContextDefinitionBaseDecl;

type TermBase = { type: 'term' };
type TermLiteralBase = TermBase & {
  termType: 'Literal';
  value: string;
};
export type TermLiteralStr = r.ReconstructRTT & TermLiteralBase & { langOrIri: undefined };
export type TermLiteralLangStr = r.IgnoredRTT1 & r.ImageRTT & TermLiteralBase & { langOrIri: string };
export type TermLiteralTyped = r.IgnoredRTT1 & r.ImageRTT & TermLiteralBase & { langOrIri: TermIri };
export type TermLiteralPrimitive = r.ReconstructRTT & TermLiteralBase & { langOrIri: TermIri };
export type TermLiteral = TermLiteralStr | TermLiteralLangStr | TermLiteralTyped | TermLiteralPrimitive;

export type TermVariable = r.ReconstructRTT & TermBase & {
  termType: 'Variable';
  value: string;
};

type TermIriBase = TermBase & { termType: 'NamedNode' };
export type TermIriFull = r.IgnoredRTT & TermIriBase & { value: string };
export type TermIriPrimitive = r.ReconstructRTT & TermIriBase & { value: string };
export type TermIriPrefixed = r.IgnoredRTT & TermIriBase & {
  value: string;
  prefix: string;
};
export type TermIri = TermIriFull | TermIriPrefixed | TermIriPrimitive;

type TermBlankBase = TermBase & { termType: 'BlankNode' };
export type TermBlankLabeled = r.IgnoredRTT & TermBlankBase & { label: string };
export type TermBlankAnon = r.IgnoredRTT & r.ImageRTT & TermBlankBase & { label: undefined };
export type TermBlankImplicit = TermBlankBase & { count: number };
export type TermBlankExplicit = TermBlankLabeled | TermBlankAnon;
export type TermBlank = TermBlankExplicit | TermBlankImplicit;

export type GraphTerm = TermIri | TermBlank | TermLiteral;
export type Term = GraphTerm | TermVariable;
