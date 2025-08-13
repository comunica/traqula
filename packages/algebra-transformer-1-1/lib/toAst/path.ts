import type * as RDF from '@rdfjs/types';
import type {
  Path,
  PathAlternativeLimited,
  PathModified,
  PathNegatedElt,
  PathPure,
  PatternBgp,
  PropertyPathChain,
  TermIri,
} from '@traqula/rules-sparql-1-1';
import type * as Algebra from '../algebra';
import { types } from '../toAlgebra/core';
import Util from '../util';
import type { AstContext } from './core';
import { translateTerm } from './general';

export function translatePathComponent(c: AstContext, path: Algebra.Operation): Path {
  switch (path.type) {
    case types.ALT: return translateAlt(c, path);
    case types.INV: return translateInv(c, path);
    case types.LINK: return translateLink(c, path);
    case types.NPS: return translateNps(c, path);
    case types.ONE_OR_MORE_PATH: return translateOneOrMorePath(c, path);
    case types.SEQ: return translateSeq(c, path);
    case types.ZERO_OR_MORE_PATH: return translateZeroOrMorePath(c, path);
    case types.ZERO_OR_ONE_PATH: return translateZeroOrOnePath(c, path);
    default:
      throw new Error(`Unknown Path type ${path.type}`);
  }
}

export function translateAlt(c: AstContext, path: Algebra.Alt): Path {
  const F = c.astFactory;
  const mapped = path.input.map(x => translatePathComponent(c, x));
  if (mapped.every(entry => F.isPathOfType(entry, [ '!' ]))) {
    return F.path(
      '!',
      [ F.path(
        '|',
        <(TermIri | PathNegatedElt)[]> Util.flatten(mapped.map(entry => (<PathPure> entry).items)),
        F.gen(),
      ) ],
      F.gen(),
    );
  }
  return F.path('|', mapped, F.gen());
}

export function translateInv(c: AstContext, path: Algebra.Inv): Path {
  const F = c.astFactory;
  if (path.path.type === types.NPS) {
    const inv: Path[] = path.path.iris.map((iri: RDF.NamedNode) => F.path(
      '^',
      [ translateTerm(c, iri) ],
      F.gen(),
    ));

    if (inv.length <= 1) {
      return F.path(
        '!',
        <[TermIri | PathNegatedElt | PathAlternativeLimited]> inv,
        F.gen(),
      );
    }

    return F.path('!', [ <PathAlternativeLimited> F.path('|', inv, F.gen()) ], F.gen());
  }

  return F.path('^', [ translatePathComponent(c, path.path) ], F.gen());
}

export function translateLink(c: AstContext, path: Algebra.Link): TermIri {
  return translateTerm(c, path.iri);
}

export function translateNps(c: AstContext, path: Algebra.Nps): Path {
  const F = c.astFactory;
  if (path.iris.length === 1) {
    return F.path('!', [ translateTerm(c, path.iris[0]) ], F.gen());
  }
  return F.path('!', [ F.path('|', path.iris.map(x => translateTerm(c, x)), F.gen()) ], F.gen());
}

export function translateOneOrMorePath(c: AstContext, path: Algebra.OneOrMorePath): PathModified {
  const F = c.astFactory;
  return F.path('+', [ translatePathComponent(c, path.path) ], F.gen());
}

export function translateSeq(c: AstContext, path: Algebra.Seq): PropertyPathChain {
  const F = c.astFactory;
  return F.path(
    '/',
    path.input.map(x => translatePathComponent(c, x)),
    F.gen(),
  );
}

export function translateZeroOrMorePath(c: AstContext, path: Algebra.ZeroOrMorePath): PathModified {
  const F = c.astFactory;
  return F.path('*', [ translatePathComponent(c, path.path) ], F.gen());
}

export function translateZeroOrOnePath(c: AstContext, path: Algebra.ZeroOrOnePath): PathModified {
  const F = c.astFactory;
  return F.path('?', [ translatePathComponent(c, path.path) ], F.gen());
}

export function translatePath(c: AstContext, op: Algebra.Path): PatternBgp {
  const F = c.astFactory;
  return F.patternBgp([
    F.triple(
      translateTerm(c, op.subject),
      translatePathComponent(c, op.predicate),
      translateTerm(c, op.object),
    ),
  ], F.gen());
}
