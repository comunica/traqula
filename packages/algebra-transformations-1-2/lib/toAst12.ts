import type * as RDF from '@rdfjs/types';
import { algTermMentionsVariable, translateAlgTerm } from '@traqula/algebra-transformations-1-1';
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
    if (term.termType === 'Literal' && term.direction) {
      return F.termLiteral(
        F.gen(),
        term.value,
        `${term.language}--${term.direction}`,
      );
    }
    return translateAlgTerm.fun(s)(c, term);
  },
};

/**
 * Whether the term mentions the variable, also within (nested) triple terms.
 * @param term the term to search.
 * @param variable the variable to find.
 * @return whether the variable occurs in the term.
 */
export const algTermMentionsVariable12: AstIndir<
  (typeof algTermMentionsVariable)['name'],
boolean,
[RDF.Term, RDF.Variable]
> = {
  name: 'termMentionsVariable',
  fun: s => (c, term, variable) => {
    if (term.termType === 'Quad') {
      return [ term.subject, term.predicate, term.object, term.graph ]
        .some(component => s.SUBRULE(algTermMentionsVariable, component, variable));
    }
    return algTermMentionsVariable.fun(s)(c, term, variable);
  },
};
