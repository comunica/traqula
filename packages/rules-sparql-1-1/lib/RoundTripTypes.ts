import type {
  PropertyPath,
} from './Sparql11types';
import type * as r from './TypeHelpersRTT';

export type Triple = {
  subject: Term;
  predicate: IriTerm | VariableTerm | PropertyPath;
  object: Term;
};

type LiteralTermBase = {
  type: 'term';
  termType: 'Literal';
  value: string;
};
export type LiteralTermStr = r.ReconstructRTT<LiteralTermBase & { langOrIri: undefined }>;
export type LiteralTermLangStr = r.IgnoredRTT1<r.ImageRTT<LiteralTermBase & { langOrIri: string }>>;
export type LiteralTermTyped = r.IgnoredRTT1<r.ImageRTT<LiteralTermBase & { langOrIri: IriTerm }>>;
export type LiteralTermPrimitive = r.ReconstructRTT<LiteralTermBase & { langOrIri: IriTerm }>;
export type LiteralTerm = LiteralTermStr | LiteralTermLangStr | LiteralTermTyped | LiteralTermPrimitive;

export type VariableTerm = {
  type: 'term';
  termType: 'Variable';
  value: string;
};

type IriTermBase = {
  type: 'term';
  termType: 'NamedNode';
};
export type FullIriTerm = r.IgnoredRTT<IriTermBase & { value: string }>;
export type PrefixedIriTerm = r.IgnoredRTT<IriTermBase & {
  value: string;
  prefix: string;
}>;
export type IriTerm = FullIriTerm | PrefixedIriTerm;

type BlankTermBase = {
  type: 'term';
  termType: 'BlankNode';
};
export type BlankTermLabeled = r.IgnoredRTT<BlankTermBase & { label: string }>;
export type BlankTermAnon = r.IgnoredRTT<r.ImageRTT<BlankTermBase & { label: undefined }>>;
export type BlankTermImplicit = BlankTermBase & { count: number };
export type BlankTermExplicit = BlankTermLabeled | BlankTermAnon;
export type BlankTerm = BlankTermExplicit | BlankTermImplicit;

export type Term = LiteralTerm | VariableTerm | IriTerm | BlankTerm;
