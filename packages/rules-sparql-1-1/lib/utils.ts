import { TransformerSubTyped, visitOnlyKnownKeys } from '@traqula/core';
import type { Sparql11Nodes } from './Sparql11types.js';

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
 * Contexts per node type that only visit the known keys that can hold objects, see {@link visitOnlyKnownKeys}.
 */
export const astKnownKeysAllowlist = visitOnlyKnownKeys<Sparql11Nodes>({
  path: { type: false, subType: false, loc: false, items: true },
  pattern: {
    type: false,
    subType: false,
    loc: false,
    silent: false,
    values: true,
    name: true,
    variable: true,
    expression: true,
    variables: true,
    patterns: true,
    triples: true,
  },
  update: { type: false, subType: false, loc: false, updates: true },
  query: {
    type: false,
    subType: false,
    loc: false,
    distinct: false,
    reduced: false,
    values: true,
    template: true,
    context: true,
    solutionModifiers: true,
    datasets: true,
    where: true,
    variables: true,
  },
  graph: { type: false, subType: false, loc: false, graph: true, triples: true },
  graphRef: { type: false, subType: false, loc: false, graph: true },
  updateOperation: {
    type: false,
    subType: false,
    loc: false,
    silent: false,
    data: true,
    source: true,
    destination: true,
    from: true,
    graph: true,
    where: true,
    delete: true,
    insert: true,
  },
  datasetClauses: { type: false, subType: false, loc: false, clauses: true },
  tripleCollection: { type: false, subType: false, loc: false, triples: true, identifier: true },
  triple: { type: false, subType: false, loc: false, object: true, subject: true, predicate: true },
  solutionModifier: {
    type: false,
    subType: false,
    loc: false,
    offset: false,
    limit: false,
    having: true,
    orderDefs: true,
    groupings: true,
  },
  expression: {
    type: false,
    subType: false,
    loc: false,
    distinct: false,
    operator: false,
    separator: false,
    aggregation: false,
    function: true,
    args: true,
    expression: true,
  },
  contextDef: { type: false, subType: false, loc: false, key: false, value: true },
  wildcard: { type: false, subType: false, loc: false },
  term: { type: false, subType: false, loc: false, value: false, label: false, prefix: false, langOrIri: true },
});
