import { TransformerSubType, traqulaIndentation } from '@traqula/core';
import { AstFactory } from './AstFactory.js';
import type { SparqlContext, SparqlGeneratorContext } from './sparql12HelperTypes.js';
import type { Sparql12Nodes } from './sparql12Types.js';

export function completeParseContext(
  context: Partial<SparqlContext & SparqlGeneratorContext & { origSource: string; offset?: number }>,
): SparqlContext & SparqlGeneratorContext & { origSource: string; offset?: number } {
  return {
    astFactory: context.astFactory ?? new AstFactory(),
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

export class AstTransformer extends TransformerSubType<Sparql12Nodes> {}
