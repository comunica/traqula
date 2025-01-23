import type { TokenType } from 'chevrotain';
import * as l from '../lexer';
import type { IriTerm, IriTermOrElt, NegatedPropertySet, PropertyPath, SparqlRuleDef } from '../Sparql11types';
import { verbA } from './general';
import { iri } from './literals';

/**
 * [[88]](https://www.w3.org/TR/sparql11-query/#rPath)
 */
export const path: SparqlRuleDef<'path', PropertyPath | IriTerm> = <const> {
  name: 'path',
  impl: ({ SUBRULE }) => () => SUBRULE(pathAlternative, undefined),
};

export function pathHelper<T extends string>(
  name: T,
  SEP: TokenType,
  pathType: '|' | '/' | '^' | '+' | '*' | '?',
  subRule: SparqlRuleDef<string, PropertyPath | IriTerm>,
): SparqlRuleDef<T, PropertyPath | IriTerm> {
  return {
    name,
    impl: ({ SUBRULE2, AT_LEAST_ONE_SEP }) => () => {
      const alternatives: (IriTerm | PropertyPath)[] = [];
      AT_LEAST_ONE_SEP({
        DEF: () => {
          alternatives.push(SUBRULE2(subRule, undefined));
        },
        SEP,
      });
      return alternatives.length === 1 ?
        alternatives[0] :
          {
            type: 'path',
            pathType,
            items: alternatives,
          };
    },
  };
}

/**
 * [[92]](https://www.w3.org/TR/sparql11-query/#rPathEltOrInverse)
 */
export const pathEltOrInverse: SparqlRuleDef<'pathEltOrInverse', PropertyPath | IriTerm> = <const> {
  name: 'pathEltOrInverse',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, OR }) => () => OR<PropertyPath | IriTerm>([
    {
      ALT: () => SUBRULE1(pathElt, undefined),
    },
    {
      ALT: () => {
        CONSUME(l.symbols.hat);
        const item = SUBRULE2(pathElt, undefined);
        return {
          type: 'path',
          pathType: '^',
          items: [
            item,
          ],
        };
      },
    },
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
export const pathElt: SparqlRuleDef<'pathElt', PropertyPath | IriTerm> = <const> {
  name: 'pathElt',
  impl: ({ SUBRULE, OPTION }) => () => {
    const item = SUBRULE(pathPrimary, undefined);
    const modification = OPTION(() => SUBRULE(pathMod, undefined));
    return modification === undefined ?
      item :
        {
          type: 'path',
          pathType: modification,
          items: [ item ],
        };
  },
};

/**
 * [[93]](https://www.w3.org/TR/sparql11-query/#rPathMod)
 */
export const pathMod: SparqlRuleDef<'pathMod', '*' | '+' | '?'> = <const> {
  name: 'pathMod',
  impl: ({ CONSUME, OR }) => () => OR([
    {
      ALT: () => {
        CONSUME(l.symbols.question);
        return '?';
      },
    },
    {
      ALT: () => {
        CONSUME(l.symbols.star);
        return '*';
      },
    },
    {
      ALT: () => {
        CONSUME(l.symbols.opPlus);
        return '+';
      },
    },
  ]),
};

/**
 * [[94]](https://www.w3.org/TR/sparql11-query/#rPathPrimary)
 */
export const pathPrimary: SparqlRuleDef<'pathPrimary', PropertyPath | IriTerm> = <const> {
  name: 'pathPrimary',
  impl: ({ SUBRULE, CONSUME, OR }) => () => OR<PropertyPath | IriTerm>([
    { ALT: () => SUBRULE(iri, undefined) },
    {
      ALT: () => SUBRULE(verbA, undefined),
    },
    {
      ALT: () => {
        CONSUME(l.symbols.exclamation);
        const negatedPath = SUBRULE(pathNegatedPropertySet, undefined);
        return {
          type: 'path',
          pathType: '!',
          items: negatedPath,
        };
      },
    },
    {
      ALT: () => {
        CONSUME(l.symbols.LParen);
        const resRecursive = SUBRULE(path, undefined);
        CONSUME(l.symbols.RParen);
        return resRecursive;
      },
    },
  ]),
};

/**
 * [[95]](https://www.w3.org/TR/sparql11-query/#rPathNegatedPropertySet)
 */
export const pathNegatedPropertySet: SparqlRuleDef<'pathNegatedPropertySet', NegatedPropertySet['items']> = <const> {
  name: 'pathNegatedPropertySet',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, OR, MANY_SEP }) => () => OR<NegatedPropertySet['items']>([
    {
      ALT: () => [ SUBRULE1(pathOneInPropertySet, undefined) ],
    },
    {
      ALT: () => {
        CONSUME(l.symbols.LParen);
        const items: IriTermOrElt[] = [];
        MANY_SEP({
          DEF: () => {
            items.push(SUBRULE2(pathOneInPropertySet, undefined));
          },
          SEP: l.symbols.pipe,
        });
        CONSUME(l.symbols.RParen);
        return items.length === 1 ?
          items :
            [{
              type: 'path',
              pathType: '|',
              items,
            }];
      },
    },
  ]),
};

/**
 * [[96]](https://www.w3.org/TR/sparql11-query/#rPathOneInPropertySet)
 */
export const pathOneInPropertySet: SparqlRuleDef<'pathOneInPropertySet', IriTermOrElt> = <const> {
  name: 'pathOneInPropertySet',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, OR1, OR2 }) => () =>
    OR1<IriTermOrElt>([
      { ALT: () => SUBRULE1(iri, undefined) },
      { ALT: () => SUBRULE1(verbA, undefined) },
      {
        ALT: () => {
          CONSUME(l.symbols.hat);
          const item = OR2([
            { ALT: () => SUBRULE2(iri, undefined) },
            { ALT: () => SUBRULE2(verbA, undefined) },
          ]);
          return {
            type: 'path',
            pathType: '^',
            items: [ item ],
          };
        },
      },
    ]),
};
