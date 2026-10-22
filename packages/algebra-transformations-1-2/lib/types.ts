import type * as RDF from '@rdfjs/types';
import type * as Trans11 from '@traqula/algebra-transformations-1-1';
import {
  createAlgebraContext as createAlgebraContext11,
  createAstContext as createAstContext11,
} from '@traqula/algebra-transformations-1-1';
import type { IndirDef, Patch } from '@traqula/core';
import { AstFactory, AstTransformer } from '@traqula/rules-sparql-1-2';
import type * as T12 from '@traqula/rules-sparql-1-2';

export type AlgebraContext = Patch<Trans11.AlgebraContext, {
  astFactory: AstFactory;
  transformer: AstTransformer;
}>;

export type FlattenedTriple = Patch<Trans11.FlattenedTriple, { predicate: RDF.Term | T12.PathPure }>;
export type TransformerConfigs = Patch<Trans11.TransformerConfigs, { astTransformer?: AstTransformer }>;
export type ContextConfigs = Patch<Trans11.ContextConfigs, TransformerConfigs>;
export function createAlgebraContext(config: ContextConfigs): AlgebraContext {
  const context11 = createAlgebraContext11(config);
  return {
    ...context11,
    astFactory: new AstFactory(),
    transformer: config.astTransformer ?? new AstTransformer(),
  };
}

export type AlgebraIndir<Name extends string, Ret, Arg extends any[]> = IndirDef<AlgebraContext, Name, Ret, Arg>;

export type AstContext = Patch<Trans11.AstContext, {
  astFactory: AstFactory;
  transformer: AstTransformer;
}>;

/**
 * Creates the context of a translation from algebra to AST.
 * @param config the transformers the rules traverse with, defaulting to ones that visit all keys.
 * @return the context to start the translation with.
 */
export function createAstContext(config: TransformerConfigs = {}): AstContext {
  const context11 = createAstContext11(config);
  return {
    ...context11,
    astFactory: new AstFactory(),
    transformer: config.astTransformer ?? new AstTransformer(),
  };
}

export type AstIndir<Name extends string, Ret, Arg extends any[]> = IndirDef<AstContext, Name, Ret, Arg>;
