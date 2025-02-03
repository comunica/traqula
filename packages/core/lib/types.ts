import type { GeneratorRule } from './generator-builder/generatorTypes';
import type { ParserRule } from './parser-builder/ruleDefTypes';

export type ParseAndGenRule<
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
   */
  ReturnType = unknown,
  /**
   * Function arguments that can be given to convey the state of the current parse operation.
   */
  ParamType = any,
> = ParserRule<Context, NameType, ReturnType, ParamType> & GeneratorRule<Context, NameType, ReturnType, ParamType>;
