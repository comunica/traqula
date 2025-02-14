import type {
  PropertyPath,
} from './Sparql11types';
import type * as r from './TypeHelpersRTT';

type ContextDefinitionBase = { type: 'contextDef' };
export type PrefixDecl = r.IgnoredRTT2<r.ImageRTT<ContextDefinitionBase & {
  contextType: 'prefix';
  key: string;
  value: IriTermFull;
}>>;
export type BaseDecl = r.IgnoredRTT<r.ImageRTT<ContextDefinitionBase & {
  contextType: 'base';
  value: IriTermFull;
}>>;
export type ContextDefinition = PrefixDecl | BaseDecl;

export type Triple = {
  subject: Term;
  predicate: IriTerm | VariableTerm | PropertyPath;
  object: Term;
};

type TermBase = { type: 'term' };
type LiteralTermBase = TermBase & {
  termType: 'Literal';
  value: string;
};
export type LiteralTermStr = r.ReconstructRTT<LiteralTermBase & { langOrIri: undefined }>;
export type LiteralTermLangStr = r.IgnoredRTT1<r.ImageRTT<LiteralTermBase & { langOrIri: string }>>;
export type LiteralTermTyped = r.IgnoredRTT1<r.ImageRTT<LiteralTermBase & { langOrIri: IriTerm }>>;
export type LiteralTermPrimitive = r.ReconstructRTT<LiteralTermBase & { langOrIri: IriTerm }>;
export type LiteralTerm = LiteralTermStr | LiteralTermLangStr | LiteralTermTyped | LiteralTermPrimitive;

export type VariableTerm = r.ReconstructRTT<TermBase & {
  termType: 'Variable';
  value: string;
}>;

type IriTermBase = TermBase & { termType: 'NamedNode' };
export type IriTermFull = r.IgnoredRTT<IriTermBase & { value: string }>;
export type IriTermPrefixed = r.IgnoredRTT<IriTermBase & {
  value: string;
  prefix: string;
}>;
export type IriTerm = IriTermFull | IriTermPrefixed;

type BlankTermBase = TermBase & { termType: 'BlankNode' };
export type BlankTermLabeled = r.IgnoredRTT<BlankTermBase & { label: string }>;
export type BlankTermAnon = r.IgnoredRTT<r.ImageRTT<BlankTermBase & { label: undefined }>>;
export type BlankTermImplicit = BlankTermBase & { count: number };
export type BlankTermExplicit = BlankTermLabeled | BlankTermAnon;
export type BlankTerm = BlankTermExplicit | BlankTermImplicit;

export type Term = LiteralTerm | VariableTerm | IriTerm | BlankTerm;
