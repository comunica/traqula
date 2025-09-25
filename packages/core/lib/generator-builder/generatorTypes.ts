import type { Localized } from '../nodeTypings.js';

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
  AstType = any,
  /**
   * Function arguments that can be given to convey the state of the current parse operation.
   */
  ParamType extends any[] = any[],
> = {
  name: NameType;
  gImpl: (def: RuleDefArg) =>
  (ast: AstType, context: Context, ...params: ParamType) => void;
};

export interface RuleDefArg {
  /**
   * Call another generator rule so it can generate its string representation.
   * @param rule the rule to be called
   * @param input the ast input to work on
   * @param arg the remaining parameters required by this rule.
   * @constructor
   */
  SUBRULE: <T, U extends any[]>(rule: GeneratorRule<any, any, T, U>, input: T, ...arg: U) => void;
  /**
   * Print the characters to the output string
   * @param args arguments to be printed
   * @constructor
   */
  PRINT: (...args: string[]) => void;
  /**
   * Print the character  to the output stream ensuring there is a space to the left oif what you print.
   * If a space was printed right before this, it will not print a space.
   * @param args
   * @constructor
   */
  PRINT_SPACE_LEFT: (...args: string[]) => void;
  /**
   * Prints all arguments as one word, ensuring it has a space before and behind each word
   * @param args
   * @constructor
   */
  PRINT_WORD: (...args: string[]) => void;
  /**
   * Prints all arguments as words, ensuring they all have a space before and behind them.
   * @param args
   * @constructor
   */
  PRINT_WORDS: (...args: string[]) => void;
  /**
   * Ensures that what you print is on a newline with the indentation equal to the indentation currently setup.
   * @param args
   * @constructor
   */
  PRINT_ON_EMPTY: (...args: string[]) => void;
  /**
   * Handles the location of a node as if it was generated using a SUBRULE.
   * Can be used to generate many nodes within a single subrule call while still having correct localization handling.
   * @param loc
   * @param nodeHandle
   * @constructor
   */
  HANDLE_LOC: <T>(loc: Localized, nodeHandle: () => T) => T | undefined;
  /**
   * Catchup the string until a given length,
   * printing everything from the current catchup location until the index you provide.
   * @param until
   * @constructor
   */
  CATCHUP: (until: number) => void;
}
