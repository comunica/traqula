import type {
  PropertyPath,
} from './Sparql11types';

/**
 * Blank Space Object.
 */
export type BlankSpace = { bs: string };
/**
 * Comment Object.
 * The comment can NEVER contain a newline - generators should ALWAYS append a newline
 */
export type Comment = { comment: string };
/**
 * Ignored Tracking Object
 */
export type ITO = BlankSpace | Comment;
/**
 * Ignored Track Object Sequence.
 */
export type ITOS = ITO[];
/**
 * Before Ignored Track Object Sequence
 */
export type Wrap<T> = { val: T };
export type Indexes0 = '0' | Indexes;
export type Indexes = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type Ignores<Idx extends Indexes0 = '0'> = {[k in `i${Idx}`]: ITOS };
export type Images<Idx extends Indexes = '1'> = {[k in `img${Idx}`]: string };
export type Reconstruct<IgnoredIdx extends Indexes0 = '0', ImageIdx extends Indexes = '1'> =
  Ignores<IgnoredIdx> & Images<ImageIdx>;

export type Ignored<Val, Idx extends Indexes0 = '0'> = Wrap<Val> & Ignores<Idx>;
export type Imaged<Val, Idx extends Indexes = '1'> = Wrap<Val> & Images<Idx>;
export type Reconstructed<Val, IgnoredIdx extends Indexes0 = '0', ImageIdx extends Indexes = '1'>
  = Wrap<Val> & Reconstruct<IgnoredIdx, ImageIdx>;

export type IgnoredRTT<Val, Idx extends Indexes0 = '0'> = Val & { RTT: Ignores<Idx> };
export type ImageRTT<Val, Idx extends Indexes = '1'> = Val & { RTT: Images<Idx> };
export type ReconstructRTT<Val, IgnoredIdx extends Indexes0 = '0', ImageIdx extends Indexes = '1'>
  = IgnoredRTT<Val, IgnoredIdx> & ImageRTT<Val, ImageIdx>;

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
};
export type LiteralTermRTT = LiteralTerm & {
  RTT: {
    // Need whole image to reconstruct the original.
    //  Cannot see difference between for tab: u0009 or \t
    valueImage: string;
    // White before string
    i0: ITOS;
    // Between value and potential langtag/ ^^
    i1: ITOS | undefined;
    // Between ^^ and iri
    i2: ITOS | undefined;
  };
};

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
