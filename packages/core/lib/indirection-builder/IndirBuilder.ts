import type { ParseNamesFromList } from '../parser-builder/builderTypes.js';
import type { CheckOverlap } from '../utils.js';
import { DynamicIndirect } from './dynamicIndirected.js';
import type { IndirDef, IndirectionMap, IndirectObjFromIndirDefs, ParseIndirsToObject } from './helpers.js';
import { listToIndirectionMap } from './helpers.js';

/**
 * Builder for composing modular transformation pipelines using indirection definitions.
 * Functions registered through this builder call each other via SUBRULE, enabling the same
 * modularity and extensibility as the parser and generator builders.
 *
 * Builders mutate internal state and return `this`.
 * Always start by copying an existing builder with `IndirBuilder.create(existingBuilder)`.
 */
export class IndirBuilder<Context, Names extends string, RuleDefs extends IndirectionMap<Names>> {
  /**
   * Create an IndirBuilder from initial indirection definitions or an existing builder.
   * If a builder is provided, a new copy will be created.
   */
  public static create<Context, Names extends string, RuleDefs extends IndirectionMap<Names>>(
    args: IndirBuilder<Context, Names, RuleDefs>
  ): IndirBuilder<Context, Names, RuleDefs>;
  public static create<
    Rules extends readonly IndirDef[] = readonly IndirDef[],
    Context = Rules[0] extends IndirDef<infer context> ? context : never,
    Names extends string = ParseNamesFromList<Rules>,
    RuleDefs extends IndirectionMap<Names> = ParseIndirsToObject<Rules>,
  >(rules: Rules): IndirBuilder<Context, Names, RuleDefs>;
  public static create<
    Rules extends readonly IndirDef[] = readonly IndirDef[],
    Context = Rules[0] extends IndirDef<infer context> ? context : never,
    Names extends string = ParseNamesFromList<Rules>,
    RuleDefs extends IndirectionMap<Names> = ParseIndirsToObject<Rules>,
  >(
    start: Rules | IndirBuilder<Context, Names, RuleDefs>,
  ): IndirBuilder<Context, Names, RuleDefs> {
    if (Array.isArray(start)) {
      return <IndirBuilder<Context, Names, RuleDefs>> <unknown> new IndirBuilder(listToIndirectionMap(start));
    }
    return new IndirBuilder({ ...(<IndirBuilder<any, any, any>>start).rules });
  }

  private rules: RuleDefs;

  private constructor(startRules: RuleDefs) {
    this.rules = startRules;
  }

  /**
   * Narrow the builder's context type parameter to a more specific subtype.
   * This is a zero-cost type-level operation — the builder instance is returned as-is
   * but with updated type parameters.
   */
  public widenContext<NewContext extends Context>(): IndirBuilder<
    NewContext,
    Names,
    {[Key in keyof RuleDefs]: Key extends Names ?
        (RuleDefs[Key] extends IndirDef<any, any, infer RT, infer PT> ? IndirDef<NewContext, Key, RT, PT> : never)
      : never }
  > {
    return <any> this;
  }

  /**
   * Update the type signatures (return types and/or parameter types) of existing indirections
   * without changing their implementations. Use this when a patched indirection changes the types
   * flowing through downstream indirections that don't need new implementations.
   * This is a zero-cost type-level operation.
   */
  public typePatch<Patch extends {[Key in Names]?: [any] | [any, any[]]}>():
  IndirBuilder<Context, Names, {[Key in Names]: Key extends keyof Patch ? (
    Patch[Key] extends [any, any[]] ? IndirDef<Context, Key, Patch[Key][0], Patch[Key][1]> : (
      // Only  one - infer arg yourself
      Patch[Key] extends [ any ] ? (
        RuleDefs[Key] extends IndirDef<any, any, any, infer Par> ? IndirDef<Context, Key, Patch[Key][0], Par> : never
      ) : never
    )
  ) : (RuleDefs[Key] extends IndirDef<Context, Key> ? RuleDefs[Key] : never) }> {
    return <any> this;
  }

  /**
   * Change the implementation of an existing indirection.
   */
  public patchRule<U extends Names, RET, ARGS extends any[]>(patch: IndirDef<Context, U, RET, ARGS>):
  IndirBuilder<Context, Names, {[Key in Names]: Key extends U ?
    IndirDef<Context, Key, RET, ARGS> :
      (RuleDefs[Key] extends IndirDef<Context, Key> ? RuleDefs[Key] : never)
  } > {
    const self = <IndirBuilder<Context, Names, {[Key in Names]: Key extends U ?
      IndirDef<Context, Key, RET, ARGS> : (RuleDefs[Key] extends IndirDef<Context, Key> ? RuleDefs[Key] : never) }>>
      <unknown> this;
    self.rules[patch.name] = <any> patch;
    return self;
  }

  /**
   * Add an indirection function. If the rule already exists, but the implementation differs, an error will be thrown.
   */
  public addRuleRedundant<U extends string, RET, ARGS extends any[]>(rule: IndirDef<Context, U, RET, ARGS>):
  IndirBuilder<Context, Names | U, {[K in Names | U]: K extends U ?
    IndirDef<Context, K, RET, ARGS> :
      (K extends Names ? (RuleDefs[K] extends IndirDef<Context, K> ? RuleDefs[K] : never) : never)
  }> {
    const self = <IndirBuilder<Context, Names | U, {[K in Names | U]: K extends U ?
      IndirDef<Context, K, RET, ARGS> :
        (K extends Names ? (RuleDefs[K] extends IndirDef<Context, K> ? RuleDefs[K] : never) : never) }>>
      <unknown> this;
    const rules = <Record<string, IndirDef<Context>>> self.rules;
    if (rules[rule.name] !== undefined && rules[rule.name] !== rule) {
      throw new Error(`Function ${rule.name} already exists in the builder`);
    }
    rules[rule.name] = rule;
    return self;
  }

