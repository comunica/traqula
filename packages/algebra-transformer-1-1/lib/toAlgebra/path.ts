import type * as RDF from '@rdfjs/types';
import type { Path, PathNegatedElt, PathPure, TermIri } from '@traqula/rules-sparql-1-1';
import type { Algebra } from '../index';
import type { AlgebraContext, FlattenedTriple } from './core';
import { isTerm, types } from './core';
import { generateFreshVar, translateTerm } from './general';

/**
 * 18.2.2.3 Translate Property Path Expressions
 * 18.2.2.4 Translate Property Path Patterns
 */
export function translatePath(c: AlgebraContext, triple: FlattenedTriple & { predicate: PathPure }):
(Algebra.Path | Algebra.Pattern)[] {
  const sub = triple.subject;
  const pred = translatePathPredicate(c, triple.predicate);
  const obj = triple.object;

  return simplifyPath(c, sub, pred, obj);
}

/**
 * 18.2.2.3 Translate Property Path Expressions
 */
export function translatePathPredicate(c: AlgebraContext, predicate: RDF.NamedNode | Path): Algebra.PropertyPathSymbol {
  const F = c.astFactory;
  if (F.isTerm(predicate)) {
    return translatePathPredicate(c, translateTerm(c, predicate));
  }
  // Iri -> link(iri)
  if (isTerm(predicate)) {
    return c.factory.createLink(predicate);
  }

  // ^path -> inv(path)
  if (predicate.subType === '^') {
    return c.factory.createInv(translatePathPredicate(c, <RDF.NamedNode | PathPure> predicate.items[0]));
  }

  if (predicate.subType === '!') {
    // Negation is either over a single predicate or a list of disjuncted properties - that can only have modifier '^'
    const normals: TermIri[] = [];
    const inverted: TermIri[] = [];
    // Either the item of this one is an `|`, `^` or `iri`
    const contained = predicate.items[0];
    let items: (TermIri | PathNegatedElt)[];
    if (F.isPathPure(contained) && contained.subType === '|') {
      items = contained.items;
    } else {
      items = [ contained ];
    }

    for (const item of items) {
      if (F.isTerm(item)) {
        normals.push(item);
      } else if (item.subType === '^') {
        inverted.push(item.items[0]);
      } else {
        throw new Error(`Unexpected item: ${JSON.stringify(item)}`);
      }
    }

    // NPS elements do not have the LINK function
    const normalElement = c.factory.createNps(normals.map(x => translateTerm(c, x)));
    const invertedElement = c.factory.createInv(c.factory.createNps(inverted.map(x => translateTerm(c, x))));

    // !(:iri1|...|:irin) -> NPS({:iri1 ... :irin})
    if (inverted.length === 0) {
      return normalElement;
    }
    // !(^:iri1|...|^:irin) -> inv(NPS({:iri1 ... :irin}))
    if (normals.length === 0) {
      return invertedElement;
    }
    // !(:iri1|...|:irii|^:irii+1|...|^:irim -> alt(NPS({:iri1 ...:irii}), inv(NPS({:irii+1, ..., :irim})) )
    return c.factory.createAlt([ normalElement, invertedElement ]);
  }

  // Path1 / path -> seq(path1, path2)
  if (predicate.subType === '/') {
    return c.factory.createSeq(predicate.items.map(item => translatePathPredicate(c, <PathPure> item)));
  }
  // Path1 | path2 -> alt(path1, path2)
  if (predicate.subType === '|') {
    return c.factory.createAlt(predicate.items.map(item => translatePathPredicate(c, <PathPure> item)));
  }
  // Path* -> ZeroOrMorePath(path)
  if (predicate.subType === '*') {
    return c.factory.createZeroOrMorePath(translatePathPredicate(c, <PathPure> predicate.items[0]));
  }
  // Path+ -> OneOrMorePath(path)
  if (predicate.subType === '+') {
    return c.factory.createOneOrMorePath(translatePathPredicate(c, <PathPure> predicate.items[0]));
  }
  // Path? -> ZeroOrOnePath(path)
  if (predicate.subType === '?') {
    return c.factory.createZeroOrOnePath(translatePathPredicate(c, <PathPure> predicate.items[0]));
  }

  throw new Error(`Unable to translate path expression ${JSON.stringify(predicate)}`);
}

/**
 * 18.2.2.4 Translate Property Path Patterns
 */
export function simplifyPath(
  c: AlgebraContext,
  subject: RDF.Term,
  predicate: Algebra.PropertyPathSymbol,
  object: RDF.Term,
): (Algebra.Pattern | Algebra.Path)[] {
  // X link(iri) Y -> X iri Y
  if (predicate.type === types.LINK) {
    return [ c.factory.createPattern(subject, predicate.iri, object) ];
  }

  // X inv(iri) Y -> Y iri X
  if (predicate.type === types.INV) {
    return simplifyPath(c, <RDF.Quad_Subject> object, predicate.path, subject);
  }

  // X seq(P, Q) Y -> X P ?V . ?V Q P
  if (predicate.type === types.SEQ) {
    let iter = subject;
    const result: (Algebra.Pattern | Algebra.Path)[] = [];
    for (const pathOfSeq of predicate.input.slice(0, -1)) {
      const joinVar = generateFreshVar(c);
      result.push(...simplifyPath(c, iter, pathOfSeq, joinVar));
      iter = joinVar;
    }
    result.push(...simplifyPath(c, iter, predicate.input.at(-1)!, object));
    return result;
  }

  // X P Y -> Path(X, P, Y)
  return [ c.factory.createPath(subject, predicate, object) ];
}
