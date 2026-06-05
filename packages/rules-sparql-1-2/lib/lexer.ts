/* eslint-disable require-unicode-regexp,no-control-regex */
import { LexerBuilder, createToken } from '@traqula/core';
import { lex as l11 } from '@traqula/rules-sparql-1-1';

export const version = createToken({ name: 'Version', pattern: /version/i, label: 'version identifier' });
export const tilde = createToken({ name: 'Tilde', pattern: '~', label: '~' });
export const annotationOpen = createToken({ name: 'AnnotationOpen', pattern: '{|', label: `Annotation Open: {|` });
export const annotationClose = createToken({ name: 'AnnotationClose', pattern: '|}', label: 'Annotation Close |}' });
export const reificationOpen = createToken({ name: 'ReificationOpen', pattern: '<<', label: 'Reification open <<' });
export const reificationClose = createToken({ name: 'ReificationClose', pattern: '>>', label: 'Reification close >>' });
export const tripleTermOpen = createToken({ name: 'TripleTermOpen', pattern: '<<(', label: 'Triple Term Open <<(' });
export const tripleTermClose = createToken({ name: 'TripleTermClose', pattern: ')>>', label: 'Triple Term Close )>>' });

export const buildInLangDir = createToken({ name: 'BuiltInLangdir', pattern: /langdir/i, label: 'LANGDIR' });
export const buildInStrLangDir = createToken({
  name: 'BuiltInStrLangdir',
  pattern: /strlangdir/i,
  label: 'STRLANGDIR',
});
export const buildInHasLang = createToken({ name: 'BuiltInHasLang', pattern: /haslang/i, label: 'hasLANG' });
export const buildInHasLangDir = createToken({
  name: 'BuiltInHasLangdir',
  pattern: /haslangdir/i,
  label: 'hasLANGDIR',
});
export const buildInIsTRIPLE = createToken({ name: 'BuiltInIsTriple', pattern: /istriple/i, label: 'isTRIPLE' });
export const buildInTRIPLE = createToken({ name: 'BuiltInTriple', pattern: /triple/i, label: 'TRIPLE' });
export const buildInSUBJECT = createToken({ name: 'BuiltInSubject', pattern: /subject/i, label: 'SUBJECT' });
export const buildInPREDICATE = createToken({ name: 'BuiltInPredicate', pattern: /predicate/i, label: 'PREDICATE' });
export const buildInOBJECT = createToken({ name: 'BuiltInObject', pattern: /object/i, label: 'OBJECT' });

export const LANG_DIR = createToken({
  name: 'LANG_DIR',
  pattern: /@[a-z]+(?:-[\da-z]+)*(?:--[a-z]+)?/i,
  label: 'LANG_DIR',
});

/**
 * UCHAR: \uXXXX or \UXXXXXXXX  (SPARQL 1.2 §19.2)
 * Used inside IRI references and string literals only.
 */
const ucharSource = /\\u[\dA-Fa-f]{4}|\\U[\dA-Fa-f]{8}/.source;
/**
 * ECHAR source !(same as sparql-1-1 echarPattern)
 */
const echarSource = /\\["'\\bfnrt]/.source;
/**
 * Character class for valid IRI characters (excluding backslash to allow UCHAR alternation)
 * Same as SPARQL 1.1
 */
const iriCharSource = /[^\u0000-\u0020"<>\\^`{|}]/.source;

/**
 * [[161]](https://www.w3.org/TR/sparql12-query/#rIRIREF)
 * Extends the SPARQL 1.1 IRI token to allow UCHAR codepoint escapes inside angle-bracket IRIs.
 */
export const iriRef = createToken({
  name: 'IriRef',
  pattern: new RegExp(`<((${iriCharSource})|(${ucharSource}))*>`),
});

/**
 * [[163]](https://www.w3.org/TR/sparql12-query/#rSTRING_LITERAL1)
 * Extends the SPARQL 1.1 string token to allow UCHAR codepoint escapes.
 */
export const stringLiteral1 = createToken({
  name: 'StringLiteral1',
  pattern: new RegExp(`'(([^\\u0027\\u005C\\u000A\u000D])|(${echarSource})|(${ucharSource}))*'`),
});

/**
 * [[164]](https://www.w3.org/TR/sparql12-query/#rSTRING_LITERAL2)
 * Extends the SPARQL 1.1 string token to allow UCHAR codepoint escapes.
 */
export const stringLiteral2 = createToken({
  name: 'StringLiteral2',
  pattern: new RegExp(`"(([^\\u0022\\u005C\\u000A\\u000D])|(${echarSource})|(${ucharSource}))*"`),
});

/**
 * [[165]](https://www.w3.org/TR/sparql12-query/#rSTRING_LITERAL_LONG1)
 * Extends the SPARQL 1.1 string token to allow UCHAR codepoint escapes.
 */
export const stringLiteralLong1 = createToken({
  name: 'StringLiteralLong1',
  pattern: new RegExp(`'''(('|(''))?([^'\\\\]|(${echarSource})|(${ucharSource})))*'''`),
});

/**
 * [[166]](https://www.w3.org/TR/sparql12-query/#rSTRING_LITERAL_LONG2)
 * Extends the SPARQL 1.1 string token to allow UCHAR codepoint escapes.
 */
export const stringLiteralLong2 = createToken({
  name: 'StringLiteralLong2',
  pattern: new RegExp(`"""(("|(""))?([^"\\\\]|(${echarSource})|(${ucharSource})))*"""`),
});

export const sparql12LexerBuilder = LexerBuilder
  .create(l11.sparql11LexerBuilder)
  .addBefore(
    l11.symbols.logicAnd,
    tilde,
    annotationOpen,
    annotationClose,
    tripleTermOpen,
    tripleTermClose,
    reificationOpen,
    reificationClose,
    version,
  )
  .addBefore(
    l11.builtIn.langmatches,
    buildInLangDir,
    buildInStrLangDir,
    buildInHasLangDir,
    buildInHasLang,
    buildInIsTRIPLE,
    buildInTRIPLE,
    buildInSUBJECT,
    buildInPREDICATE,
    buildInOBJECT,
  )
  .addBefore(l11.terminals.langTag, LANG_DIR)
  .deleteToken(l11.terminals.langTag.name)
  // Replace IRI and string tokens with UCHAR-aware versions for SPARQL 1.2.
  .replace(iriRef)
  .replace(stringLiteral1)
  .replace(stringLiteral2)
  .replace(stringLiteralLong1)
  .replace(stringLiteralLong2);
