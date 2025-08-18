import type * as RDF from '@rdfjs/types';
import type {
  Path,
  PathAlternativeLimited,
  PathModified,
  PathNegatedElt,
  PathPure,
  PropertyPathChain,
  TermIri,
} from '@traqula/rules-sparql-1-1';
import type * as Algebra from '../algebra';
import { types } from '../toAlgebra/core';
import Util from '../util';
import type { AstIndir } from './core';
import type { RdfTermToAst } from './general';
import { translateTerm } from './general';

export const translatePathComponent: AstIndir<'translatePathComponent', Path, [Algebra.Operation]> = {
  name: 'translatePathComponent',
  fun: ({ SUBRULE }) => (_, path) => {
    switch (path.type) {
      case types.ALT: return SUBRULE(translateAlt, path);
      case types.INV: return SUBRULE(translateInv, path);
      case types.LINK: return SUBRULE(translateLink, path);
      case types.NPS: return SUBRULE(translateNps, path);
      case types.ONE_OR_MORE_PATH: return SUBRULE(translateOneOrMorePath, path);
      case types.SEQ: return SUBRULE(translateSeq, path);
      case types.ZERO_OR_MORE_PATH: return SUBRULE(translateZeroOrMorePath, path);
      case types.ZERO_OR_ONE_PATH: return SUBRULE(translateZeroOrOnePath, path);
      default:
        throw new Error(`Unknown Path type ${path.type}`);
    }
  },
};

export const translateAlt: AstIndir<'translateAlt', Path, [Algebra.Alt]> = {
  name: 'translateAlt',
  fun: ({ SUBRULE }) => ({ astFactory: F }, path) => {
    const mapped = path.input.map(x => SUBRULE(translatePathComponent, x));
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
  },
};

export const translateInv: AstIndir<'translateInv', Path, [Algebra.Inv]> = {
  name: 'translateInv',
  fun: ({ SUBRULE }) => ({ astFactory: F }, path) => {
    if (path.path.type === types.NPS) {
      const inv: Path[] = path.path.iris.map((iri: RDF.NamedNode) => F.path(
        '^',
        [ <RdfTermToAst<typeof iri>>SUBRULE(translateTerm, iri) ],
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

    return F.path('^', [ SUBRULE(translatePathComponent, path.path) ], F.gen());
  },
};

export const translateLink: AstIndir<'translateLink', TermIri, [Algebra.Link]> = {
  name: 'translateLink',
  fun: ({ SUBRULE }) => (_, path) =>
    <RdfTermToAst<typeof path.iri>>SUBRULE(translateTerm, path.iri),
};

export const translateNps: AstIndir<'translateNps', Path, [Algebra.Nps]> = {
  name: 'translateNps',
  fun: ({ SUBRULE }) => ({ astFactory: F }, path) => {
    if (path.iris.length === 1) {
      return F.path('!', [ <RdfTermToAst<typeof path.iris[0]>> SUBRULE(translateTerm, path.iris[0]) ], F.gen());
    }
    return F.path('!', [
      F.path('|', path.iris.map(x => <RdfTermToAst<typeof x>> SUBRULE(translateTerm, x)), F.gen()),
    ], F.gen());
  },
};

export const translateOneOrMorePath: AstIndir<'translateOneOrMorePath', PathModified, [Algebra.OneOrMorePath]> = {
  name: 'translateOneOrMorePath',
  fun: ({ SUBRULE }) => ({ astFactory: F }, path) =>
    F.path('+', [ SUBRULE(translatePathComponent, path.path) ], F.gen()),
};

export const translateSeq: AstIndir<'translateSeq', PropertyPathChain, [Algebra.Seq]> = {
  name: 'translateSeq',
  fun: ({ SUBRULE }) => ({ astFactory: F }, path) =>
    F.path(
      '/',
      path.input.map(x => SUBRULE(translatePathComponent, x)),
      F.gen(),
    ),
};

export const translateZeroOrMorePath: AstIndir<'translateZeroOrMorePath', PathModified, [Algebra.ZeroOrMorePath]> = {
  name: 'translateZeroOrMorePath',
  fun: ({ SUBRULE }) => ({ astFactory: F }, path) =>
    F.path('*', [ SUBRULE(translatePathComponent, path.path) ], F.gen()),
};

export const translateZeroOrOnePath: AstIndir<'translateZeroOrOnePath', PathModified, [Algebra.ZeroOrOnePath]> = {
  name: 'translateZeroOrOnePath',
  fun: ({ SUBRULE }) => ({ astFactory: F }, path) =>
    F.path('?', [ SUBRULE(translatePathComponent, path.path) ], F.gen()),
};
