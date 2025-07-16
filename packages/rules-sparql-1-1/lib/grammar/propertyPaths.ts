import type { RuleDefReturn } from '@traqula/core';
import type { IToken, TokenType } from 'chevrotain';
import * as l from '../lexer';
import type { TermIri, PathNegatedElt, Path, PathModified, PathNegated } from '../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import { iri, verbA } from './literals';

/**
 * [[88]](https://www.w3.org/TR/sparql11-query/#rPath)
 */
export const path: SparqlRule<'path', Path> = <const> {
  name: 'path',
  impl: ({ SUBRULE }) => () => SUBRULE(pathAlternative, undefined),
  gImpl: ({ PRINT, SUBRULE }) => (ast, { factory: F }) => {
    if (F.isTerm(ast) && F.isTermNamed(ast)) {
      SUBRULE(iri, ast, undefined);
    } else {
      switch (ast.subType) {
        case '|':
        case '/': {
          const [ head, ...tail ] = ast.items;
          F.printFilter(ast, () => PRINT('('));
          SUBRULE(path, head, undefined);
          F.printFilter(ast, () => PRINT(')'));
          for (const val of tail) {
            F.printFilter(ast, () => PRINT(ast.subType, '('));
            SUBRULE(path, val, undefined);
            F.printFilter(ast, () => PRINT(')'));
          }
          break;
        }
        case '^':
          F.printFilter(ast, () => PRINT('^'));
          SUBRULE(path, ast.items[0], undefined);
          break;
        case '?':
        case '*':
        case '+':
          SUBRULE(path, ast.items[0], undefined);
          F.printFilter(ast, () => PRINT(ast.subType));
          break;
        case '!':
          F.printFilter(ast, () => PRINT('!'));
          SUBRULE(path, ast.items[0], undefined);
          break;
      }
    }
  },
};

export function pathChainHelper<T extends string>(
  name: T,
  SEP: TokenType,
  subType: '|' | '/',
  subRule: SparqlGrammarRule<string, Path>,
): SparqlGrammarRule<T, Path | TermIri> {
  return {
    name,
    impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, MANY }) => (C) => {
      const head = SUBRULE1(subRule, undefined);
      let tailEnd: Path = head;
      const tail: Path[] = [];

      MANY(() => {
        CONSUME(SEP);
        tailEnd = SUBRULE2(subRule, undefined);
        tail.push(tailEnd);
      });

      return ACTION(() => tail.length === 0 ?
        head :
        C.factory.path(subType, [ head, ...tail ], C.factory.sourceLocation(head, tailEnd)));
    },
  };
}

/**
 * [[92]](https://www.w3.org/TR/sparql11-query/#rPathEltOrInverse)
 */
export const pathEltOrInverse: SparqlGrammarRule<'pathEltOrInverse', PathModified | Path> = <const> {
  name: 'pathEltOrInverse',
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, OR }) => C => OR<Path | TermIri>([
    { ALT: () => SUBRULE1(pathElt, undefined) },
    { ALT: () => {
      const hat = CONSUME(l.symbols.hat);
      const item = SUBRULE2(pathElt, undefined);
      return ACTION(() => C.factory.path('^', [ item ], C.factory.sourceLocation(hat, item)));
    } },
  ]),
};

/**
 * [[90]](https://www.w3.org/TR/sparql11-query/#rPathSequence)
 */
export const pathSequence = pathChainHelper('pathSequence', l.symbols.slash, '/', pathEltOrInverse);

/**
 * [[89]](https://www.w3.org/TR/sparql11-query/#rPathAlternative)
 */
export const pathAlternative = pathChainHelper('pathAlternative', l.symbols.pipe, '|', pathSequence);

/**
 * [[91]](https://www.w3.org/TR/sparql11-query/#rPathElt)
 */
export const pathElt: SparqlGrammarRule<'pathElt', PathModified | Path> = <const> {
  name: 'pathElt',
  impl: ({ ACTION, SUBRULE, OPTION }) => (C) => {
    const item = SUBRULE(pathPrimary, undefined);
    const modification = OPTION(() => SUBRULE(pathMod, undefined));
    return ACTION(() => modification === undefined ?
      item :
      C.factory.path(modification.image, [ item ], C.factory.sourceLocation(item, modification)));
  },
};

