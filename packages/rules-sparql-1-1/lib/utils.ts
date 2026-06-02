import { TransformerSubTyped } from '@traqula/core';
import type { Sparql11Nodes } from './Sparql11types.js';

/**
 * Apply codepoint escape substitution within a string literal or IRI ref chunk, and validate
 * that no lone surrogate (from raw embedded chars) remains after substitution.
 * Per SPARQL spec section 19.2, \uXXXX/\UXXXXXXXX escapes resolve to Unicode codepoints,
 * and surrogate codepoints (U+D800–U+DFFF) are never legal as escaped values.
 */
function processChunk(chunk: string): string {
  const processed = chunk.replaceAll(
    /\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/gu,
    (_, u4: string, u8: string) => {
      const charCode = Number.parseInt(u4 ?? u8, 16);
      if (charCode >= 0xD800 && charCode <= 0xDFFF) {
        throw new Error(`Invalid unicode codepoint of surrogate pair`);
      }
      return String.fromCodePoint(charCode);
    },
  );
  // Validate no lone high surrogate remains (from raw embedded surrogate chars)
  if (/[\uD800-\uDBFF](?:[^\uDC00-\uDFFF]|$)/u.test(processed)) {
    throw new Error(`Invalid unicode codepoint of surrogate pair without corresponding codepoint`);
  }
  return processed;
}

/**
 * Returns true when the character at position `pos` is not a legal IRI-ref body character
 * per the SPARQL grammar production IRIREF := '<' ([^<>"{}|^`\]-[#x00-#x20])* '>'.
 * A '\\' that is NOT the start of a UCHAR (\uXXXX / \UXXXXXXXX) is also invalid.
 */
function isInvalidIriChar(input: string, pos: number): boolean {
  const c = input.codePointAt(pos)!;
  // Excluded from IRIREF body: control chars (#x00-#x20), space, " < > \ ^ ` { | }
  return c <= 0x20 || c === 0x22 || c === 0x3C || c === 0x3E ||
    c === 0x5C || c === 0x5E || c === 0x60 || c === 0x7B || c === 0x7C || c === 0x7D;
}

/**
 * Transform input in accordance to [19.2](https://www.w3.org/TR/sparql11-query/#codepointEscape).
 * Codepoint escapes (\uXXXX / \UXXXXXXXX) are only applied within IRI references and string
 * literals; using them outside those contexts throws an error. Surrogate codepoints are always
 * rejected. Raw lone surrogates embedded in string/IRI chunks are also rejected.
 */
export function sparqlCodepointEscape(input: string): string {
  let result = '';
  let i = 0;

  while (i < input.length) {
    // Skip # comments (pass through to end of line unchanged)
    if (input[i] === '#') {
      const eol = input.indexOf('\n', i);
      if (eol === -1) {
        result += input.slice(i);
        return result;
      }
      result += input.slice(i, eol + 1);
      i = eol + 1;
      continue;
    }

    // Long string literals — must be checked before short strings
    if (input.startsWith('"""', i) || input.startsWith('\'\'\'', i)) {
      const delim = input.startsWith('"""', i) ? '"""' : '\'\'\'';
      let end = i + 3;
      while (end < input.length) {
        if (input[end] === '\\') {
          // Skip escape sequence (incl. \uXXXX prefix; processChunk handles expansion)
          end += 2;
        } else if (input.startsWith(delim, end)) {
          end += 3;
          break;
        } else {
          end++;
        }
      }
      result += processChunk(input.slice(i, end));
      i = end;
      continue;
    }

    // Short string literals
    if (input[i] === '"' || input[i] === '\'') {
      const delim = input[i];
      let end = i + 1;
      while (end < input.length && input[end] !== delim && input[end] !== '\n' && input[end] !== '\r') {
        if (input[end] === '\\') {
          // Skip escape sequence
          end += 2;
        } else {
          end++;
        }
      }
      if (end < input.length && input[end] === delim) {
        end++;
      }
      result += processChunk(input.slice(i, end));
      i = end;
      continue;
    }

    // IRI references: '<' not followed by '<' (which is the SPARQL 1.2 '<<' triple-term delimiter)
    if (input[i] === '<' && input[i + 1] !== '<') {
      // Validate IRI body characters to distinguish an IRI ref from a comparison operator.
      // Abort and treat '<' as a plain character if any invalid IRI char is found before '>'.
      let end = i + 1;
      let validIriRef = true;
      while (end < input.length && input[end] !== '>') {
        if (input[end] === '\\' && (input[end + 1] === 'u' || input[end + 1] === 'U')) {
          // Valid UCHAR prefix inside IRI; processChunk will expand it
          end += 2;
        } else if (isInvalidIriChar(input, end)) {
          validIriRef = false;
          break;
        } else {
          end++;
        }
      }
      if (validIriRef && end < input.length) {
        // Consume closing '>'
        end++;
        result += processChunk(input.slice(i, end));
        i = end;
        continue;
      }
      // Not a valid IRI ref (e.g. comparison operator) — fall through
    }

    // Codepoint escape outside an allowed context is an error
    if (input[i] === '\\' && (input[i + 1] === 'u' || input[i + 1] === 'U')) {
      throw new Error(`Codepoint escape not allowed outside of string literals or IRI references`);
    }

    result += input[i++];
  }

  return result;
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
