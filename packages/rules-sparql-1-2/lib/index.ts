import {
  validation as validation11,
} from '@traqula/rules-sparql-1-1';
import * as validation12 from './validators.js';

export * as gram from './grammar.js';
export * as lex from './lexer.js';
export * from './sparql12Types.js';
export * from './sparql12HelperTypes.js';
export * from './parserUtils.js';
export * from './AstFactory.js';
// TODO: deprecate this export
export * from './validators.js';

type OverriddenKeys = keyof typeof validation11 & keyof typeof validation12;
export const validation = <Omit<typeof validation11, OverriddenKeys> & typeof validation12> {
  ...validation11,
  ...validation12,
};
