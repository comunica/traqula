import { TransformerSubTyped, traqulaIndentation, traqulaNewlineAlternative } from '@traqula/core';
import { AstFactory } from './AstFactory.js';
import type { SparqlContext, SparqlGeneratorContext } from './sparql12HelperTypes.js';
import type { Sparql12Nodes } from './sparql12Types.js';

/**
 * Decode UCHAR codepoint escapes (\\uXXXX / \\UXXXXXXXX) within a string according to
 * [SPARQL 1.2 §19.2](https://www.w3.org/TR/sparql12-query/#sec-escapes).
 *
 * Unlike the SPARQL 1.1 variant, this function rejects surrogate code points (U+D800–U+DFFF)
 * even when they would form a valid surrogate pair.
 */
export function sparql12CodepointEscape(input: string): string {
  return input.replaceAll(
    /\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/gu,
    (_, unicode4: string | undefined, unicode8: string | undefined) => {
      const hex = (unicode4 ?? unicode8)!;
      const codePoint = Number.parseInt(hex, 16);
      if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
        throw new Error(`Illegal codepoint escape: surrogate code point U+${hex.toUpperCase()}`);
      }
      return String.fromCodePoint(codePoint);
    },
  );
}

export function completeParseContext(
  context: Partial<SparqlContext>,
): SparqlContext {
  return {
    astFactory: context.astFactory ?? new AstFactory({ tracksSourceLocation: false }),
    baseIRI: context.baseIRI,
    prefixes: Object.assign(Object.create(null), context.prefixes),
    parseMode: context.parseMode ? new Set(context.parseMode) : new Set([ 'canParseVars', 'canCreateBlankNodes' ]),
    skipValidation: context.skipValidation ?? false,
    codepointEscape: context.codepointEscape ?? sparql12CodepointEscape,
  };
}

export function completeGeneratorContext(
  context: Partial<SparqlGeneratorContext & { offset?: number }>,
): SparqlGeneratorContext & { offset?: number } {
  return {
    astFactory: context.astFactory ?? new AstFactory(),
    origSource: context.origSource ?? '',
    offset: context.offset,
    indentInc: context.indentInc ?? 2,
    [traqulaIndentation]: context[traqulaIndentation] ?? 0,
    [traqulaNewlineAlternative]: context[traqulaNewlineAlternative] ?? ' ',
  };
}

export function copyParseContext<T extends
Partial<SparqlContext & SparqlGeneratorContext & { origSource: string; offset?: number }>>(
  context: T,
): T {
  return {
    ...context,
    prefixes: Object.assign(Object.create(null), context.prefixes),
    parseMode: new Set(context.parseMode),
  };
}

export class AstTransformer extends TransformerSubTyped<Sparql12Nodes> {}
