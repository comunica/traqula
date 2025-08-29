import type * as RDF from '@rdfjs/types';
import type { AstIndir } from '@traqula/algebra-transformations-1-1';
import { translateAlgTerm } from '@traqula/algebra-transformations-1-1';
import type { TermIri, TermVariable } from '@traqula/rules-sparql-1-1';
import type { Term, TermTriple } from '@traqula/rules-sparql-1-2';

export const translateAlgTerm12: AstIndir<(typeof translateAlgTerm)['name'], Term, [RDF.Term]> = {
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
