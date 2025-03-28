import type { TokenType } from 'chevrotain';
import * as l from '../lexer';
import type { TermIri, PathNegatedElt, Path, PathModified, PathNegated } from '../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import type { ITOS } from '../TypeHelpersRTT';
import { blank, genB } from './general';
import { iri, verbA } from './literals';

/**
 * [[88]](https://www.w3.org/TR/sparql11-query/#rPath)
 */
export const path: SparqlRule<'path', Path> = <const> {
  name: 'path',
  impl: ({ SUBRULE }) => () => SUBRULE(pathAlternative, undefined),
  gImpl: ({ SUBRULE: s }) => (ast, { factory: F }) => {
    const builder: string[] = [];
    if (F.isBrackettedRTT(ast)) {
      builder.push(...ast.RTT.preBracket.reverse().flatMap(([ front ]) => [ genB(s, front), '(' ]));
    }

    if (F.isTerm(ast) && F.isTermIri(ast)) {
      builder.push(s(iri, ast, undefined));
    } else {
      switch (ast.pathType) {
        case '|':
        case '/': {
          const [ head, ...tail ] = ast.items;
          builder.push(s(path, head, undefined));
          for (const [ index, val ] of tail.entries()) {
            builder.push(genB(s, ast.RTT.preSepIgnores[index]), ast.pathType, s(path, val, undefined));
          }
          break;
        }
        case '^':
          builder.push(genB(s, ast.RTT.i0), '^', s(path, ast.items[0], undefined));
          break;
        case '?':
        case '*':
        case '+':
          builder.push(s(path, ast.items[0], undefined), genB(s, ast.RTT.i0), ast.pathType);
          break;
        case '!':
          builder.push(s(pathNegatedPropertySet, ast, undefined));
          break;
      }
    }

    if (F.isBrackettedRTT(ast)) {
      builder.push(...ast.RTT.preBracket.reverse().flatMap(([ , back ]) => [ genB(s, back), ')' ]));
    }
    return builder.join('');
  },
};

export function pathHelper<T extends string>(
  name: T,
  SEP: TokenType,
  pathType: '|' | '/',
  subRule: SparqlGrammarRule<string, Path>,
): SparqlGrammarRule<T, Path | TermIri> {
  return {
    name,
    impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, MANY }) => (C) => {
      const head = SUBRULE1(subRule, undefined);
      const tail: [ITOS, Path][] = [];

      MANY(() => {
        CONSUME(SEP);
        const i0 = SUBRULE1(blank, undefined);
        const item = SUBRULE2(subRule, undefined);
        tail.push([ i0, item ]);
      });

      if (tail.length === 0) {
        return head;
      }
      return ACTION(() => C.factory.path(
        pathType,
        [ head, ...tail.map(([ , item ]) => item) ],
        <[ITOS, ...ITOS[]]> tail.map(([ head ]) => head),
      ));
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
      CONSUME(l.symbols.hat);
      const i0 = SUBRULE1(blank, undefined);
      const item = SUBRULE2(pathElt, undefined);
      return ACTION(() => C.factory.path('^', item, i0));
    } },
  ]),
};

/**
 * [[90]](https://www.w3.org/TR/sparql11-query/#rPathSequence)
 */
export const pathSequence = pathHelper('pathSequence', l.symbols.slash, '/', pathEltOrInverse);

/**
 * [[89]](https://www.w3.org/TR/sparql11-query/#rPathAlternative)
 */
export const pathAlternative = pathHelper('pathAlternative', l.symbols.pipe, '|', pathSequence);

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
      C.factory.path(modification[1], item, modification[0]));
  },
};

/**
 * [[93]](https://www.w3.org/TR/sparql11-query/#rPathMod)
 */
export const pathMod: SparqlGrammarRule<'pathMod', [ITOS, '*' | '+' | '?']> = <const> {
  name: 'pathMod',
  impl: ({ CONSUME, OR, SUBRULE }) => () => {
    const mod = OR<'*' | '+' | '?'>([
      { ALT: () => <'?'> CONSUME(l.symbols.question).image },
      { ALT: () => <'*'> CONSUME(l.symbols.star).image },
      { ALT: () => <'+'> CONSUME(l.symbols.opPlus).image },
    ]);
    const i0 = SUBRULE(blank, undefined);

    return [ i0, mod ];
  },
};

/**
 * [[94]](https://www.w3.org/TR/sparql11-query/#rPathPrimary)
 */