/**
 * [[93]](https://www.w3.org/TR/sparql11-query/#rPathMod)
 */
export const pathMod: SparqlGrammarRule<'pathMod', IToken & { image: '*' | '+' | '?' }> = <const> {
  name: 'pathMod',
  impl: ({ CONSUME, OR }) => () => OR<RuleDefReturn<typeof pathMod>>([
    { ALT: () => <RuleDefReturn<typeof pathMod>> CONSUME(l.symbols.question) },
    { ALT: () => <RuleDefReturn<typeof pathMod>> CONSUME(l.symbols.star) },
    { ALT: () => <RuleDefReturn<typeof pathMod>> CONSUME(l.symbols.opPlus) },
  ]),
};

/**
 * [[94]](https://www.w3.org/TR/sparql11-query/#rPathPrimary)
 */
export const pathPrimary: SparqlGrammarRule<'pathPrimary', Path> = <const> {
  name: 'pathPrimary',
  impl: ({ SUBRULE, CONSUME, OR }) => () => OR<Path>([
    { ALT: () => SUBRULE(iri, undefined) },
    { ALT: () => SUBRULE(verbA, undefined) },
    { ALT: () => SUBRULE(pathNegatedPropertySet, undefined) },
    { ALT: () => {
      CONSUME(l.symbols.LParen);
      const resRecursive = SUBRULE(path, undefined);
      CONSUME(l.symbols.RParen);
      return resRecursive;
    } },
  ]),
};

/**
 * [[95]](https://www.w3.org/TR/sparql11-query/#rPathNegatedPropertySet)
 */
export const pathNegatedPropertySet: SparqlGrammarRule<'pathNegatedPropertySet', PathNegated> = <const> {
  name: 'pathNegatedPropertySet',
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, OR, MANY }) => (C) => {
    const exclamation = CONSUME(l.symbols.exclamation);
    return OR<PathNegated>([
      { ALT: () => {
        const noAlternative = SUBRULE1(pathOneInPropertySet, undefined);
        return ACTION(() =>
          C.factory.path('!', [ noAlternative ], C.factory.sourceLocation(exclamation, noAlternative)));
      } },
      { ALT: () => {
        const open = CONSUME(l.symbols.LParen);

        const head = SUBRULE2(pathOneInPropertySet, undefined);
        const tail: (TermIri | PathNegatedElt)[] = [];
        MANY(() => {
          CONSUME(l.symbols.pipe);
          const item = SUBRULE3(pathOneInPropertySet, undefined);
          tail.push(item);
        });

        const close = CONSUME(l.symbols.RParen);

        return ACTION(() => {
          const F = C.factory;
          if (tail.length === 0) {
            return F.path('!', [ head ], F.sourceLocation(exclamation, close));
          }
          return F.path(
            '!',
            [ F.path('|', [ head, ...tail ], F.sourceLocation(open, close)) ],
            F.sourceLocation(exclamation, close),
          );
        });
      } },
    ]);
  },
};

/**
 * [[96]](https://www.w3.org/TR/sparql11-query/#rPathOneInPropertySet)
 */
export const pathOneInPropertySet: SparqlGrammarRule<'pathOneInPropertySet', TermIri | PathNegatedElt> = <const> {
  name: 'pathOneInPropertySet',
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, OR1, OR2 }) => C =>
    OR1<TermIri | PathNegatedElt>([
      { ALT: () => SUBRULE1(iri, undefined) },
      { ALT: () => SUBRULE1(verbA, undefined) },
      { ALT: () => {
        const hat = CONSUME(l.symbols.hat);
        const item = OR2<TermIri>([
          { ALT: () => SUBRULE2(iri, undefined) },
          { ALT: () => SUBRULE2(verbA, undefined) },
        ]);
        return ACTION(() =>
          C.factory.path('^', [ item ], C.factory.sourceLocation(hat, item)));
      } },
    ]),
};
