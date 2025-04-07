import type { Node } from '../utils';

/**
 * Type used to declare generator rules.
 */
export type GeneratorRule<
  /**
   * Context object available in rule implementation.
   */
  Context = any,
  /**
   * Name of grammar rule, should be a strict subtype of string like 'myGrammarRule'.
   */
  NameType extends string = string,
  /**
   * Type that will be returned after a correct parse of this rule.
   * This type will be the return type of calling SUBRULE with this grammar rule.
   * Generation typically happens on a per AST node basis.
   * The core will implement the generation as such. If this ever changes, we will cross that bridge when we get there.
   */
  ReturnType = any,
  /**
   * Function arguments that can be given to convey the state of the current parse operation.
   */
  ParamType = any,
> = {
  name: NameType;
  gImpl: (def: RuleDefArg) =>
  (ast: ReturnType, context: Context, params: ParamType) => void;
};

export interface RuleDefArg {
  SUBRULE: <T extends Node, U>(cstDef: GeneratorRule<any, string, T, U>, input: T, arg: U) => void;
  PRINT: (...args: string[]) => void;
  PRINT_WORD: (...args: string[]) => void;
  CATCHUP: (until: number) => void;
  PUSH_SOURCE: (source: string) => void;
  POP_SOURCE: () => void;
}
