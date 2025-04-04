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

export const rdfLiteral: SparqlRule<'rdfLiteral', TermLiteral> = <const> {
  name: 'rdfLiteral',
  impl: ({ ACTION, SUBRULE1, CONSUME, OPTION, OR }) => (C) => {
    const value = SUBRULE1(string, undefined);
    return OPTION(() => OR<TermLiteral>([
      { ALT: () => {
        const lang = CONSUME(l.terminals.langTag);
        return ACTION(() => C.factory.literalTerm(
          value.value,
          // Normalized to lowercase as per:
          // 1. https://www.w3.org/TR/rdf11-concepts/#h3_section-Graph-Literal
          // 2. https://www.w3.org/TR/rdf12-concepts/#changes-12
          lang.image.slice(1).toLowerCase(),
          value.loc ? { start: value.loc.start, end: lang.endOffset! } : undefined,
        ));
      } },
      { ALT: () => {
        CONSUME(l.symbols.hathat);
        const iriVal = SUBRULE1(iri, undefined);
        return ACTION(() => C.factory.literalTerm(
          value.value,
          iriVal,
          value.loc && iriVal.loc ? { start: value.loc.start, end: iriVal.loc.end } : undefined,
        ));
      } },
    ])) ?? value;
  },
  gImpl: ({ SUBRULE, PRINT, CATCHUP, PUSH_SOURCE, POP_SOURCE }) => (ast) => {
    if (ast.loc?.source) {
      PUSH_SOURCE(ast.loc.source);
    }
    CATCHUP(ast.loc?.start);

    if (ast.loc) {
      if (ast.langOrIri && typeof ast.langOrIri !== 'string') {
        SUBRULE(iri, ast.langOrIri, undefined);
      }
    } else {
      PRINT('"');
      PRINT(ast.value.replaceAll('"', '\\"'));
      PRINT('"');
      if (ast.langOrIri) {
        if (typeof ast.langOrIri === 'string') {
          PRINT('@');
          PRINT(ast.langOrIri);
        } else {
          PRINT('^^');
          SUBRULE(iri, ast.langOrIri, undefined);
        }
      }
    }

    CATCHUP(ast.loc?.end);
    if (ast.loc?.source) {
      POP_SOURCE();
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
      parsed[0].image,
      C.factory.namedNode(parsed[1]),
      C.factory.sourceLocation(parsed[0]),
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
      parsed[0].image,
      C.factory.namedNode(parsed[1]),
      C.factory.sourceLocation(parsed[0]),
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
      parsed[0].image,
      C.factory.namedNode(parsed[1]),
      C.factory.sourceLocation(parsed[0]),
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
      token.image.toLowerCase(),
      C.factory.namedNode(CommonIRIs.BOOLEAN),
      C.factory.sourceLocation(token),
    ));
  },
};

/**
 * Parses a string literal.
 * [[135]](https://www.w3.org/TR/sparql11-query/#rString)
 */
export const string: SparqlRule<'string', TermLiteralStr> = <const> {
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
      return F.literalTerm(
        value,
        undefined,
        F.sourceLocation(x[0]),
      );
    });
  },
  gImpl: () => () => '',
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
    F.isTermIriPrefixed(ast) ? SUBRULE(prefixedName, ast, undefined) : SUBRULE(iriFull, ast, undefined),
};

export const iriFull: SparqlRule<'iriFull', TermIriFull> = <const> {
  name: 'iriFull',
  impl: ({ ACTION, CONSUME }) => (C) => {
    const iriToken = CONSUME(l.terminals.iriRef);
    return ACTION(() => C.factory.namedNode(
      iriToken.image.slice(1, -1),
      undefined,
      C.factory.sourceLocation(iriToken),
    ));
  },
  gImpl: ({ PRINT, CATCHUP, PUSH_SOURCE, POP_SOURCE }) => (ast) => {
    if (ast.loc?.source) {
      PUSH_SOURCE(ast.loc.source);
    }
    CATCHUP(ast.loc?.start);

    if (!ast.loc) {
      PRINT('<');
      PRINT(ast.value);
      PRINT('>');
    }

    CATCHUP(ast.loc?.end);
    if (ast.loc?.source) {
      POP_SOURCE();
    }
  },
};

/**
 * Parses a named node with a prefix. Looks up the prefix in the context and returns the full IRI.
 * [[137]](https://www.w3.org/TR/sparql11-query/#rPrefixedName)
 */
export const prefixedName: SparqlRule<'prefixedName', TermIriPrefixed> = <const> {
  name: 'prefixedName',
  impl: ({ ACTION, CONSUME, OR }) => C => OR<TermIriPrefixed>([
    { ALT: () => {
      const longName = CONSUME(l.terminals.pNameLn);
      return ACTION(() => {
        const [ prefix, localName ] = longName.image.split(':');
        return C.factory.namedNode(localName, prefix, C.factory.sourceLocation(longName));
      });
    } },
    { ALT: () => {
      const shortName = CONSUME(l.terminals.pNameNs);
      return ACTION(() => C.factory.namedNode(
        '',
        shortName.image.slice(0, -1),
        C.factory.sourceLocation(shortName),
      ));
    } },
  ]),
  gImpl: ({ PRINT, CATCHUP, PUSH_SOURCE, POP_SOURCE }) => (ast) => {
    if (ast.loc?.source) {
      PUSH_SOURCE(ast.loc.source);
    }
    CATCHUP(ast.loc?.start);

    if (!ast.loc) {
      PRINT(' ');
      PRINT(ast.prefix);
      PRINT(':');
      PRINT(ast.value);
      PRINT(' ');
    }

    CATCHUP(ast.loc?.end);
    if (ast.loc?.source) {
      POP_SOURCE();
    }
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
  gImpl: () => () => '',
};

export const verbA: SparqlRule<'VerbA', TermIriFull> = <const> {
  name: 'VerbA',
  impl: ({ ACTION, CONSUME }) => (C) => {
    const token = CONSUME(l.a);
    return ACTION(() => C.factory.namedNode(CommonIRIs.TYPE, undefined, C.factory.sourceLocation(token)));
  },
  gImpl: () => () => '',
};
