import type { Localized } from '../nodeTypings';

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
   * Type that of the AST that we will generate the string for.
   * This type will be the provided when calling SUBRULE with this generator rule.
   * Generation happens on a per AST node basis.
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
  SUBRULE: <T, U>(cstDef: GeneratorRule<any, any, T, U>, input: T, arg: U) => void;
  PRINT: (...args: string[]) => void;
  PRINT_WORD: (...args: string[]) => void;
  PRINT_WORDS: (...args: string[]) => void;
  HANDLE_LOC: <T>(loc: Localized, nodeHandle: () => T) => T | undefined;
  CATCHUP: (until: number) => void;
}
