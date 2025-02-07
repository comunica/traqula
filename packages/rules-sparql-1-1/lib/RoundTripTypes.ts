import type {
  Expression,
  Grouping,
  Ordering,
  Pattern,
  PropertyPath,
  ValuePatternRow,
  Variable,
} from './Sparql11types';
import type { Wildcard } from './Wildcard';

/**
 * White Space Object.
 */
export type WS = { ws: string };
/**
 * Comment Object.
 * The comment can NEVER contain a newline - generators should ALWAYS append a newline
 */
export type Comment = { comment: string };
/**
 * White Tracking Object
 */
export type WTO = WS | Comment;
/**
 * White Track Object Sequence.
 */
export type WTOS = WTO[];
/**
 * Before White Track Object Sequence
 */
export type B_WTOS = { w0: WTOS };
export type WBefore<T> = { w0: WTOS; val: T };
export type Image1<T> = { image1: string } & WBefore<T>;
export type WIn1<T> = WBefore<T> & { w1: WTOS };

export type BaseDecl = { base: string } &
  { RTT: { baseImage: string; w1: WTOS }};
export type PrefixDecl = { prefix: string; value: string } &
  { w1: WTOS; w2: WTOS };
export type Prologue = [BaseDecl | PrefixDecl, ...((BaseDecl & B_WTOS) | PrefixDecl & B_WTOS)[]];
export type DataSet = { default: IriTerm } | { named: IriTerm };

export interface BaseQuery {
  type: 'query';
  prologue: Prologue;
  from: DataSet[];
  where: Pattern[];
  values: ValuePatternRow[];
  having: Expression[];
  group: Grouping[];
  order: Ordering[];
  limit: number | undefined;
  offset: number | undefined;
}

export interface SelectQuery extends BaseQuery {
  queryType: 'SELECT';
  variables: [Variable, ...(Variable & B_WTOS)[]] | [Wildcard];
  modifier: 'DISTINCT' | 'REDUCED' | undefined;
  selectRTT: {
    selectImage: string;
    /**
     * Space after SELECT keyword.
     */
    w1: WTOS;
    /**
     * Space between distinct/ reduced (if present) and the variables
     */
    w2: WTOS | undefined;
    distRedImage: string | undefined;
  };
}

export interface ConstructQuery extends BaseQuery {
  queryType: 'CONSTRUCT';
  template: Triple[];
}

export type Triple = {
  subject: Term;
  predicate: IriTerm | VariableTerm | PropertyPath;
  object: Term;
};

export type LiteralTerm = {
  type: 'term';
  termType: 'Literal';
  value: string;
  langOrIri: string | IriTerm | undefined;
} & { RTT: {
  // Need whole image to reconstruct the original.
  //  Cannot see difference between for tab: u0009 or \t
  valueImage: string;
  // White before string
  w0: WTOS;
  // Between value and potential langtag/ ^^
  w1: WTOS | undefined;
  // Between ^^ and iri
  w2: WTOS | undefined;
}; };
export type VariableTerm = {
  type: 'term';
  termType: 'Variable';
  value: string;
};
export type FullIriTerm = {
  type: 'term';
  termType: 'NamedNode';
  value: string;
};
export type PrefixedIriTerm = {
  type: 'term';
  termType: 'NamedNode';
  value: string;
  prefix: string;
};
export type IriTerm = FullIriTerm | PrefixedIriTerm;
export type BlankTerm = {
  type: 'term';
  termType: 'BlankNode';
  value: string;
};
export type Term = LiteralTerm | VariableTerm | IriTerm | BlankTerm;
