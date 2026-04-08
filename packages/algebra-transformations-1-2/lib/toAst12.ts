import type * as RDF from '@rdfjs/types';
import { translateAlgTerm } from '@traqula/algebra-transformations-1-1';
import type { TermIri, TermVariable } from '@traqula/rules-sparql-1-1';
import type { Term } from '@traqula/rules-sparql-1-2';
import type { AstIndir } from './types.js';

export const translateAlgTerm12: AstIndir<(typeof translateAlgTerm)['name'], Term, [RDF.Term]> = {
  name: 'translateTerm',
  fun: s => (c, term) => {
    const { SUBRULE } = s;
    const { astFactory: F } = c;
    if (term.termType === 'Quad') {
      return F.termTriple(
        SUBRULE(translateAlgTerm, term.subject),
        <TermIri | TermVariable> SUBRULE(translateAlgTerm, term.predicate),
        SUBRULE(translateAlgTerm, term.object),
        F.gen(),
      );
    }
    if (term.termType === 'Literal' && term.direction !== undefined) {
      return F.termLiteral(
        F.gen(),
        term.value,
        `${term.language}--${term.direction}`,
      );
    }
    return translateAlgTerm.fun(s)(c, term);
  },
};
