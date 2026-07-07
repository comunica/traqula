import {
  algebraUtils as algebraUtils11,
} from '@traqula/algebra-transformations-1-1';
import * as algebraUtils12 from './utils.js';

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
export type * from './utils.js';

// TODO next major: donnot export this as an object, use disambiguation instead
type OverriddenKeys = keyof typeof algebraUtils11 & keyof typeof algebraUtils12;
export type AlgebraUtils = Omit<typeof algebraUtils11, OverriddenKeys> & typeof algebraUtils12;
export const algebraUtils: AlgebraUtils = {
  ...algebraUtils11,
  ...algebraUtils12,
};
