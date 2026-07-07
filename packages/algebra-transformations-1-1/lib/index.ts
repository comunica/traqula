export * from './toAlgebra/index.js';
export * from './toAst/index.js';
export { Types, ExpressionTypes } from './algebra.js';
export * as Algebra from './algebra.js';
export * from './algebraFactory.js';
// TODO next major: do not export this as an object! Submodules cause issues for tsc type resolution:
//  https://github.com/microsoft/TypeScript/issues/48212
//  https://github.com/comunica/comunica/pull/1720#discussion_r3450180756 (
//    error TS2883: The inferred type of 'resolveIri' cannot be named without a reference to X from Y.
//    This is likely not portable. A type annotation is necessary.
export * as algebraUtils from './util.js';
export type * from './util.js';
export * from './canonicalizer.js';

// Disambiguation: keep the current public meaning (the toAlgebra rule)
export { inScopeVariables } from './toAlgebra/index.js';
// Keep the util function nameable too, under an alias
export type { inScopeVariables as inScopeVariablesUtil } from './util.js';
