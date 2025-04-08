import type { NamedNode } from 'rdf-data-factory';
import { CommonIRIs, resolveIRI } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type { BlankTerm, IriTerm, LiteralTerm, SparqlGrammarRule, SparqlRule } from '../Sparql11types';

/**
 * Parses an RDF literal, in the form of {value}@{lang} or {value}^^{datatype}.
 * [[129]](https://www.w3.org/TR/sparql11-query/#rRDFLiteral)
 */
export const rdfLiteral: SparqlRule<'rdfLiteral', LiteralTerm> = <const> {
  name: 'rdfLiteral',
  impl: ({ ACTION, SUBRULE, CONSUME, OPTION, OR }) => (C) => {
    const value = SUBRULE(string, undefined);
    const languageOrDatatype = OPTION(() => OR<string | NamedNode>([
      { ALT: () => CONSUME(l.terminals.langTag).image.slice(1) },
      {
        ALT: () => {
          CONSUME(l.symbols.hathat);
          return SUBRULE(iri, undefined);
        },
      },
    ]));
    return ACTION(() => C.dataFactory.literal(value, languageOrDatatype));
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const lexical = SUBRULE(string, ast.value, undefined);
    if (ast.direction) {
      return `${lexical}@${ast.language}--${ast.direction}`;
    }
    if (ast.language) {
      return `${lexical}@${ast.language}`;
    }
    return `${lexical}^^<${ast.datatype.value}>`;
  },
};

/**
 * Parses a numeric literal.
 * [[130]](https://www.w3.org/TR/sparql11-query/#rNumericLiteral)
 */
export const numericLiteral: SparqlGrammarRule<'numericLiteral', LiteralTerm> = <const> {
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
export const numericLiteralUnsigned: SparqlGrammarRule<'numericLiteralUnsigned', LiteralTerm> = <const> {
  name: 'numericLiteralUnsigned',
  impl: ({ ACTION, CONSUME, OR }) => C => OR([
    { ALT: () => {
      const val = CONSUME(l.terminals.integer).image;
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.INTEGER)));
    } },
    { ALT: () => {
      const val = CONSUME(l.terminals.decimal).image;
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.DECIMAL)));
    } },
    { ALT: () => {
      const val = CONSUME(l.terminals.double).image;
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.DOUBLE)));
    } },
  ]),
};

/**
 * Parses a positive numeric literal.
 * [[132]](https://www.w3.org/TR/sparql11-query/#rNumericLiteralPositive)
 */
export const numericLiteralPositive: SparqlGrammarRule<'numericLiteralPositive', LiteralTerm> = <const> {
  name: 'numericLiteralPositive',
  impl: ({ ACTION, CONSUME, OR }) => C => OR([
    { ALT: () => {
      const val = CONSUME(l.terminals.integerPositive).image;
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.INTEGER)));
    } },
    { ALT: () => {
      const val = CONSUME(l.terminals.decimalPositive).image;
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.DECIMAL)));
    } },
    { ALT: () => {
      const val = CONSUME(l.terminals.doublePositive).image;
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.DOUBLE)));
    } },
  ]),
};

/**
 * Parses a negative numeric literal.
 * [[133]](https://www.w3.org/TR/sparql11-query/#rNumericLiteralNegative)
 */
export const numericLiteralNegative: SparqlGrammarRule<'numericLiteralNegative', LiteralTerm> = <const> {
  name: 'numericLiteralNegative',
  impl: ({ ACTION, CONSUME, OR }) => C => OR([
    { ALT: () => {
      const val = CONSUME(l.terminals.integerNegative).image;
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.INTEGER)));
    } },
    { ALT: () => {
      const val = CONSUME(l.terminals.decimalNegative).image;
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.DECIMAL)));
    } },
    { ALT: () => {
      const val = CONSUME(l.terminals.doubleNegative).image;
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.DOUBLE)));
    } },
  ]),
};

/**
 * Parses a boolean literal.
 * [[134]](https://www.w3.org/TR/sparql11-query/#rBooleanLiteral)
 */
