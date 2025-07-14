import type { TraqulaFactory } from '@traqula/rules-sparql-1-1';
import { Factory } from './Factory';
import type { SparqlContext } from './sparql12HelperTypes';

export function completeParseContext(
  context: Partial<SparqlContext & { origSource: string; offset?: number }>,
): SparqlContext & { origSource: string; offset?: number } {
  return {
    factory: <TraqulaFactory & Factory> context.factory ?? new Factory(),
    baseIRI: context.baseIRI,
    prefixes: { ...context.prefixes },
    origSource: context.origSource ?? '',
    offset: context.offset,
    parseMode: context.parseMode ? new Set(context.parseMode) : new Set([ 'canParseVars', 'canCreateBlankNodes' ]),
    skipValidation: context.skipValidation ?? false,
  };
}
