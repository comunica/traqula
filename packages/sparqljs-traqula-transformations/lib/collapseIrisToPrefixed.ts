import { AstFactory, AstTransformer } from '@traqula/rules-sparql-1-1';

function bestPrefixMatch(iri: string, prefixes: Record<string, string>): { prefix: string; expansion: string } |
undefined {
  let best: { prefix: string; expansion: string } | undefined;
  for (const [ prefix, expansion ] of Object.entries(prefixes)) {
    if (iri.startsWith(expansion) && (!best || expansion.length > best.expansion.length)) {
      best = { prefix, expansion };
    }
  }
  return best;
}

/**
 * Rewrites every plain full-IRI `TermIriFull` in a Traqula AST (sub)tree to a `TermIriPrefixed` wherever a
 * known prefix's expansion matches the IRI's start (the longest-matching expansion wins when more than one
 * prefix could apply). Returns a new tree; `node` itself is not mutated. Built on {@link AstTransformer}
 * (a `TransformerSubTyped` specialized for the SPARQL 1.1 AST), dispatching on `(type, subType)` so only
 * `term`/`namedNode` nodes are visited.
 *
 * `termFromSparqlJs` (and everything built on it) always produces full IRIs - sparqljs resolves prefixed
 * names to full IRIs at parse time, so the original prefix notation genuinely isn't recoverable from a
 * single term in isolation. This is the tool to reach for afterwards if you want the more familiar
 * `prefix:local` style back in generated output, for example to approximate what sparqljs' own (deprecated)
 * `Generator` used to produce: pass it the same query's `context` (or its original sparqljs `prefixes` map)
 * once you've converted it.
 *
 * `contextDef` nodes (the `PREFIX`/`BASE` declarations themselves) are left untouched: they must always
 * show the full IRI they define, never a prefixed self-reference. This is done by telling the transformer
 * to skip a `contextDef`'s `value` key entirely (`ignoreKeys`) rather than by special-casing the term itself.
 */
export function collapseIrisToPrefixed<T>(node: T, prefixes: Record<string, string>): T {
  if (node === null || typeof node !== 'object') {
    return node;
  }
  const astFactory = new AstFactory();
  const transformer = new AstTransformer();
  return transformer.transformNodeSpecific<'unsafe', T>(
    node,
    {
      contextDef: {
        preVisitor: () => ({ ignoreKeys: new Set([ 'value' ]) }),
      },
    },
    {
      term: {
        namedNode: {
          transform: (copy) => {
            if (astFactory.isTermNamedPrefixed(copy)) {
              return copy;
            }
            const match = bestPrefixMatch(copy.value, prefixes);
            if (match && copy.value.length > match.expansion.length) {
              return astFactory.termNamed(copy.loc, copy.value.slice(match.expansion.length), match.prefix);
            }
            return copy;
          },
        },
      },
    },
  );
}
