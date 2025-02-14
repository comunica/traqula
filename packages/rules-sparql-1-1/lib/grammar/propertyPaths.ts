import type { TokenType } from 'chevrotain';
import * as l from '../lexer';
import type { IriTerm, NegatedElt, PropertyPath, PropertyPathModified, PropertyPathNegated } from '../RoundTripTypes';
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
export const path: SparqlRule<'path', PropertyPath> = <const> {
  name: 'path',
  impl: ({ SUBRULE }) => () => SUBRULE(pathAlternative, undefined),
  gImpl: ({ SUBRULE: s }) => (ast, { factory: F }) => {
    const builder: string[] = [];
    if (F.isBrackettedRTT(ast)) {
      builder.push(...ast.RTT.preBracket.reverse().map(([ front ]) => genB(s, front)));
    }

    if (F.isTerm(ast) && F.isIriTerm(ast)) {
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
      builder.push(...ast.RTT.preBracket.reverse().map(([ , back ]) => genB(s, back)));
    }
    return builder.join('');
  },
};

export function pathHelper<T extends string>(
  name: T,
  SEP: TokenType,
  pathType: '|' | '/',
  subRule: SparqlGrammarRule<string, PropertyPath>,
): SparqlGrammarRule<T, PropertyPath | IriTerm> {
  return {
    name,
    impl: ({ CONSUME, SUBRULE, MANY }) => ({ factory: F }) => {
      const head = SUBRULE(subRule, undefined);
      const tail: [ITOS, PropertyPath][] = [];

      MANY(() => {
        const i0 = SUBRULE(blank, undefined);
        CONSUME(SEP);
        const item = SUBRULE(subRule, undefined);
        tail.push([ i0, item ]);
      });

      if (tail.length === 0) {
        return head;
      }
      return F.path(
        pathType,
        [ head, ...tail.map(([ , item ]) => item) ],
<[ITOS, ...ITOS[]]> tail.map(([ head ]) => head),
      );
    },
  };
}

/**
 * [[92]](https://www.w3.org/TR/sparql11-query/#rPathEltOrInverse)
 */
export const pathEltOrInverse: SparqlGrammarRule<'pathEltOrInverse', PropertyPathModified | PropertyPath> = <const> {
  name: 'pathEltOrInverse',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, OR }) => ({ factory: F }) => OR<PropertyPath | IriTerm>([
    { ALT: () => SUBRULE1(pathElt, undefined) },
    { ALT: () => {
      const i0 = SUBRULE1(blank, undefined);
      CONSUME(l.symbols.hat);
      const item = SUBRULE2(pathElt, undefined);
      return F.path('^', item, i0);
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
export const pathElt: SparqlGrammarRule<'pathElt', PropertyPathModified | PropertyPath> = <const> {
  name: 'pathElt',
  impl: ({ SUBRULE, OPTION }) => ({ factory: F }) => {
    const item = SUBRULE(pathPrimary, undefined);
    const modification = OPTION(() => SUBRULE(pathMod, undefined));
    return modification === undefined ?
      item :
      F.path(modification[1], item, modification[0]);
  },
};

/**
 * [[93]](https://www.w3.org/TR/sparql11-query/#rPathMod)
 */
export const pathMod: SparqlGrammarRule<'pathMod', [ITOS, '*' | '+' | '?']> = <const> {
  name: 'pathMod',
  impl: ({ CONSUME, OR, SUBRULE }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const mod = OR<'*' | '+' | '?'>([
      { ALT: () => {
        CONSUME(l.symbols.question);
        return '?';
      } },
      { ALT: () => {
        CONSUME(l.symbols.star);
        return '*';
      } },
      { ALT: () => {
        CONSUME(l.symbols.opPlus);
        return '+';
      } },
    ]);
    return [ i0, mod ];
  },
};

/**
 * [[94]](https://www.w3.org/TR/sparql11-query/#rPathPrimary)
 */
export const pathPrimary: SparqlGrammarRule<'pathPrimary', PropertyPath> = <const> {
  name: 'pathPrimary',
  impl: ({ SUBRULE, CONSUME, OR, SUBRULE1, SUBRULE2 }) => ({ factory: F }) => OR<PropertyPath>([
    { ALT: () => SUBRULE(iri, undefined) },
    { ALT: () => SUBRULE(verbA, undefined) },
    { ALT: () => SUBRULE(pathNegatedPropertySet, undefined) },
    { ALT: () => {
      const i0 = SUBRULE1(blank, undefined);
      CONSUME(l.symbols.LParen);
      const resRecursive = SUBRULE(path, undefined);
      const i1 = SUBRULE2(blank, undefined);
      CONSUME(l.symbols.RParen);
      return F.bracketted(resRecursive, i0, i1);
    } },
  ]),
};

/**
 * [[95]](https://www.w3.org/TR/sparql11-query/#rPathNegatedPropertySet)
 */
export const pathNegatedPropertySet:
SparqlRule<'pathNegatedPropertySet', PropertyPathNegated> = <const> {
  name: 'pathNegatedPropertySet',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, OR, MANY }) => ({ factory: F }) => {
    const i0 = SUBRULE1(blank, undefined);
    CONSUME(l.symbols.exclamation);
    return OR<PropertyPathNegated>([
      { ALT: () => {
        const noAlternative = SUBRULE1(pathOneInPropertySet, undefined);
        return F.path('!', noAlternative, i0);
      } },
      {
        ALT: () => {
          const i1 = SUBRULE2(blank, undefined);
          CONSUME(l.symbols.LParen);

          const head = SUBRULE2(pathOneInPropertySet, undefined);
          const tail: [ITOS, IriTerm | NegatedElt][] = [];
          MANY(() => {
            const iSup = SUBRULE3(blank, undefined);
            const item = SUBRULE2(pathOneInPropertySet, undefined);
            tail.push([ iSup, item ]);
          });

          const i2 = SUBRULE3(blank, undefined);
          CONSUME(l.symbols.RParen);

          if (tail.length === 0) {
            return F.path('!', head, [ i0, i1, i2 ]);
          }

          return F.path(
            '!',
            F.path(
              '|',
              [ head, ...tail.map(([ , item ]) => item) ],
              <[ITOS, ...ITOS[]]> tail.map(([ head ]) => head),
            ),
            [ i0, i1, i2 ],
          );
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
export const pathOneInPropertySet: SparqlRule<'pathOneInPropertySet', IriTerm | NegatedElt> = <const> {
  name: 'pathOneInPropertySet',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, OR1, OR2 }) => ({ factory: F }) =>
    OR1<IriTerm | NegatedElt>([
      { ALT: () => SUBRULE1(iri, undefined) },
      { ALT: () => SUBRULE1(verbA, undefined) },
      {
        ALT: () => {
          const i0 = SUBRULE1(blank, undefined);
          CONSUME(l.symbols.hat);
          const item = OR2<IriTerm>([
            { ALT: () => SUBRULE2(iri, undefined) },
            { ALT: () => SUBRULE2(verbA, undefined) },
          ]);
          return F.path('^', item, i0);
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
