import type * as RDF from '@rdfjs/types';
import type { IndirDef, TransformerSubTyped } from '@traqula/core';
import type { PathPure } from '@traqula/rules-sparql-1-1';
import { AstFactory, AstTransformer } from '@traqula/rules-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import * as Algebra from '../algebra.js';
import { AlgebraFactory } from '../algebraFactory.js';
import { algebraTransformer } from '../util.js';

export interface AlgebraContext {
  variables: Set<string>;
  varCount: number;
  useQuads: boolean;
  algebraFactory: AlgebraFactory;
  transformer: AstTransformer;
  /**
   * Transformer the rules traverse the algebra with, the default when undefined.
   */
  // TODO(major): optional type can become mandatory here.
  algebraTransformer?: TransformerSubTyped<Algebra.Operation>;
  astFactory: AstFactory;
  dataFactory: RDF.DataFactory<RDF.BaseQuad> & { variable: Function };
  currentBase: string | undefined;
  currentPrefixes: Record<string, string>;
  // TODO(major): optional type can become mandatory here.
  namedAggregatorCallback?: (iri: string) => boolean;
}

/**
 * The transformers the rules traverse with, e.g. ones using known keys allowlists to skip unknown keys.
 */
export interface TransformerConfigs {
  /**
   * Transformer to traverse the AST with. Defaults to an {@link AstTransformer}.
   */
  astTransformer?: AstTransformer;
  /**
   * Transformer to traverse the algebra with. Defaults to the transformer of the algebra utilities.
   */
  algebraTransformer?: TransformerSubTyped<Algebra.Operation>;
}

/**
 * The algebra transformer of the contexts that are given none, shared since transformers are stateless.
 */
export const defaultAlgebraTransformer = algebraTransformer({});

export interface ContextConfigs extends TransformerConfigs {
  dataFactory?: RDF.DataFactory<RDF.BaseQuad> & { variable: Function };
  quads?: boolean;
  prefixes?: Record<string, string>;
  baseIRI?: string;
  blankToVariable?: boolean;
  /**
   * Decides whether the function with the given full IRI is a custom aggregate,
   * translated as a {@link Algebra.BoundNamedAggregate}.
   */
  namedAggregatorCallback?: (iri: string) => boolean;
}
export function createAlgebraContext(config: ContextConfigs): AlgebraContext {
  const dataFactory = config.dataFactory ?? new DataFactory<RDF.BaseQuad>();
  return {
    variables: new Set<string>(),
    varCount: 0,
    useQuads: false,
    transformer: config.astTransformer ?? new AstTransformer(),
    algebraTransformer: config.algebraTransformer ?? defaultAlgebraTransformer,
    astFactory: new AstFactory(),
    dataFactory,
    algebraFactory: new AlgebraFactory(dataFactory),
    currentBase: config.baseIRI,
    currentPrefixes: Object.assign(Object.create(null), config.prefixes),
    namedAggregatorCallback: config.namedAggregatorCallback,
  };
}

export type AlgebraIndir<Name extends string, Ret, Arg extends any[]> = IndirDef<AlgebraContext, Name, Ret, Arg>;

export interface FlattenedTriple {
  subject: RDF.Term;
  predicate: RDF.Term | PathPure;
  object: RDF.Term;
}

export const types = Algebra.Types;
export const typeVals = Object.values(types);

export function isTerm(term: any): term is RDF.Term {
  return Boolean(term?.termType);
}

// This is not completely correct but this way we also catch SPARQL.js triples
export function isTriple(triple: any): triple is RDF.Quad {
  return triple.subject && triple.predicate && triple.object;
}

export function isVariable(term: RDF.Term): term is RDF.Variable {
  return term?.termType === 'Variable';
}
