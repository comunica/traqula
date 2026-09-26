/**
 * Rules converting SPARQL.js-compatible AST (SPARQL.js parser output or hand-built equivalents) to
 * Traqula's SPARQL 1.1 AST. See the README of `@traqula/sparql-js-to-traqula-1-1`.
 */
export * from './collapseIrisToPrefixed.js';
export type {
  SparqlJsCompatContext,
  SparqlJsCompatIndir,
  SparqlJsTermToTraqula,
} from './core.js';
export { createSparqlJsCompatContext } from './core.js';
export * from './expression.js';
export * from './graphRef.js';
export * from './pattern.js';
export * from './query.js';
export * from './term.js';
export * from './triple.js';
export * from './update.js';
