import { traqulaIndentation } from '@traqula/core';
import { Factory } from './Factory.js';
import type { SparqlContext, SparqlGeneratorContext } from './sparql12HelperTypes.js';

export function completeParseContext(
  context: Partial<SparqlContext & SparqlGeneratorContext & { origSource: string; offset?: number }>,
): SparqlContext & SparqlGeneratorContext & { origSource: string; offset?: number } {
  return {
    factory: context.factory ?? new Factory(),
    baseIRI: context.baseIRI,
    prefixes: { ...context.prefixes },
    origSource: context.origSource ?? '',
    offset: context.offset,
    parseMode: context.parseMode ? new Set(context.parseMode) : new Set([ 'canParseVars', 'canCreateBlankNodes' ]),
    skipValidation: context.skipValidation ?? false,
    indentInc: context.indentInc ?? 2,
    [traqulaIndentation]: context[traqulaIndentation] ?? 0,
  };
}
