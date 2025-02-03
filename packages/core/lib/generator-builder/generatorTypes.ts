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
   */
  ReturnType = any,
  /**
   * Function arguments that can be given to convey the state of the current parse operation.
   */
  ParamType = any,
> = {
  name: NameType;
  gImpl: (def: RuleDefArg) =>
  (ast: ReturnType, context: Context, params: ParamType) => string;
};

export interface RuleDefArg {
  SUBRULE: <T, U>(cstDef: GeneratorRule<any, any, T, U>, input: T, arg: U) => string;
}
