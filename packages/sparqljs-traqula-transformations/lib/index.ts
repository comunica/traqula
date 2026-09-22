/**
 * Rules for converting AST fragments produced by the deprecated `sparqljs`
 * (https://github.com/RubenVerborgh/SPARQL.js) into Traqula's own SPARQL 1.1 AST.
 *
 * Every conversion step is registered as an {@link SparqlJsCompatIndir} (Traqula's modular
 * indirection/rule pattern, the same one used by `algebra-transformations-1-1`), so a step can be
 * patched or replaced with `IndirBuilder.create(...).patchRule(...)` without forking the rest of the
 * pipeline. Most consumers do not need this package directly: `@traqula/sparql-js-to-traqula-1-1`
 * assembles these rules into a ready-to-use `IndirBuilder` and exposes plain functions.
 *
 * This is a lossy, one-directional (sparqljs -> Traqula) conversion:
 *  - sparqljs resolves prefixed names to full IRIs at parse time, so every converted `TermIri` is a
 *    `TermIriFull`: the original prefix notation cannot be recovered, and regenerated queries will
 *    always print full `<...>` IRIs unless the caller rewrites the resulting AST to use
 *    `contextDefinitionPrefix` (see {@link collapseIrisToPrefixed}).
 *  - sparqljs merges/deduplicates PREFIX and BASE declarations into one flat map for the whole query
 *    (and, for updates, the whole set of operations). Traqula keeps a `context` list per query / per
 *    update-operation. The original per-declaration order and per-operation scoping is therefore not
 *    recoverable; the same flattened context is attached to the query, or to every operation of an update.
 *  - sparqljs already desugars `( ... )` collections and `[ ... ]` blank node property lists into a flat
 *    list of triples with synthesized blank nodes. Traqula can represent that nested syntax explicitly via
 *    `TripleCollection`, but since the information needed to reconstruct it no longer exists in sparqljs'
 *    AST, this converter always produces flat `TripleNesting` triples. The generated query stays correct,
 *    it just prints blank-node triples individually instead of using `[]`/`()` shorthand.
 *  - sparqljs itself already prefixes every blank node's `.value` with `e_` (explicit `_:label`) or `g_`
 *    (anonymous `[]`/`()`) - the same convention Traqula's own `AstFactory.termBlank` uses internally. That
 *    prefix is stripped and always re-added as `e_`, so a regenerated query always prints `_:<label>`
 *    rather than leaking sparqljs' own naming into the output. This means a user-written label that
 *    happens to collide with a stripped anonymous counter value (e.g. `_:0` next to the query's first
 *    anonymous node) could theoretically be merged into the same node; this is exceedingly unlikely in
 *    practice and not guarded against.
 *  - RDF-star / SPARQL-star quoted triples (rdfjs `Quad` terms, sparqljs' `sparqlStar` option) are not part
 *    of the SPARQL 1.1 grammar Traqula's `rules-sparql-1-1` package implements, and are not supported here.
 *
 * Terms do not strictly need a `termType`: unlike sparqljs' own generator, which requires one and has no
 * fallback, this converter infers it from shape when it's missing (see `inferSparqlJsTermType`). This is a
 * best-effort fallback, not a substitute for a real termType when you have one, and it cannot tell an
 * arbitrarily-labelled blank node apart from a variable.
 */
export * from './collapseIrisToPrefixed.js';
export type { SparqlJsCompatContext, SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
export { createSparqlJsCompatContext } from './core.js';
export * from './expression.js';
export * from './graphRef.js';
export * from './pattern.js';
export * from './query.js';
export * from './term.js';
export * from './triple.js';
export * from './update.js';
