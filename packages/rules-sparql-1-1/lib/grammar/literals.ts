import type { IToken } from 'chevrotain';
import { CommonIRIs } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type {
  TermBlank,
  TermIri,
  TermIriFull,
  TermIriPrefixed,
  TermLiteral,
  TermLiteralStr,
  TermLiteralTyped,
} from '../RoundTripTypes';

import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';

export function stringEscapedLexical(str: string): string {
  const lexical = str.replaceAll(/["\\\t\n\r\b\f]/gu, (char) => {
    switch (char) {
      case '\t':
        return '\\t';
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '\b':
        return '\\b';
      case '\f':
        return '\\f';
      case '"':
        return '\\"';
      case '\\':
        return '\\\\';
      default:
        return char;
    }
  });
  return `"${lexical}"`;
}

/**
 * [[120]](https://www.w3.org/TR/sparql11-query/#rRDFLiteral)
 */
export const rdfLiteral: SparqlRule<'rdfLiteral', TermLiteral> = <const> {
  name: 'rdfLiteral',
  impl: ({ ACTION, SUBRULE1, CONSUME, OPTION, OR }) => (C) => {
    const value = SUBRULE1(string, undefined);
    return OPTION(() => OR<TermLiteral>([
      { ALT: () => {
        const lang = CONSUME(l.terminals.langTag);
        return ACTION(() => C.factory.literalTerm(
          C.factory.sourceLocation(value, lang),
          value.value,
          lang.image.slice(1).toLowerCase(),
        ));
      } },
      { ALT: () => {
        CONSUME(l.symbols.hathat);
        const iriVal = SUBRULE1(iri, undefined);
        return ACTION(() => C.factory.literalTerm(
          C.factory.sourceLocation(value, iriVal),
          value.value,
          iriVal,
        ));
      } },
    ])) ?? value;
  },
  gImpl: ({ SUBRULE, PRINT, PRINT_SPACE_LEFT }) => (ast, { factory }) => {
    factory.printFilter(ast, () => PRINT_SPACE_LEFT(stringEscapedLexical(ast.value)));

    if (ast.langOrIri) {
      if (typeof ast.langOrIri === 'string') {
        factory.printFilter(ast, () => PRINT('@', ast.langOrIri));
      } else {
        factory.printFilter(ast, () => PRINT('^^'));
        SUBRULE(iri, ast.langOrIri, undefined);
      }
    }
  },
};

/**
 * Parses a numeric literal.
 * [[130]](https://www.w3.org/TR/sparql11-query/#rNumericLiteral)
 */
export const numericLiteral: SparqlGrammarRule<'numericLiteral', TermLiteralTyped> = <const> {
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
export const numericLiteralUnsigned: SparqlGrammarRule<'numericLiteralUnsigned', TermLiteralTyped> = <const> {
  name: 'numericLiteralUnsigned',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const parsed = OR<[IToken, string]>([
      { ALT: () => <const> [ CONSUME(l.terminals.integer), CommonIRIs.INTEGER ]},
      { ALT: () => <const> [ CONSUME(l.terminals.decimal), CommonIRIs.DECIMAL ]},
      { ALT: () => <const> [ CONSUME(l.terminals.double), CommonIRIs.DOUBLE ]},
    ]);
    return ACTION(() => C.factory.literalTerm(
      C.factory.sourceLocation(parsed[0]),
      parsed[0].image,
      C.factory.namedNode(C.factory.sourceLocationNoMaterialize(), parsed[1]),
    ));
  },
};

/**
 * Parses a positive numeric literal.
 * [[132]](https://www.w3.org/TR/sparql11-query/#rNumericLiteralPositive)
 */
export const numericLiteralPositive: SparqlGrammarRule<'numericLiteralPositive', TermLiteralTyped> = <const> {
  name: 'numericLiteralPositive',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const parsed = OR<[IToken, string]>([
      { ALT: () => <const> [ CONSUME(l.terminals.integerPositive), CommonIRIs.INTEGER ]},
      { ALT: () => <const> [ CONSUME(l.terminals.decimalPositive), CommonIRIs.DECIMAL ]},
      { ALT: () => <const> [ CONSUME(l.terminals.doublePositive), CommonIRIs.DOUBLE ]},
    ]);
    return ACTION(() => C.factory.literalTerm(
      C.factory.sourceLocation(parsed[0]),
      parsed[0].image,
      C.factory.namedNode(C.factory.sourceLocationNoMaterialize(), parsed[1]),
    ));
  },
};

/**
 * Parses a negative numeric literal.
 * [[133]](https://www.w3.org/TR/sparql11-query/#rNumericLiteralNegative)
 */
export const numericLiteralNegative: SparqlGrammarRule<'numericLiteralNegative', TermLiteralTyped> = <const> {
  name: 'numericLiteralNegative',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const parsed = OR<[IToken, string]>([
      { ALT: () => <const> [ CONSUME(l.terminals.integerNegative), CommonIRIs.INTEGER ]},
      { ALT: () => <const> [ CONSUME(l.terminals.decimalNegative), CommonIRIs.DECIMAL ]},
      { ALT: () => <const> [ CONSUME(l.terminals.doubleNegative), CommonIRIs.DOUBLE ]},
    ]);
    return ACTION(() => C.factory.literalTerm(
      C.factory.sourceLocation(parsed[0]),
      parsed[0].image,
      C.factory.namedNode(C.factory.sourceLocationNoMaterialize(), parsed[1]),
    ));
  },
};

