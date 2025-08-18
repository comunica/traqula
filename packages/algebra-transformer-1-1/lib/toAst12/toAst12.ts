import type * as RDF from '@rdfjs/types';
import { IndirBuilder } from '@traqula/core';
import type { TermIri, TermVariable } from '@traqula/rules-sparql-1-1';
import type { SparqlQuery, Term, TermTriple } from '@traqula/rules-sparql-1-2';
import type * as Algebra from '../algebra';
import type { AstIndir } from '../toAst/core';
import { createAstContext } from '../toAst/core';
import { translateTerm } from '../toAst/general';
import type { toSparqlJs } from '../toAst/toAst';
import { toAstBuilder } from '../toAst/toAst';

export const translateTerm12: AstIndir<(typeof translateTerm)['name'], Term, [RDF.Term]> = {
  name: 'translateTerm',
  fun: s => (c, term) => {
    if (term.termType === 'Quad') {
      const { SUBRULE } = s;
      const { astFactory: F } = c;
      return {
        type: 'term',
        subType: 'triple',
        subject: SUBRULE(translateTerm, term.subject),
        predicate: <TermIri | TermVariable> SUBRULE(translateTerm, term.predicate),
        object: SUBRULE(translateTerm, term.object),
        loc: F.gen(),
      } satisfies TermTriple;
    }
    return translateTerm.fun(s)(c, term);
  },
};

export const toAstBuilder12 = IndirBuilder
  .create(toAstBuilder)
  .patchRule(translateTerm12)
  .typePatch<{
    [toSparqlJs.name]: [SparqlQuery, [Algebra.Operation]];
  }>();

export function toSparql12(op: Algebra.Operation): SparqlQuery {
  const c = createAstContext();
  const transformer = toAstBuilder12.build();
  return transformer.toSparqlJs(c, op);
}
