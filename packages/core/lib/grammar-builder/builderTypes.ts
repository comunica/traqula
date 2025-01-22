/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ParserMethod } from 'chevrotain';
import type {RuleDef} from './ruleDefTypes';

/**
 * Get union-type of names used in list of ruledefs.
 */
export type RuleNamesFromList<T extends readonly RuleDef[]> = T[number]['name'];

/**
 * Convert a list of ruledefs to a record that maps each rule name to its definition.
 */
export type RuleDefMap<RuleNames extends string> = {[Key in RuleNames]: RuleDef<any, Key> };

/**
 * Check whether the first two types overlap, if yes, return the 3th argument, else the 4th.
 */
export type CheckOverlap<T, U, V, W = never> = T & U extends never ? V : W;

/**
 * Convert a list of RuleDefs to a Record with the name of the RuleDef as the key, matching the RuleDefMap type.
 */
export type RuleListToObject<
  T extends readonly RuleDef[],
  Names extends string = RuleNamesFromList<T>,
  Agg extends Record<string, RuleDef> = Record<never, never>,
> = T extends readonly [infer First, ...infer Rest] ? (
  First extends RuleDef ? (
    Rest extends readonly RuleDef[] ? (
      RuleListToObject<Rest, Names, {[K in keyof Agg | First['name']]: K extends First['name'] ? First : Agg[K] }>
    ) : never
  ) : never
) : RuleDefMap<Names> & Agg;

export type ParserFromRules<Context, Names extends string, RuleDefs extends RuleDefMap<Names>> = {
  [K in Names]: RuleDefs[K] extends RuleDef<Context, K, infer RET, infer ARGS> ? (input: string, context: Context, args: ARGS) => RET : never
};

export type ParseMethodsFromRules<Context, Names extends string, RuleDefs extends RuleDefMap<Names>> = {
  [K in Names]: RuleDefs[K] extends RuleDef<Context, K, infer RET, infer ARGS> ? ParserMethod<[Context, ARGS], RET> : never
};
