import { TransformerSubTyped } from '@traqula/core';
import { pnLocalEscPattern } from './lexer/lexerPatterns.js';
import type { Sparql11Nodes, TermIri } from './Sparql11types.js';

/**
 * Transform input in accordance to [19.2](https://www.w3.org/TR/sparql11-query/#codepointEscape)
 * and validate unicode codepoints.
 */
export function sparqlCodepointEscape(input: string): string {
  const sanitizedInput = input.replaceAll(
    /\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/gu,
    (_, unicode4: string, unicode8: string) => {
      if (unicode4) {
        const charCode = Number.parseInt(unicode4, 16);
        return String.fromCodePoint(charCode);
      }
      const charCode = Number.parseInt(unicode8, 16);
      if (charCode < 0xFFFF) {
        return String.fromCodePoint(charCode);
      }
      const substractedCharCode = charCode - 0x10000;
      return String.fromCodePoint(0xD800 + (substractedCharCode >> 10), 0xDC00 + (substractedCharCode & 0x3FF));
    },
  );
  // Test for invalid unicode surrogate pairs
  if (/[\uD800-\uDBFF](?:[^\uDC00-\uDFFF]|$)/u.test(sanitizedInput)) {
    throw new Error(`Invalid unicode codepoint of surrogate pair without corresponding codepoint`);
  }
  return sanitizedInput;
}

/**
 * Common IRI constants used across SPARQL parsing and generation.
 * Includes XSD datatypes (BOOLEAN, INTEGER, DECIMAL, DOUBLE, STRING)
 * and RDF vocabulary (FIRST, REST, NIL, TYPE).
 */
export enum CommonIRIs {
  // XSD
  BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean',
  INTEGER = 'http://www.w3.org/2001/XMLSchema#integer',
  DECIMAL = 'http://www.w3.org/2001/XMLSchema#decimal',
  DOUBLE = 'http://www.w3.org/2001/XMLSchema#double',
  STRING = 'http://www.w3.org/2001/XMLSchema#string',
  // RDF
  FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
  REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
  NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil',
  TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
}

/**
 * A {@link TransformerSubTyped} specialized for the SPARQL 1.1 AST node types.
 * Provides a type-safe visitor/transformer that dispatches based on node `type` and `subType` fields.
 *
 * @example
 * ```typescript
 * const transformer = new AstTransformer();
 * transformer.transformNodeSpecific<'safe', typeof ast>(ast, {
 *   query: { select: (node) => { ... } },
 * });
 * ```
 */
export class AstTransformer extends TransformerSubTyped<Sparql11Nodes> {}

/**
 * Absolute IRIs start with a scheme - [RFC 3986, section 3.1](https://www.rfc-editor.org/rfc/rfc3986#section-3.1)
 */
const absoluteIriRegex = /^[a-z][\d+.a-z-]*:/iu;

/**
 * [RFC 3986, appendix B](https://www.rfc-editor.org/rfc/rfc3986#appendix-B). Matches every string.
 */
