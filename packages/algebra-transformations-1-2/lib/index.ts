import {
  algebraUtils as algebraUtils11,
} from '@traqula/algebra-transformations-1-1';

export * from './toAlgebra12.js';
export * from './toAst12.js';
export * from './types.js';
export {
  Algebra,
  AlgebraFactory,
  Types,
  ExpressionTypes,
  Canonicalizer,
} from '@traqula/algebra-transformations-1-1';

// TODO next major: donnot export this as an object, use disambiguation instead
export type AlgebraUtils = typeof algebraUtils11;
export const algebraUtils: AlgebraUtils = {
  ...algebraUtils11,
};
