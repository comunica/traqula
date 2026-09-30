import { AstFactory, AstTransformer, lex } from '@traqula/rules-sparql-1-1';

const pNameLnPattern = <RegExp> lex.terminals.pNameLn.PATTERN;
const fullPNameLn = new RegExp(`^(?:${pNameLnPattern.source})$`, pNameLnPattern.flags);

// Only a match whose rest is a valid local name can be written as a prefixed name, e.g. not `ex:a/b`.
function bestPrefixMatch(iri: string, prefixes: Record<string, string>): { prefix: string; expansion: string } |
undefined {
  let best: { prefix: string; expansion: string } | undefined;
  for (const [ prefix, expansion ] of Object.entries(prefixes)) {
    if (iri.startsWith(expansion) && (!best || expansion.length > best.expansion.length)) {
      const localName = iri.slice(expansion.length);
      if (localName === '' || fullPNameLn.test(`${prefix}:${localName}`)) {
        best = { prefix, expansion };
      }
    }
  }
  return best;
}

/**
 * Rewrites full IRIs in a Traqula AST to prefixed names wherever a prefix matches, using the longest match that
 * leaves a valid local name.
 * Useful after conversion, as SPARQL.js expands all prefixed names to full IRIs.
 * @param node - The AST (or part of it) to rewrite; it is not mutated.
 * @param prefixes - Prefix to IRI map, e.g. the `prefixes` of the SPARQL.js query.
 * @returns A copy of `node` with prefixed names.
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
      // PREFIX/BASE declarations must keep the full IRI they define.
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
            if (match) {
              return astFactory.termNamed(copy.loc, copy.value.slice(match.expansion.length), match.prefix);
            }
            return copy;
          },
        },
      },
    },
  );
}