/**
 * Parses a boolean literal.
 * [[134]](https://www.w3.org/TR/sparql11-query/#rBooleanLiteral)
 */
export const booleanLiteral: SparqlGrammarRule<'booleanLiteral', TermLiteralTyped> = <const> {
  name: 'booleanLiteral',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const token = OR([
      { ALT: () => CONSUME(l.true_) },
      { ALT: () => CONSUME(l.false_) },
    ]);

    return ACTION(() => C.factory.literalTerm(
      C.factory.sourceLocation(token),
      token.image.toLowerCase(),
      C.factory.namedNode(C.factory.sourceLocationNoMaterialize(), CommonIRIs.BOOLEAN),
    ));
  },
};

/**
 * Parses a string literal.
 * [[135]](https://www.w3.org/TR/sparql11-query/#rString)
 */
export const string: SparqlGrammarRule<'string', TermLiteralStr> = <const> {
  name: 'string',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const x = OR([
      { ALT: () => {
        const token = CONSUME(l.terminals.stringLiteral1);
        return <const>[ token, token.image.slice(1, -1) ];
      } },
      { ALT: () => {
        const token = CONSUME(l.terminals.stringLiteral2);
        return <const>[ token, token.image.slice(1, -1) ];
      } },
      { ALT: () => {
        const token = CONSUME(l.terminals.stringLiteralLong1);
        return <const>[ token, token.image.slice(3, -3) ];
      } },
      { ALT: () => {
        const token = CONSUME(l.terminals.stringLiteralLong2);
        return <const>[ token, token.image.slice(3, -3) ];
      } },
    ]);
    // Handle string escapes (19.7). (19.2 is handled at input level.)
    return ACTION(() => {
      const F = C.factory;
      const value = x[1].replaceAll(/\\([tnrbf"'\\])/gu, (_, char: string) => {
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
      return F.literalTerm(F.sourceLocation(x[0]), value);
    });
  },
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
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) =>
    F.isTermNamedPrefixed(ast) ? SUBRULE(prefixedName, ast, undefined) : SUBRULE(iriFull, ast, undefined),
};

export const iriFull: SparqlRule<'iriFull', TermIriFull> = <const> {
  name: 'iriFull',
  impl: ({ ACTION, CONSUME }) => (C) => {
    const iriToken = CONSUME(l.terminals.iriRef);
    return ACTION(() => C.factory.namedNode(C.factory.sourceLocation(iriToken), iriToken.image.slice(1, -1)));
  },
  gImpl: ({ PRINT }) => (ast, { factory }) => {
    factory.printFilter(ast, () => PRINT('<', ast.value, '>'));
  },
};

/**
 * Parses a named node with a prefix. Looks up the prefix in the context and returns the full IRI.
 * [[137]](https://www.w3.org/TR/sparql11-query/#rPrefixedName)
 */
export const prefixedName: SparqlRule<'prefixedName', TermIriPrefixed> = <const> {
  name: 'prefixedName',
  impl: ({ ACTION, CONSUME, OR }) => C => OR([
    { ALT: () => {
      const longName = CONSUME(l.terminals.pNameLn);
      return ACTION(() => {
        const [ prefix, localName ] = longName.image.split(':');
        return C.factory.namedNode(C.factory.sourceLocation(longName), localName, prefix);
      });
    } },
    { ALT: () => {
      const shortName = CONSUME(l.terminals.pNameNs);
      return ACTION(() => C.factory.namedNode(C.factory.sourceLocation(shortName), '', shortName.image.slice(0, -1)));
    } },
  ]),
  gImpl: ({ PRINT_WORD }) => (ast, { factory }) => {
    factory.printFilter(ast, () => PRINT_WORD(ast.prefix, ':', ast.value));
  },
};

export const canCreateBlankNodes = Symbol('canCreateBlankNodes');

/**
 * Parses blank note and throws an error if 'canCreateBlankNodes' is not in the current parserMode.
 * [[138]](https://www.w3.org/TR/sparql11-query/#rBlankNode)
 */
export const blankNode: SparqlRule<'blankNode', TermBlank> = <const> {
  name: 'blankNode',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const result = OR([
      { ALT: () => {
        const labelToken = CONSUME(l.terminals.blankNodeLabel);
        return ACTION(() =>
          C.factory.blankNode(labelToken.image.slice(2), C.factory.sourceLocation(labelToken)));
      } },
      { ALT: () => {
        const anonToken = CONSUME(l.terminals.anon);
        return ACTION(() => C.factory.blankNode(undefined, C.factory.sourceLocation(anonToken)));
      } },
    ]);
    ACTION(() => {
      if (!C.parseMode.has('canCreateBlankNodes')) {
        throw new Error('Blank nodes are not allowed in this context');
      }
    });
    return result;
  },
  gImpl: ({ PRINT_WORD }) => (ast, { factory }) => {
    factory.printFilter(ast, () => PRINT_WORD('_:', ast.label.replace(/^e_/u, '')));
  },
};

export const verbA: SparqlGrammarRule<'VerbA', TermIriFull> = <const> {
  name: 'VerbA',
  impl: ({ ACTION, CONSUME }) => (C) => {
    const token = CONSUME(l.a);
    return ACTION(() => C.factory.namedNode(C.factory.sourceLocation(token), CommonIRIs.TYPE, undefined));
  },
};
