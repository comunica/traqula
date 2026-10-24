import { toAst11Builder } from '@traqula/algebra-sparql-1-1';
import type { Algebra, algToSparql } from '@traqula/algebra-transformations-1-1';
import type { AstContext, TransformerConfigs } from '@traqula/algebra-transformations-1-2';
import { algTermMentionsVariable12, createAstContext, translateAlgTerm12 } from '@traqula/algebra-transformations-1-2';
import { IndirBuilder } from '@traqula/core';
import type { SparqlQuery } from '@traqula/rules-sparql-1-2';

/**
 * Pre-configured {@link IndirBuilder} for translating SPARQL 1.2 Algebra back to SPARQL 1.2 AST.
 * Extends the SPARQL 1.1 algebra-to-AST builder with SPARQL 1.2 transformations.
 * Use {@link IndirBuilder.create IndirBuilder.create(toAst12Builder)} to extend it.
 */
export const toAst12Builder = IndirBuilder
  .create(toAst11Builder)
  .widenContext<AstContext>()
  .patchRule(translateAlgTerm12)
  .patchRule(algTermMentionsVariable12)
  .typePatch<{
    [algToSparql.name]: [SparqlQuery, [Algebra.Operation]];
  }>();

/**
 * Transform an operation to a Traqula SPARQL 1.2 AST.
 * @param op - the operation to transform.
 * @param options - the transformers the rules traverse with, defaulting to ones that visit all keys.
 * @returns the AST of the operation.
 */
export function toAst(op: Algebra.Operation, options: TransformerConfigs = {}): SparqlQuery {
  const c = createAstContext(options);
  const transformer = toAst12Builder.build();
  return transformer.algToSparql(c, op);
}