export const booleanLiteral: SparqlGrammarRule<'booleanLiteral', LiteralTerm> = <const> {
  name: 'booleanLiteral',
  impl: ({ ACTION, CONSUME, OR }) => C => OR([
    { ALT: () => {
      const val = CONSUME(l.true_).image.toLowerCase();
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.BOOLEAN)));
    } },
    { ALT: () => {
      const val = CONSUME(l.false_).image.toLowerCase();
      return ACTION(() => C.dataFactory.literal(val, C.dataFactory.namedNode(CommonIRIs.BOOLEAN)));
    } },
  ]),
};

/**
 * Parses a string literal.
 * [[135]](https://www.w3.org/TR/sparql11-query/#rString)
 */
export const string: SparqlRule<'string', string> = <const> {
  name: 'string',
  impl: ({ ACTION, CONSUME, OR }) => () => {
    const rawString = OR([
      { ALT: () => CONSUME(l.terminals.stringLiteral1).image.slice(1, -1) },
      { ALT: () => CONSUME(l.terminals.stringLiteral2).image.slice(1, -1) },
      { ALT: () => CONSUME(l.terminals.stringLiteralLong1).image.slice(3, -3) },
      { ALT: () => CONSUME(l.terminals.stringLiteralLong2).image.slice(3, -3) },
    ]);
    // Handle string escapes (19.7). (19.2 is handled at input level.)
    return ACTION(() => rawString.replaceAll(/\\([tnrbf"'\\])/gu, (_, char: string) => {
      switch (char) {
        case 't': return '\t';
        case 'n': return '\n';
        case 'r': return '\r';
        case 'b': return '\b';
        case 'f': return '\f';
        default: return char;
      }
    }));
  },
  gImpl: () => (ast) => {
    const lexical = ast.replaceAll(/["\\\t\n\r\b\f]/gu, (char) => {
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
  },
};

/**
 * Parses a named node, either as an IRI or as a prefixed name.
 * [[136]](https://www.w3.org/TR/sparql11-query/#riri)
 */
export const iri: SparqlRule<'iri', IriTerm> = <const> {
  name: 'iri',
  impl: ({ ACTION, SUBRULE, CONSUME, OR }) => C => OR([
    { ALT: () => {
      const iriVal = CONSUME(l.terminals.iriRef).image.slice(1, -1);
      return ACTION(() => C.dataFactory.namedNode(resolveIRI(iriVal, C.baseIRI)));
    } },
    { ALT: () => SUBRULE(prefixedName, undefined) },
  ]),
  gImpl: () => ast => `<${ast.value}>`,
};

/**
 * Parses a named node with a prefix. Looks up the prefix in the context and returns the full IRI.
 * [[137]](https://www.w3.org/TR/sparql11-query/#rPrefixedName)
 */
export const prefixedName: SparqlGrammarRule<'prefixedName', IriTerm> = <const> {
  name: 'prefixedName',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const fullStr = OR([
      { ALT: () => CONSUME(l.terminals.pNameLn).image },
      { ALT: () => CONSUME(l.terminals.pNameNs).image },
    ]);
    return ACTION(() => {
      const [ prefix, localName ] = fullStr.split(':');
      const value = C.prefixes[prefix];
      if (value === undefined) {
        throw new Error(`Unknown prefix: ${prefix}`);
      }
      return C.dataFactory.namedNode(resolveIRI(value + localName, C.baseIRI));
    });
  },
};

export const canCreateBlankNodes = Symbol('canCreateBlankNodes');

/**
 * Parses blank note and throws an error if 'canCreateBlankNodes' is not in the current parserMode.
 * [[138]](https://www.w3.org/TR/sparql11-query/#rBlankNode)
 */
export const blankNode: SparqlRule<'blankNode', BlankTerm> = <const> {
  name: 'blankNode',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const result = OR([
      {
        ALT: () => {
          const label = CONSUME(l.terminals.blankNodeLabel).image;
          return ACTION(() => C.dataFactory.blankNode(label.replace('_:', 'e_')));
        },
      },
      {
        ALT: () => {
          CONSUME(l.terminals.anon);
          return ACTION(() => C.dataFactory.blankNode());
        },
      },
    ]);
    ACTION(() => {
      if (!C.parseMode.has('canCreateBlankNodes')) {
        throw new Error('Blank nodes are not allowed in this context');
      }
    });
    return result;
  },
  gImpl: () => ast => `_:${ast.value}`,
};