export const pathPrimary: SparqlGrammarRule<'pathPrimary', Path> = <const> {
  name: 'pathPrimary',
  impl: ({ ACTION, SUBRULE, CONSUME, OR, SUBRULE1, SUBRULE2 }) => C => OR<Path>([
    { ALT: () => SUBRULE(iri, undefined) },
    { ALT: () => SUBRULE(verbA, undefined) },
    { ALT: () => SUBRULE(pathNegatedPropertySet, undefined) },
    { ALT: () => {
      CONSUME(l.symbols.LParen);
      const i0 = SUBRULE1(blank, undefined);
      const resRecursive = SUBRULE(path, undefined);
      CONSUME(l.symbols.RParen);
      const i1 = SUBRULE2(blank, undefined);
      return ACTION(() => C.factory.bracketted(resRecursive, i0, i1));
    } },
  ]),
};

/**
 * [[95]](https://www.w3.org/TR/sparql11-query/#rPathNegatedPropertySet)
 */
export const pathNegatedPropertySet:
SparqlRule<'pathNegatedPropertySet', PathNegated> = <const> {
  name: 'pathNegatedPropertySet',
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, OR, MANY }) => (C) => {
    CONSUME(l.symbols.exclamation);
    const i0 = SUBRULE1(blank, undefined);
    return OR<PathNegated>([
      { ALT: () => {
        const noAlternative = SUBRULE1(pathOneInPropertySet, undefined);
        return ACTION(() => C.factory.path('!', noAlternative, i0));
      } },
      {
        ALT: () => {
          CONSUME(l.symbols.LParen);
          const i1 = SUBRULE2(blank, undefined);

          const head = SUBRULE2(pathOneInPropertySet, undefined);
          const tail: [ITOS, TermIri | PathNegatedElt][] = [];
          MANY(() => {
            CONSUME(l.symbols.pipe);
            const iSup = SUBRULE3(blank, undefined);
            const item = SUBRULE3(pathOneInPropertySet, undefined);
            tail.push([ iSup, item ]);
          });

          CONSUME(l.symbols.RParen);
          const i2 = SUBRULE4(blank, undefined);

          if (tail.length === 0) {
            return ACTION(() => C.factory.path('!', head, [ i0, i1, i2 ]));
          }

          return ACTION(() => C.factory.path(
            '!',
            C.factory.path(
              '|',
              [ head, ...tail.map(([ , item ]) => item) ],
              <[ITOS, ...ITOS[]]> tail.map(([ head ]) => head),
            ),
            [ i0, i1, i2 ],
          ));
        },
      },
    ]);
  },
  gImpl: ({ SUBRULE: s }) => (ast, { factory: F }) => {
    const item = ast.items[0];
    // Stringify Item
    let itemStr: string;
    if (F.isTerm(item) || item.pathType === '^') {
      itemStr = s(pathOneInPropertySet, item, undefined);
    } else {
      const [ head, ...tail ] = item.items;
      const builder: string[] = [ s(pathOneInPropertySet, head, undefined) ];
      for (const [ index, val ] of tail.entries()) {
        builder.push(genB(s, item.RTT.preSepIgnores[index]), '|', s(pathOneInPropertySet, val, undefined));
      }
      itemStr = builder.join('');
    }
    if (F.isIgnores2(ast.RTT)) {
      // Case: brackets
      return [
        genB(s, ast.RTT.i0),
        '!',
        genB(s, ast.RTT.i1),
        '(',
        itemStr,
        genB(s, ast.RTT.i2),
        ')',
      ].join('');
    }
    return `${genB(s, ast.RTT.i0)}!${itemStr}`;
  },
};

/**
 * [[96]](https://www.w3.org/TR/sparql11-query/#rPathOneInPropertySet)
 */
export const pathOneInPropertySet: SparqlRule<'pathOneInPropertySet', TermIri | PathNegatedElt> = <const> {
  name: 'pathOneInPropertySet',
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, OR1, OR2 }) => C =>
    OR1<TermIri | PathNegatedElt>([
      { ALT: () => SUBRULE1(iri, undefined) },
      { ALT: () => SUBRULE1(verbA, undefined) },
      {
        ALT: () => {
          CONSUME(l.symbols.hat);
          const i0 = SUBRULE1(blank, undefined);
          const item = OR2<TermIri>([
            { ALT: () => SUBRULE2(iri, undefined) },
            { ALT: () => SUBRULE2(verbA, undefined) },
          ]);
          return ACTION(() => C.factory.path('^', item, i0));
        },
      },
    ]),
  gImpl: ({ SUBRULE: s }) => (ast, { factory: F }) => {
    if (F.isTerm(ast)) {
      return s(iri, ast, undefined);
    }
    return `${genB(s, ast.RTT.i0)}^${s(iri, ast.items[0], undefined)}`;
  },
};
