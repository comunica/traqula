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
type OverriddenKeys = keyof typeof algebraUtils11 & keyof typeof algebraUtils12;
export const algebraUtils = <Omit<typeof algebraUtils11, OverriddenKeys> & typeof algebraUtils12> {
  ...algebraUtils11,
  ...algebraUtils12,
};