  /**
   * Add a rule to the grammar. Will raise a typescript error if the rule already exists in the grammar.
   */
  public addRule<U extends string, RET, ARGS extends any[]>(
    rule: CheckOverlap<U, Names, IndirDef<Context, U, RET, ARGS>>,
  ): IndirBuilder<Context, Names | U, {[K in Names | U]: K extends U ?
    IndirDef<Context, K, RET, ARGS> :
      (K extends Names ? (RuleDefs[K] extends IndirDef<Context, K> ? RuleDefs[K] : never) : never) }> {
    return this.addRuleRedundant(rule);
  }

  /**
   * Add multiple indirection definitions at once using rest parameters.
   * Provides better TypeScript type inference than calling {@link addRule} in a loop,
   * but avoid passing too many at once as this can cause TypeScript compilation slowdowns.
   * TypeScript errors if any name conflicts with an existing one.
   */
  public addMany<U extends readonly IndirDef<Context>[]>(
    ...rules: CheckOverlap<ParseNamesFromList<U>, Names, U>
  ): IndirBuilder<
    Context,
    Names | ParseNamesFromList<U>,
    {[K in Names | ParseNamesFromList<U>]:
      K extends keyof ParseIndirsToObject<typeof rules> ? (
        ParseIndirsToObject<typeof rules>[K] extends IndirDef<Context, K> ? ParseIndirsToObject<typeof rules>[K] : never
      ) : (
        K extends Names ? (RuleDefs[K] extends IndirDef<Context, K> ? RuleDefs[K] : never) : never
      )
    }
  > {
    this.rules = { ...this.rules, ...listToIndirectionMap(rules) };
    return <any> <unknown> this;
  }

  /**
   * Delete a grammar rule by its name.
   */
  public deleteRule<U extends Names>(ruleName: U):
  IndirBuilder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
    RuleDefs[K] extends IndirDef<Context, K> ? RuleDefs[K] : never }> {
    delete this.rules[ruleName];
    return <IndirBuilder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
      RuleDefs[K] extends IndirDef<Context, K> ? RuleDefs[K] : never }>>
      <unknown> this;
  }

  /**
   * Delete multiple indirection definitions by name in a single call.
   * @param ruleNames - Names of the indirections to delete.
   */
  public deleteMany<U extends Names>(...ruleNames: U[]):
  IndirBuilder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
    RuleDefs[K] extends IndirDef<Context, K> ? RuleDefs[K] : never }> {
    for (const name of ruleNames) {
      delete this.rules[name];
    }
    return <IndirBuilder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
      RuleDefs[K] extends IndirDef<Context, K> ? RuleDefs[K] : never }>>
      <unknown> this;
  }

  /**
   * Retrieve an indirection definition by its name.
   * Useful for inspecting or wrapping existing definitions when extending a pipeline.
   * @param ruleName - The name of the indirection, type-checked against the builder's known names.
   */
  public getRule<U extends Names>(ruleName: U): RuleDefs[U] extends IndirDef<any, U, infer RT, infer PT> ?
    IndirDef<Context, U, RT, PT> : never {
    return <any> this.rules[ruleName];
  }

  /**
   * Merge this indirection builder with another.
   * If the two builders both have a definition with the same name,
   * no error will be thrown in case they map to the same object (by reference).
   * If they map to a different object, an error will be thrown.
   * To fix this problem, the overridingRules array should contain a definition with the same conflicting name,
   * whose implementation will be used.
   */
  public merge<
    OtherNames extends string,
    OtherRules extends IndirectionMap<OtherNames>,
    OW extends readonly IndirDef<Context>[],
  >(
    builder: IndirBuilder<Context, OtherNames, OtherRules>,
    overridingRules: OW,
  ):
    IndirBuilder<
      Context,
      Names | OtherNames | ParseNamesFromList<OW>,
      {[K in Names | OtherNames | ParseNamesFromList<OW>]:
        K extends keyof ParseIndirsToObject<OW> ? (
          ParseIndirsToObject<OW>[K] extends IndirDef<Context, K> ? ParseIndirsToObject<OW>[K] : never
        )
          : (
              K extends Names ? (RuleDefs[K] extends IndirDef<Context, K> ? RuleDefs[K] : never)
                : K extends OtherNames ? (OtherRules[K] extends IndirDef<Context, K> ? OtherRules[K] : never) : never
            ) }
    > {
    // Assume the other set is bigger than yours. So start from that one and add this one
    const otherRules: Record<string, IndirDef<Context>> = { ...builder.rules };
    const myRules: Record<string, IndirDef<Context>> = this.rules;

    for (const rule of Object.values(myRules)) {
      if (otherRules[rule.name] === undefined) {
        otherRules[rule.name] = rule;
      } else {
        const existingRule = otherRules[rule.name];
        // If same rule, no issue, move on. Else
        if (existingRule !== rule) {
          const override = overridingRules.find(x => x.name === rule.name);
          // If override specified, take override, else, inform user that there is a conflict
          if (override) {
            otherRules[rule.name] = override;
          } else {
            throw new Error(`Function with name "${rule.name}" already exists in the builder, specify an override to resolve conflict`);
          }
        }
      }
    }

    this.rules = <any> <unknown> otherRules;
    return <any> <unknown> this;
  }

  /**
   * Construct an indirection object from the registered definitions.
   * @returns An object with a method for each registered indirection name.
   */
  public build(): IndirectObjFromIndirDefs<Context, Names, RuleDefs> {
    return <IndirectObjFromIndirDefs<Context, Names, RuleDefs>> new DynamicIndirect(this.rules);
  }
}
