import { AstFactory } from './AstFactory.js';
import type { SparqlContext } from './sparql12HelperTypes.js';

export function completeParseContext(
  context: Partial<SparqlContext & { origSource: string; offset?: number }>,
): SparqlContext & { origSource: string; offset?: number } {
  return {
    factory: context.factory ?? new AstFactory(),
    baseIRI: context.baseIRI,
    prefixes: { ...context.prefixes },
    origSource: context.origSource ?? '',
    offset: context.offset,
    parseMode: context.parseMode ? new Set(context.parseMode) : new Set([ 'canParseVars', 'canCreateBlankNodes' ]),
    skipValidation: context.skipValidation ?? false,
  };
}
