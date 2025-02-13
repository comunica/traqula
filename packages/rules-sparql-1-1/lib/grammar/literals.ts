import { CommonIRIs } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type {
  LiteralTerm,
  PrefixedIriTerm,
  BlankTermExplicit,
  IriTerm,
  FullIriTerm,
  LiteralTermPrimitive,
} from '../RoundTripTypes';

import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import type { Reconstructed } from '../TypeHelpersRTT';
import { blank, genB } from './general';

export const rdfLiteral: SparqlRule<'rdfLiteral', LiteralTerm> = <const> {
  name: 'rdfLiteral',
  impl: ({ SUBRULE1, CONSUME, OPTION, OR }) => ({ factory: F }) => {
    const value = SUBRULE1(string, undefined);
    return OPTION(() => {
      const i1 = SUBRULE1(blank, undefined);
      return OR<LiteralTerm>([
        { ALT: () => {
          const lang = CONSUME(l.terminals.langTag).image.slice(1);
          return F.literalTerm(value.i0, value.img1, i1, value.val, lang);
        } },
        {
          ALT: () => {
            CONSUME(l.symbols.hathat);
            const iriAndW = SUBRULE1(iri, undefined);
            return F.literalTerm(value.i0, value.img1, i1, value.val, iriAndW);
          },
        },
      ]);
    }) ?? F.literalTerm(value.i0, value.img1, value.val);
  },
  gImpl: ({ SUBRULE: s }) => (ast, { factory: F }) => {
    const builder = [ genB(s, ast.RTT.i0), ast.RTT.img1 ];
    if (F.isIgnores1(ast.RTT)) {
      builder.push(genB(s, ast.RTT.i1));
      if (typeof ast.langOrIri === 'string') {
        builder.push(`@${ast.langOrIri}`);
      } else {
        builder.push('^^', s(iri, ast.langOrIri!, undefined));
      }
    }
    return builder.join('');
  },
};

/**
 * Parses a numeric literal.
 * [[130]](https://www.w3.org/TR/sparql11-query/#rNumericLiteral)
 */
export const numericLiteral: SparqlGrammarRule<'numericLiteral', LiteralTermPrimitive> = <const> {
  name: 'numericLiteral',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(numericLiteralUnsigned, undefined) },
    { ALT: () => SUBRULE(numericLiteralPositive, undefined) },
    { ALT: () => SUBRULE(numericLiteralNegative, undefined) },
  ]),
};

/**
 * Parses an unsigned numeric literal.
 * [[131]](https://www.w3.org/TR/sparql11-query/#rNumericLiteralUnsigned)
 */
export const numericLiteralUnsigned: SparqlGrammarRule<'numericLiteralUnsigned', LiteralTermPrimitive> = <const> {
  name: 'numericLiteralUnsigned',
  impl: ({ CONSUME, OR, SUBRULE }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const [ image, type ] = OR<[string, string]>([
      { ALT: () => {
        const val = CONSUME(l.terminals.integer).image;
        return [ val, CommonIRIs.INTEGER ];
      } },
      { ALT: () => {
        const val = CONSUME(l.terminals.decimal).image;
        return [ val, CommonIRIs.DECIMAL ];
      } },
      { ALT: () => {
        const val = CONSUME(l.terminals.double).image;
        return [ val, CommonIRIs.DOUBLE ];
      } },
    ]);
    return F.literalTerm(i0, image, image, F.namedNode([], type));
  },
};

/**
 * Parses a positive numeric literal.
 * [[132]](https://www.w3.org/TR/sparql11-query/#rNumericLiteralPositive)
 */
export const numericLiteralPositive: SparqlGrammarRule<'numericLiteralPositive', LiteralTermPrimitive> = <const> {
  name: 'numericLiteralPositive',
  impl: ({ CONSUME, OR, SUBRULE }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const [ image, type ] = OR<[string, string]>([
      { ALT: () => {
        const val = CONSUME(l.terminals.integerPositive).image;
        return [ val, CommonIRIs.INTEGER ];
      } },
      { ALT: () => {
        const val = CONSUME(l.terminals.decimalPositive).image;
        return [ val, CommonIRIs.DECIMAL ];
      } },
      { ALT: () => {
        const val = CONSUME(l.terminals.doublePositive).image;
        return [ val, CommonIRIs.DOUBLE ];
      } },
    ]);
    return F.literalTerm(i0, image, image, F.namedNode([], type));
  },
};

/**
 * Parses a negative numeric literal.
 * [[133]](https://www.w3.org/TR/sparql11-query/#rNumericLiteralNegative)
 */
export const numericLiteralNegative: SparqlGrammarRule<'numericLiteralNegative', LiteralTermPrimitive> = <const> {
  name: 'numericLiteralNegative',
  impl: ({ CONSUME, OR, SUBRULE }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const [ image, type ] = OR<[string, string]>([
      { ALT: () => {
        const val = CONSUME(l.terminals.integerNegative).image;
        return [ val, CommonIRIs.INTEGER ];
      } },
      { ALT: () => {
        const val = CONSUME(l.terminals.decimalNegative).image;
        return [ val, CommonIRIs.DECIMAL ];
      } },
      { ALT: () => {
        const val = CONSUME(l.terminals.doubleNegative).image;
        return [ val, CommonIRIs.DOUBLE ];
      } },
    ]);
    return F.literalTerm(i0, image, image, F.namedNode([], type));
  },
};

