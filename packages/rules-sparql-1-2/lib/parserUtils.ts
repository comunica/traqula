import {
  TransformerSubTyped,
  traqulaIndentation,
  traqulaNewlineAlternative,
  visitOnlyKnownKeys,
} from '@traqula/core';
import { AstFactory } from './AstFactory.js';
import type { SparqlContext, SparqlGeneratorContext } from './sparql12HelperTypes.js';
import type { Sparql12Nodes } from './sparql12Types.js';

/**
 * Decode UCHAR codepoint escapes (\\uXXXX / \\UXXXXXXXX) within a string according to
 * [SPARQL 1.2 §19.2](https://www.w3.org/TR/sparql12-query/#sec-escapes).
 *
 * Unlike the SPARQL 1.1 variant, this function rejects surrogate code points (U+D800–U+DFFF)
 * even when they would form a valid surrogate pair.
 * @deprecated will be removed in next MAJOR in favor of the less usecase dependent {@link decodeUchar}.
 */
export function sparql12CodepointEscape(input: string): string {
  return input.replaceAll(
    /\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/gu,
    (_, unicode4: string | undefined, unicode8: string | undefined) =>
      decodeUchar((unicode4 ?? unicode8)!),
  );
}

export function decodeUchar(hex: string): string {
  const codePoint = Number.parseInt(hex, 16);
  if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
    throw new Error(`Illegal codepoint escape: surrogate code point U+${hex.toUpperCase()}`);
  }
  return String.fromCodePoint(codePoint);
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
    /**
     * @deprecated since it cannot be used for string decoding.
     */
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

/**
 * Contexts per node type that only visit the keys known for that type, see {@link visitOnlyKnownKeys}.
 */
export const astKnownKeysAllowlist = visitOnlyKnownKeys<Sparql12Nodes>({
  path: { type: true, subType: true, loc: true, items: true },
  pattern: {
    type: true,
    subType: true,
    loc: true,
    values: true,
    name: true,
    variable: true,
    silent: true,
    expression: true,
    variables: true,
    patterns: true,
    triples: true,
  },
  update: { type: true, subType: true, loc: true, updates: true },
  query: {
    type: true,
    subType: true,
    loc: true,
    values: true,
    template: true,
    context: true,
    solutionModifiers: true,
    datasets: true,
    where: true,
    variables: true,
    distinct: true,
    reduced: true,
  },
  graphRef: { type: true, subType: true, loc: true, graph: true },
  updateOperation: {
    type: true,
    subType: true,
    loc: true,
    data: true,
    source: true,
    silent: true,
    destination: true,
    from: true,
    graph: true,
    where: true,
    delete: true,
    insert: true,
  },
  datasetClauses: { type: true, subType: true, loc: true, clauses: true },
  tripleCollection: { type: true, subType: true, loc: true, triples: true, identifier: true },
  triple: { type: true, subType: true, loc: true, object: true, subject: true, predicate: true, annotations: true },
  solutionModifier: {
    type: true,
    subType: true,
    loc: true,
    offset: true,
    having: true,
    limit: true,
    orderDefs: true,
    groupings: true,
  },
  expression: {
    type: true,
    subType: true,
    loc: true,
    function: true,
    args: true,
    expression: true,
    distinct: true,
    operator: true,
    separator: true,
    aggregation: true,
  },
  contextDef: { type: true, subType: true, loc: true, key: true, value: true, version: true },
  wildcard: { type: true, subType: true, loc: true },
  term: {
    type: true,
    subType: true,
    loc: true,
    object: true,
    value: true,
    label: true,
    prefix: true,
    subject: true,
    predicate: true,
    langOrIri: true,
  },
});