const iriComponentsRegex = /^(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/su;

/**
 * {@link iriComponentsRegex} without the scheme, so an invalid relative IRI like '1a:b' is kept whole as a path.
 */
const relativeIriComponentsRegex = /^(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/su;

/**
 * [RFC 3986, section 5.2.4](https://www.rfc-editor.org/rfc/rfc3986#section-5.2.4)
 */
function removeDotSegments(path: string): string {
  let input = path;
  let output = '';
  const removeLastOutputSegment = (): void => {
    const pos = output.lastIndexOf('/');
    output = output.slice(0, pos > 0 ? pos : 0);
  };
  while (input.length > 0) {
    if (input.startsWith('../')) {
      input = input.slice(3);
    } else if (input.startsWith('./') || input.startsWith('/./')) {
      input = input.slice(2);
    } else if (input === '/.') {
      input = '/';
    } else if (input.startsWith('/../')) {
      input = input.slice(3);
      removeLastOutputSegment();
    } else if (input === '/..') {
      input = '/';
      removeLastOutputSegment();
    } else if (input === '.' || input === '..') {
      input = '';
    } else {
      // Move the first path segment (including its leading '/', if any) to the output
      const segmentEnd = input.indexOf('/', 1);
      const segment = segmentEnd === -1 ? input : input.slice(0, segmentEnd);
      output += segment;
      input = input.slice(segment.length);
    }
  }
  return output;
}

/**
 * Resolves relative IRIs against the base IRI as described in the [Syntax for IRIs](https://www.w3.org/TR/sparql12-query/#QSynIRI),
 * using [RFC 3986, section 5.2](https://www.rfc-editor.org/rfc/rfc3986#section-5.2) without normalization.
 * Absolute IRIs are returned unmodified.
 */
export function resolveIRI(iri: string, base: string | undefined): string {
  if (absoluteIriRegex.test(iri)) {
    return iri;
  }
  if (!base) {
    throw new Error(`Cannot resolve relative IRI ${iri} because no base IRI was set.`);
  }
  const [ , relativeAuthority, relativePath, relativeQuery, relativeFragment ] =
    relativeIriComponentsRegex.exec(iri)!;
  const [ , baseScheme, baseAuthority, basePath, baseQuery ] = iriComponentsRegex.exec(base)!;

  // Transform references - https://www.rfc-editor.org/rfc/rfc3986#section-5.2.2
  let resolvedAuthority: string | undefined;
  let resolvedPath: string;
  let resolvedQuery: string | undefined;
  if (relativeAuthority === undefined) {
    if (relativePath === '') {
      resolvedPath = basePath;
      resolvedQuery = relativeQuery ?? baseQuery;
    } else {
      if (relativePath.startsWith('/')) {
        resolvedPath = removeDotSegments(relativePath);
      } else if (baseAuthority !== undefined && basePath === '') {
        // Merge paths - https://www.rfc-editor.org/rfc/rfc3986#section-5.2.3
        resolvedPath = removeDotSegments(`/${relativePath}`);
      } else {
        resolvedPath = removeDotSegments(basePath.slice(0, basePath.lastIndexOf('/') + 1) + relativePath);
      }
      resolvedQuery = relativeQuery;
    }
    resolvedAuthority = baseAuthority;
  } else {
    resolvedAuthority = relativeAuthority;
    resolvedPath = removeDotSegments(relativePath);
    resolvedQuery = relativeQuery;
  }

  // Component recomposition - https://www.rfc-editor.org/rfc/rfc3986#section-5.3
  // Like the RFC, a path starting with '//' is not guarded against: '..//g' against 'urn:x/y' gives 'urn://g'.
  let result = baseScheme === undefined ? '' : `${baseScheme}:`;
  if (resolvedAuthority !== undefined) {
    result += `//${resolvedAuthority}`;
  }
  result += resolvedPath;
  if (resolvedQuery !== undefined) {
    result += `?${resolvedQuery}`;
  }
  if (relativeFragment !== undefined) {
    result += `#${relativeFragment}`;
  }
  return result;
}

const pnLocalEscGlobal = new RegExp(pnLocalEscPattern.source, 'gu');

/**
 * Returns the IRI an IRI term denotes:
 * a prefixed name is expanded using the given prefixes, and a relative IRI is resolved against the base IRI.
 * Throws when the prefix is unknown, or when the IRI is relative and no base IRI is given.
 * @param term - The IRI term, either a full IRI or a prefixed name.
 * @param prefixes - The prefixes in scope, mapping each prefix to its IRI.
 * @param baseIRI - The base IRI in scope.
 */
export function resolveTermIri(term: TermIri, prefixes: Record<string, string>, baseIRI: string | undefined): string {
  let fullIri = term.value;
  const prefix = (<{ prefix?: unknown }> term).prefix;
  if (typeof prefix === 'string') {
    const expanded = prefixes[prefix];
    if (!expanded) {
      throw new Error(`Unknown prefix: ${prefix}`);
    }
    // Remove the backslash of PN_LOCAL_ESC escapes, percent-encodings (PLX) are kept as is.
    // "The RDF string of the IRI is formed by unescaping the reserved characters in the second argument, PN_LOCAL,
    // and concatenating this onto the namespace." - https://www.w3.org/TR/rdf12-turtle/#sec-parsing-terms
    // Percent-encodings: "These sequences are not decoded during processing."
    // - https://www.w3.org/TR/sparql12-query/#sec-escapes
    fullIri = expanded + term.value.replaceAll(pnLocalEscGlobal, escaped => escaped.slice(1));
  }
  return resolveIRI(fullIri, baseIRI);
}
