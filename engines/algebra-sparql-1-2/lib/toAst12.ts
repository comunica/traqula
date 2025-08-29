import type * as RDF from '@rdfjs/types';
import { toAstBuilder } from '@traqula/algebra-sparql-1-1';
import type { Algebra, algToSparql, AstIndir } from '@traqula/algebra-transformations-1-1';
import { translateAlgTerm, createAstContext } from '@traqula/algebra-transformations-1-1';
import { IndirBuilder } from '@traqula/core';
import type { TermIri, TermVariable } from '@traqula/rules-sparql-1-1';
import type { SparqlQuery, Term, TermTriple } from '@traqula/rules-sparql-1-2';

export const translateTerm12: AstIndir<(typeof translateAlgTerm)['name'], Term, [RDF.Term]> = {
  name: 'translateTerm',
  fun: s => (c, term) => {
    if (term.termType === 'Quad') {
      const { SUBRULE } = s;
      const { astFactory: F } = c;
      return {
        type: 'term',
        subType: 'triple',
        subject: SUBRULE(translateAlgTerm, term.subject),
        predicate: <TermIri | TermVariable> SUBRULE(translateAlgTerm, term.predicate),
        object: SUBRULE(translateAlgTerm, term.object),
        loc: F.gen(),
      } satisfies TermTriple;
    }
    return translateAlgTerm.fun(s)(c, term);
  },
};

export const toAstBuilder12 = IndirBuilder
  .create(toAstBuilder)
  .patchRule(translateTerm12)
  .typePatch<{
    [algToSparql.name]: [SparqlQuery, [Algebra.Operation]];
  }>();

export function toSparql12(op: Algebra.Operation): SparqlQuery {
  const c = createAstContext();
  const transformer = toAstBuilder12.build();
  return transformer.toSparqlJs(c, op);
}
