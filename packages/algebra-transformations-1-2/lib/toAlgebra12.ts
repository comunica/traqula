import type * as RDF from '@rdfjs/types';
import {
  translateTerm,
  translateTripleCollection,
  translateTripleNesting,
} from '@traqula/algebra-transformations-1-1';
import type { AlgebraIndir, FlattenedTriple } from '@traqula/algebra-transformations-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type { Term, TripleCollection, TripleNesting } from '@traqula/rules-sparql-1-2';
import { termToString } from 'rdf-string';

const reificationIri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies';

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

export const translateTripleCollection12: AlgebraIndir<
  (typeof translateTripleCollection)['name'],
void,
[TripleCollection, FlattenedTriple[]]
> = {
  name: 'translateTripleCollection',
  fun: s => (c, collection, result) => {
    if (collection.subType === 'reifiedTriple') {
      const { SUBRULE } = s;
      const { dataFactory } = c;
      const translated: FlattenedTriple[] = [];
      SUBRULE(translateTripleNesting12, collection.triples[0], translated);
      const { subject, predicate, object } = translated[0];
      const asTerm = dataFactory.quad(subject, <Exclude<typeof predicate, T11.PathPure>> predicate, object);
      result.push({
        subject,
        predicate: dataFactory.namedNode(reificationIri),
        object: asTerm,
      });
    } else {
      translateTripleCollection.fun(s)(c, <T11.TripleCollection> collection, result);
    }
  },
};

export const translateTripleNesting12: AlgebraIndir<
  (typeof translateTripleNesting)['name'],
void,
[TripleNesting, FlattenedTriple[]]
> = {
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
          predicate: dataFactory.namedNode(reificationIri),
          object: asTerm,
        });
      }
    }
  },
};
