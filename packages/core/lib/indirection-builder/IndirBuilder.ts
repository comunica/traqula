import type { ParseNamesFromList } from '../parser-builder/builderTypes';
import type { CheckOverlap } from '../utils';
import { DynamicIndirect } from './dynamicIndirected';
import type { IndirDef, IndirectionMap, IndirectObjFromIndirDefs, ParseIndirsToObject } from './helpers';
import { listToIndirectionMap } from './helpers';

export class IndirBuilder<Context, Names extends string, RuleDefs extends IndirectionMap<Names>> {
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
    if (start instanceof IndirBuilder) {
      return new IndirBuilder({ ...start.rules });
    }
    return <IndirBuilder<Context, Names, RuleDefs>> <unknown> new IndirBuilder(listToIndirectionMap(start));
  }

  private rules: RuleDefs;

  private constructor(startRules: RuleDefs) {
    this.rules = startRules;
  }

  public widenContext<NewContext extends Context>(): IndirBuilder<NewContext, Names, RuleDefs> {
    return <IndirBuilder<NewContext, Names, RuleDefs>> <unknown> this;
  }

  public typePatch<Patch extends {[Key in Names]?: any }>():
  IndirBuilder<Context, Names, {[Key in Names]: Key extends keyof Patch ? (
    IndirDef<Context, Key, Patch[Key][0], Patch[Key][1]>
  ) : (RuleDefs[Key] extends IndirDef<Context, Key> ? RuleDefs[Key] : never) }> {
    return <IndirBuilder<Context, Names, {[Key in Names]: Key extends keyof Patch ? (
      RuleDefs[Key] extends IndirDef<Context, Key, any, infer Par> ? IndirDef<Context, Key, Patch[Key], Par> : never
    ) : (RuleDefs[Key] extends IndirDef<Context, Key> ? RuleDefs[Key] : never) }>> <unknown> this;
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

  public build(): IndirectObjFromIndirDefs<Context, Names, RuleDefs> {
    return <IndirectObjFromIndirDefs<Context, Names, RuleDefs>> new DynamicIndirect(this.rules);
  }
}