/**
 * Parses a boolean literal.
 * [[134]](https://www.w3.org/TR/sparql11-query/#rBooleanLiteral)
 */
export const booleanLiteral: SparqlGrammarRule<'booleanLiteral', LiteralTermPrimitive> = <const> {
  name: 'booleanLiteral',
  impl: ({ CONSUME, OR, SUBRULE }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const image = OR([
      { ALT: () => CONSUME(l.true_).image },
      { ALT: () => CONSUME(l.false_).image },
    ]);
    return F.literalTerm(i0, image, image.toLowerCase(), F.namedNode([], CommonIRIs.BOOLEAN));
  },
};

/**
 * Parses a string literal.
 * [[135]](https://www.w3.org/TR/sparql11-query/#rString)
 */
export const string: SparqlRule<'string', Reconstructed<string>> = <const> {
  name: 'string',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => ({ factory: F }) => {
    let image = '';
    const w0 = SUBRULE(blank, undefined);
    const rawString = OR([
      { ALT: () => {
        image = CONSUME(l.terminals.stringLiteral1).image;
        return image.slice(1, -1);
      } },
      { ALT: () => {
        image = CONSUME(l.terminals.stringLiteral2).image;
        return image.slice(1, -1);
      } },
      { ALT: () => {
        image = CONSUME(l.terminals.stringLiteralLong1).image;
        return image.slice(3, -3);
      } },
      { ALT: () => {
        image = CONSUME(l.terminals.stringLiteralLong2).image;
        return image.slice(3, -3);
      } },
    ]);
    // Handle string escapes (19.7). (19.2 is handled at input level.)
    return ACTION(() => {
      const value = rawString.replaceAll(/\\([tnrbf"'\\])/gu, (_, char: string) => {
        switch (char) {
          case 't':
            return '\t';
          case 'n':
            return '\n';
          case 'r':
            return '\r';
          case 'b':
            return '\b';
          case 'f':
            return '\f';
          default:
            return char;
        }
      });
      return F.ignores(F.image(F.wrap(value), image), w0);
    });
  },
  gImpl: ({ SUBRULE: s }) => ast => `${genB(s, ast.i0)}${ast.img1}`,
};

/**
 * Parses a named node, either as an IRI or as a prefixed name.
 * [[136]](https://www.w3.org/TR/sparql11-query/#riri)
 */
export const iri: SparqlRule<'iri', IriTerm> = <const> {
  name: 'iri',
  impl: ({ SUBRULE, OR }) => () => OR<IriTerm>([
    { ALT: () => SUBRULE(iriFull, undefined) },
    { ALT: () => SUBRULE(prefixedName, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => F.isPrefixedIriTerm(ast) ?
    SUBRULE(prefixedName, ast, undefined) :
    SUBRULE(iriFull, ast, undefined),
};

export const iriFull: SparqlRule<'iriFull', FullIriTerm> = <const> {
  name: 'iriFull',
  impl: ({ SUBRULE, CONSUME }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const iriVal = CONSUME(l.terminals.iriRef).image.slice(1, -1);
    return F.namedNode(i0, iriVal);
  },
  gImpl: ({ SUBRULE: s }) => ast => `${genB(s, ast.RTT.i0)}<${ast.value}>`,
};

/**
 * Parses a named node with a prefix. Looks up the prefix in the context and returns the full IRI.
 * [[137]](https://www.w3.org/TR/sparql11-query/#rPrefixedName)
 */
export const prefixedName: SparqlRule<'prefixedName', PrefixedIriTerm> = <const> {
  name: 'prefixedName',
  impl: ({ ACTION, CONSUME, SUBRULE, OR }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    return OR<PrefixedIriTerm>([
      { ALT: () => {
        const longName = CONSUME(l.terminals.pNameLn).image;
        return ACTION(() => {
          const [ prefix, localName ] = longName.split(':');
          return F.namedNode(i0, localName, prefix);
        });
      } },
      { ALT: () => F.namedNode(i0, '', CONSUME(l.terminals.pNameNs).image.slice(0, -1)) },
    ]);
  },
  gImpl: ({ SUBRULE: s }) => ast =>
    `${genB(s, ast.RTT.i0)}${ast.prefix}:${ast.value}`,
};

export const canCreateBlankNodes = Symbol('canCreateBlankNodes');

/**
 * Parses blank note and throws an error if 'canCreateBlankNodes' is not in the current parserMode.
 * [[138]](https://www.w3.org/TR/sparql11-query/#rBlankNode)
 */
export const blankNode: SparqlRule<'blankNode', BlankTermExplicit> = <const> {
  name: 'blankNode',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => ({ factory: F, parseMode }) => {
    const i0 = SUBRULE(blank, undefined);
    const result = OR<BlankTermExplicit>([
      {
        ALT: () => {
          const label = CONSUME(l.terminals.blankNodeLabel).image.slice(2);
          return F.blankNode(i0, label);
        },
      },
      {
        ALT: () => {
          const img = CONSUME(l.terminals.anon).image;
          return F.blankNode(i0, undefined, img);
        },
      },
    ]);
    ACTION(() => {
      if (!parseMode.has('canCreateBlankNodes')) {
        throw new Error('Blank nodes are not allowed in this context');
      }
    });
    return result;
  },
  gImpl: ({ SUBRULE: s }) => ast =>
    ast.label === undefined ? `${genB(s, ast.RTT.i0)}${ast.RTT.img1}` : `${genB(s, ast.RTT.i0)}_:${ast.label}`,
};
