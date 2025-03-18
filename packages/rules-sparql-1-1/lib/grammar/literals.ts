import { CommonIRIs } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type {
  TermLiteral,
  TermIriPrefixed,
  TermBlankExplicit,
  TermIri,
  TermIriFull,
  TermLiteralPrimitive,
  TermIriPrimitive,
  TermBlank,
} from '../RoundTripTypes';

import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import type { Reconstructed } from '../TypeHelpersRTT';
import { blank, genB } from './general';

export const rdfLiteral: SparqlRule<'rdfLiteral', TermLiteral> = <const> {
  name: 'rdfLiteral',
  impl: ({ ACTION, SUBRULE1, SUBRULE2, CONSUME, OPTION, OR }) => (C) => {
    const value = SUBRULE1(string, undefined);
    return OPTION(() => OR<TermLiteral>([
      { ALT: () => {
        const lang = CONSUME(l.terminals.langTag).image.slice(1);
        const i1 = SUBRULE1(blank, undefined);
        return ACTION(() => C.factory.literalTerm(value.i0, value.img1, i1, value.val, lang));
      } },
      { ALT: () => {
        CONSUME(l.symbols.hathat);
        const i1 = SUBRULE2(blank, undefined);
        const iriAndW = SUBRULE1(iri, undefined);
        return ACTION(() => C.factory.literalTerm(value.i0, value.img1, i1, value.val, iriAndW));
      } },
    ])) ?? ACTION(() => C.factory.literalTerm(value.i0, value.img1, value.val));
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
export const numericLiteral: SparqlGrammarRule<'numericLiteral', TermLiteralPrimitive> = <const> {
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
export const numericLiteralUnsigned: SparqlGrammarRule<'numericLiteralUnsigned', TermLiteralPrimitive> = <const> {
  name: 'numericLiteralUnsigned',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => (C) => {
    const x = OR<[string, string]>([
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
    const i0 = SUBRULE(blank, undefined);
    return ACTION(() => C.factory.literalTerm(i0, x[0], x[0], C.factory.namedNode([], x[1])));
  },
};

/**
 * Parses a positive numeric literal.
 * [[132]](https://www.w3.org/TR/sparql11-query/#rNumericLiteralPositive)
 */
export const numericLiteralPositive: SparqlGrammarRule<'numericLiteralPositive', TermLiteralPrimitive> = <const> {
  name: 'numericLiteralPositive',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => (C) => {
    const x = OR<[string, string]>([
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
    const i0 = SUBRULE(blank, undefined);
    return ACTION(() => C.factory.literalTerm(i0, x[0], x[0], C.factory.namedNode([], x[1])));
  },
};

/**
 * Parses a negative numeric literal.
 * [[133]](https://www.w3.org/TR/sparql11-query/#rNumericLiteralNegative)
 */
export const numericLiteralNegative: SparqlGrammarRule<'numericLiteralNegative', TermLiteralPrimitive> = <const> {
  name: 'numericLiteralNegative',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => (C) => {
    const x = OR<[string, string]>([
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
    const i0 = SUBRULE(blank, undefined);
    return ACTION(() => C.factory.literalTerm(i0, x[0], x[0], C.factory.namedNode([], x[1])));
  },
};

/**
 * Parses a boolean literal.
 * [[134]](https://www.w3.org/TR/sparql11-query/#rBooleanLiteral)
 */
export const booleanLiteral: SparqlGrammarRule<'booleanLiteral', TermLiteralPrimitive> = <const> {
  name: 'booleanLiteral',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => (C) => {
    const image = OR([
      { ALT: () => CONSUME(l.true_).image },
      { ALT: () => CONSUME(l.false_).image },
    ]);
    const i0 = SUBRULE(blank, undefined);

    return ACTION(() =>
      C.factory.literalTerm(i0, image, image.toLowerCase(), C.factory.namedNode([], CommonIRIs.BOOLEAN)));
  },
};

/**
 * Parses a string literal.
 * [[135]](https://www.w3.org/TR/sparql11-query/#rString)
 */
export const string: SparqlRule<'string', Reconstructed<string>> = <const> {
  name: 'string',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => () => {
    let img1 = '';
    const rawString = OR([
      { ALT: () => {
        img1 = CONSUME(l.terminals.stringLiteral1).image;
        return img1.slice(1, -1);
      } },
      { ALT: () => {
        img1 = CONSUME(l.terminals.stringLiteral2).image;
        return img1.slice(1, -1);
      } },
      { ALT: () => {
        img1 = CONSUME(l.terminals.stringLiteralLong1).image;
        return img1.slice(3, -3);
      } },
      { ALT: () => {
        img1 = CONSUME(l.terminals.stringLiteralLong2).image;
        return img1.slice(3, -3);
      } },
    ]);
    const i0 = SUBRULE(blank, undefined);
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
      return { i0, img1, val: value };
    });
  },
  gImpl: ({ SUBRULE: s }) => ast => `${genB(s, ast.i0)}${ast.img1}`,
};

/**
 * Parses a named node, either as an IRI or as a prefixed name.
 * [[136]](https://www.w3.org/TR/sparql11-query/#riri)
 */
export const iri: SparqlRule<'iri', TermIri> = <const> {
  name: 'iri',
  impl: ({ SUBRULE, OR }) => () => OR<TermIri>([
    { ALT: () => SUBRULE(iriFull, undefined) },
    { ALT: () => SUBRULE(prefixedName, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    if (F.isTermIriPrimitive(ast)) {
      return SUBRULE(verbA, ast, undefined);
    }
    if (F.isTermIriPrefixed(ast)) {
      return SUBRULE(prefixedName, ast, undefined);
    }
    return SUBRULE(iriFull, ast, undefined);
  },
};

export const iriFull: SparqlRule<'iriFull', TermIriFull> = <const> {
  name: 'iriFull',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const iriVal = CONSUME(l.terminals.iriRef).image.slice(1, -1);
    const i0 = SUBRULE(blank, undefined);
    return ACTION(() => C.factory.namedNode(i0, iriVal));
  },
  gImpl: ({ SUBRULE: s }) => ast => `${genB(s, ast.RTT.i0)}<${ast.value}>`,
};

/**
 * Parses a named node with a prefix. Looks up the prefix in the context and returns the full IRI.
 * [[137]](https://www.w3.org/TR/sparql11-query/#rPrefixedName)
 */
export const prefixedName: SparqlRule<'prefixedName', TermIriPrefixed> = <const> {
  name: 'prefixedName',
  impl: ({ ACTION, CONSUME, SUBRULE1, SUBRULE2, OR }) => C => OR<TermIriPrefixed>([
    { ALT: () => {
      const longName = CONSUME(l.terminals.pNameLn).image;
      const i0 = SUBRULE1(blank, undefined);
      return ACTION(() => {
        const [ prefix, localName ] = longName.split(':');
        return C.factory.namedNode(i0, localName, prefix);
      });
    } },
    { ALT: () => {
      const shortName = CONSUME(l.terminals.pNameNs).image.slice(0, -1);
      const i0 = SUBRULE2(blank, undefined);
      return ACTION(() => C.factory.namedNode(i0, '', shortName));
    } },
  ]),
  gImpl: ({ SUBRULE: s }) => ast =>
    `${genB(s, ast.RTT.i0)}${ast.prefix}:${ast.value}`,
};

export const canCreateBlankNodes = Symbol('canCreateBlankNodes');

/**
 * Parses blank note and throws an error if 'canCreateBlankNodes' is not in the current parserMode.
 * [[138]](https://www.w3.org/TR/sparql11-query/#rBlankNode)
 */
export const blankNode: SparqlRule<'blankNode', TermBlank> = <const> {
  name: 'blankNode',
  impl: ({ ACTION, CONSUME, OR, SUBRULE1, SUBRULE2 }) => (C) => {
    const result = OR<TermBlankExplicit>([
      { ALT: () => {
        const label = CONSUME(l.terminals.blankNodeLabel).image.slice(2);
        const i0 = SUBRULE1(blank, undefined);
        return ACTION(() => C.factory.blankNode(i0, label));
      } },
      { ALT: () => {
        const img = CONSUME(l.terminals.anon).image;
        const i0 = SUBRULE2(blank, undefined);
        return ACTION(() => C.factory.blankNode(i0, undefined, img));
      } },
    ]);
    ACTION(() => {
      if (!C.parseMode.has('canCreateBlankNodes')) {
        throw new Error('Blank nodes are not allowed in this context');
      }
    });
    return result;
  },
  gImpl: ({ SUBRULE: s }) => (ast, { factory: F }) => {
    if (F.isTermBlankImplicit(ast)) {
      throw new Error('Cannot serialize implicitly created blank nodes');
    }
    return ast.label === undefined ? `${genB(s, ast.RTT.i0)}${ast.RTT.img1}` : `${genB(s, ast.RTT.i0)}_:${ast.label}`;
  },
};

export const verbA: SparqlRule<'VerbA', TermIriPrimitive> = <const> {
  name: 'VerbA',
  impl: ({ ACTION, CONSUME, SUBRULE }) => (C) => {
    const img1 = CONSUME(l.a).image;
    const i0 = SUBRULE(blank, undefined);
    return ACTION(() => C.factory.namedNodePrimitive(i0, img1, CommonIRIs.TYPE));
  },
  gImpl: ({ SUBRULE: s }) => ast => `${genB(s, ast.RTT.i0)}${ast.RTT.img1}`,
};
