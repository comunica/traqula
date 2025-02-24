import type * as r from './TypeHelpersRTT';
import type { Wildcard } from './Wildcard';

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
     * Having length = min(2, args.length +1)
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

export interface ExpressionFunctionCall extends ExpressionBase {
  expressionType: 'functionCall';
  function: TermIri;
  args: Expression[];
}

export type Expression = BrackettedRTT & (
  | ExpressionOperation
  | ExpressionFunctionCall
  | ExpressionAggregate
  // Used in `IN` operator
  | Expression[]
  | TermIri
  | TermVariable
  | TermLiteral);

export type BrackettedRTT = { RTT: { preBracket?: [r.ITOS, r.ITOS][] }};

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

export type Triple = {
  subject: Term;
  predicate: TermIri | TermVariable | Path;
  object: Term;
};

export type PatternBase = { type: 'pattern' };
export type BgpPattern = r.IgnoredRTT & PatternBase & {
  patternType: 'bgp';
  triples: Triple[];
};
export type Pattern = BgpPattern;

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
