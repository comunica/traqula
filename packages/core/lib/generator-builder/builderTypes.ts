import type { GeneratorRule } from './generatorTypes';

/**
 * Get union-type of names used in list of ruledefs.
 */
export type GenNamesFromList<T extends readonly GeneratorRule[]> = T[number]['name'];

/**
 * Convert a list of ruledefs to a record that maps each rule name to its definition.
 */
export type GenRuleMap<RuleNames extends string> = {[Key in RuleNames]: GeneratorRule<any, Key> };

/**
 * Convert a list of RuleDefs to a Record with the name of the RuleDef as the key, matching the RuleDefMap type.
 */
export type GenRulesToObject<
  T extends readonly GeneratorRule[],
  Names extends string = GenNamesFromList<T>,
  Agg extends Record<string, GeneratorRule> = Record<never, never>,
> = T extends readonly [infer First, ...infer Rest] ? (
  First extends GeneratorRule ? (
    Rest extends readonly GeneratorRule[] ? (
      GenRulesToObject<Rest, Names, {[K in keyof Agg | First['name']]: K extends First['name'] ? First : Agg[K] }>
    ) : never
  ) : never
) : GenRuleMap<Names> & Agg;

export type GeneratorFromRules<Context, Names extends string, RuleDefs extends GenRuleMap<Names>> = {
  [K in Names]: RuleDefs[K] extends GeneratorRule<Context, K, infer RET, infer ARGS> ?
      (input: RET, context: Context, args: ARGS) => string : never
};
