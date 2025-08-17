import type * as RDF from '@rdfjs/types';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type { Term, TripleNesting } from '@traqula/rules-sparql-1-2';

import { termToString } from 'rdf-string';
import type { AlgebraIndir, FlattenedTriple } from '../toAlgebra/core';
import { translateTerm } from '../toAlgebra/general';
import { translateTripleNesting } from '../toAlgebra/tripleAndQuad';

export const translateTerm12: AlgebraIndir<(typeof translateTerm)['name'], RDF.Term, [Term]> = {
  name: 'translateTerm',
  fun: s => (c, term) => {
    if (term.subType === 'triple') {
      return c.dataFactory.quad(
        s.SUBRULE(translateTerm12, term.subject),
        s.SUBRULE(translateTerm12, term.predicate),
        s.SUBRULE(translateTerm12, term.object),
      );
    }
    return translateTerm.fun(s)(c, term);
  },
};

export const translateTripleNesting12:
AlgebraIndir<(typeof translateTripleNesting)['name'], void, [TripleNesting, FlattenedTriple[]]> = {
  name: 'translateTripleNesting',
  fun: s => (c, triple, result) => {
    translateTripleNesting.fun(s)(c, <T11.TripleNesting>triple, result);
    const SUBRULE = s.SUBRULE;
    const { subject, predicate, object } = result.at(-1)!;
    const { astFactory: F, dataFactory } = c;
    if (triple.annotations && triple.annotations.length > 0) {
      // Blocks know who identifies them. -> Can just add it to list of triples
      //  -> a blocks identifier only need to be registered when the identifier is not explicitly registered before.
      //  We register: <annotationNode, reifies, tripleNesting>
      // You cannot have an annotation on a triple that has paths
      const asTerm = dataFactory.quad(subject, <Exclude<typeof predicate, T11.PathPure>> predicate, object);
      const registered = new Set<string>();
      for (const annotation of triple.annotations) {
        let subject: RDF.Term;
        if (F.isTripleCollection(annotation)) {
          subject = SUBRULE(translateTerm12, annotation.identifier);
          if (registered.has(termToString(subject))) {
            continue;
          }
        } else {
          subject = SUBRULE(translateTerm12, annotation);
        }
        registered.add(termToString(subject));
        result.push({
          subject,
          predicate: dataFactory.namedNode('reifies'),
          object: asTerm,
        });
      }
    }
  },
};
