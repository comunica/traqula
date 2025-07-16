import { CoreFactory } from '../CoreFactory';
import type { CheckOverlap } from '../utils';
import type { GeneratorFromRules, GenRuleMap, GenRulesToObject, GenNamesFromList } from './builderTypes';
import type { GeneratorRule, RuleDefArg } from './generatorTypes';

/**
 * Converts a list of ruledefs to a record mapping a name to the corresponding ruledef.
 */
function listToRuleDefMap<T extends readonly GeneratorRule[]>(rules: T): GenRulesToObject<T> {
  const newRules: Record<string, GeneratorRule> = {};
  for (const rule of rules) {
    newRules[rule.name] = rule;
  }
  return <GenRulesToObject<T>>newRules;
}

export class GeneratorBuilder<Context, Names extends string, RuleDefs extends GenRuleMap<Names>> {
  /**
   * Create a GeneratorBuilder from some initial grammar rules or an existing GeneratorBuilder.
   * If a GeneratorBuilder is provided, a new copy will be created.
   */
  public static createBuilder<
    Rules extends readonly GeneratorRule[] = readonly GeneratorRule[],
    Context = Rules[0] extends GeneratorRule<infer context> ? context : never,
    Names extends string = GenNamesFromList<Rules>,
    RuleDefs extends GenRuleMap<Names> = GenRulesToObject<Rules>,
  >(
    start: Rules | GeneratorBuilder<Context, Names, RuleDefs>,
  ): GeneratorBuilder<Context, Names, RuleDefs> {
    if (start instanceof GeneratorBuilder) {
      return new GeneratorBuilder({ ...start.rules });
    }
    return <GeneratorBuilder<Context, Names, RuleDefs>> <unknown> new GeneratorBuilder(listToRuleDefMap(start));
  }

  private rules: RuleDefs;

  private constructor(startRules: RuleDefs) {
    this.rules = startRules;
  }

  public widenContext<NewContext extends Context>(): GeneratorBuilder<NewContext, Names, RuleDefs> {
    return <GeneratorBuilder<NewContext, Names, RuleDefs>> <unknown> this;
  }

  public typePatch<Patch extends {[Key in Names]?: any }>():
  GeneratorBuilder<Context, Names, {[Key in Names]: Key extends keyof Patch ? (
    RuleDefs[Key] extends GeneratorRule<Context, Key, any, infer Args> ?
      GeneratorRule<Context, Key, Patch[Key], Args> : never
  ) : (RuleDefs[Key] extends GeneratorRule<Context, Key> ? RuleDefs[Key] : never) }> {
    return <GeneratorBuilder<Context, Names, {[Key in Names]: Key extends keyof Patch ? (
      RuleDefs[Key] extends GeneratorRule<Context, Key, any, infer Args> ?
        GeneratorRule<Context, Key, Patch[Key], Args> : never
    ) : (RuleDefs[Key] extends GeneratorRule<Context, Key> ? RuleDefs[Key] : never) }>> <unknown> this;
  }

  /**
   * Change the implementation of an existing generator rule.
   */
  public patchRule<U extends Names, RET, ARGS>(patch: GeneratorRule<Context, U, RET, ARGS>):
  GeneratorBuilder<Context, Names, {[Key in Names]: Key extends U ?
    GeneratorRule<Context, Key, RET, ARGS> :
      (RuleDefs[Key] extends GeneratorRule<Context, Key> ? RuleDefs[Key] : never)
  } > {
    const self = <GeneratorBuilder<Context, Names, {[Key in Names]: Key extends U ?
      GeneratorRule<Context, Key, RET, ARGS> :
        (RuleDefs[Key] extends GeneratorRule<Context, Key> ? RuleDefs[Key] : never) }>>
      <unknown> this;
    self.rules[patch.name] = <any> patch;
    return self;
  }

  /**
   * Add a rule to the grammar. If the rule already exists, but the implementation differs, an error will be thrown.
   */
  public addRuleRedundant<U extends string, RET, ARGS>(rule: GeneratorRule<Context, U, RET, ARGS>):
  GeneratorBuilder<Context, Names | U, {[K in Names | U]: K extends Names ?
      (RuleDefs[K] extends GeneratorRule<Context, K> ? RuleDefs[K] : never)
    : (K extends U ? GeneratorRule<Context, K, RET, ARGS> : never)
  }> {
    const self = <GeneratorBuilder<Context, Names | U, {[K in Names | U]: K extends Names ?
        (RuleDefs[K] extends GeneratorRule<Context, K> ? RuleDefs[K] : never)
      : (K extends U ? GeneratorRule<Context, K, RET, ARGS> : never) }>>
      <unknown> this;
    const rules = <Record<string, GeneratorRule<Context>>> self.rules;
    if (rules[rule.name] !== undefined && rules[rule.name] !== rule) {
      throw new Error(`Rule ${rule.name} already exists in the GeneratorBuilder`);
    }
    rules[rule.name] = rule;
    return self;
  }

  /**
   * Add a rule to the grammar. Will raise a typescript error if the rule already exists in the grammar.
   */
  public addRule<U extends string, RET, ARGS>(
    rule: CheckOverlap<U, Names, GeneratorRule<Context, U, RET, ARGS>>,
  ): GeneratorBuilder<Context, Names | U, {[K in Names | U]: K extends Names ?
      (RuleDefs[K] extends GeneratorRule<Context, K> ? RuleDefs[K] : never)
    : (K extends U ? GeneratorRule<Context, K, RET, ARGS> : never)
  }> {
    return this.addRuleRedundant(rule);
  }

  public addMany<U extends readonly GeneratorRule<Context>[]>(
    ...rules: CheckOverlap<GenNamesFromList<U>, Names, U>
  ): GeneratorBuilder<
    Context,
    Names | GenNamesFromList<U>,
    {[K in Names | GenNamesFromList<U>]:
      K extends keyof GenRulesToObject<typeof rules> ? (
        GenRulesToObject<typeof rules>[K] extends GeneratorRule<Context, K> ? GenRulesToObject<typeof rules>[K] : never
      ) : (
        K extends Names ? (RuleDefs[K] extends GeneratorRule<Context, K> ? RuleDefs[K] : never) : never
      )
    }
  > {
    this.rules = { ...this.rules, ...listToRuleDefMap(rules) };
    return <any> <unknown> this;
  }

  /**
   * Delete a grammar rule by its name.
   */
  public deleteRule<U extends Names>(ruleName: U):
  GeneratorBuilder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
    RuleDefs[K] extends GeneratorRule<Context, K> ? RuleDefs[K] : never }> {
    delete this.rules[ruleName];
    return <GeneratorBuilder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
      RuleDefs[K] extends GeneratorRule<Context, K> ? RuleDefs[K] : never }>>
      <unknown> this;
  }

  /**
   * Merge this grammar GeneratorBuilder with another.
   * It is best to merge the bigger grammar with the smaller one.
   * If the two builders both have a grammar rule with the same name,
   * no error will be thrown case they map to the same ruledef object.
   * If they map to a different object, an error will be thrown.
   * To fix this problem, the overridingRules array should contain a rule with the same conflicting name,
   * this rule implementation will be used.
   */
  public merge<
    OtherNames extends string,
    OtherRules extends GenRuleMap<OtherNames>,
    OW extends readonly GeneratorRule<Context>[],
  >(
    GeneratorBuilder: GeneratorBuilder<Context, OtherNames, OtherRules>,
    overridingRules: OW,
  ):
    GeneratorBuilder<
      Context,
      Names | OtherNames | GenNamesFromList<OW>,
      {[K in Names | OtherNames | GenNamesFromList<OW>]:
        K extends keyof GenRulesToObject<OW> ? (
          GenRulesToObject<OW>[K] extends GeneratorRule<Context, K> ? GenRulesToObject<OW>[K] : never
        )
          : (
              K extends Names ? (RuleDefs[K] extends GeneratorRule<Context, K> ? RuleDefs[K] : never)
                : K extends OtherNames ? (OtherRules[K] extends GeneratorRule<Context, K> ? OtherRules[K] : never)
                  : never
            ) }
    > {
    // Assume the other grammar is bigger than yours. So start from that one and add this one
    const otherRules: Record<string, GeneratorRule<Context>> = { ...GeneratorBuilder.rules };
    const myRules: Record<string, GeneratorRule<Context>> = this.rules;

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
            throw new Error(`Rule with name "${rule.name}" already exists in the GeneratorBuilder, specify an override to resolve conflict`);
          }
        }
      }
    }

    this.rules = <any> <unknown> otherRules;
    return <any> <unknown> this;
  }

  public build(): GeneratorFromRules<Context, Names, RuleDefs> {
    const rules: Record<string, GeneratorRule<Context>> = this.rules;
    return <GeneratorFromRules<Context, Names, RuleDefs>> new Generator(rules);
  }
}

export class Generator<Context, Names extends string, RuleDefs extends GenRuleMap<Names>> {
  protected readonly factory = new CoreFactory();
  protected __context: Context | undefined = undefined;
  protected origSource = '';
  protected generatedUntil = 0;
  protected expectsSpace: boolean;
  protected readonly stringBuilder: string[] = [];

  public constructor(protected rules: RuleDefs) {
    // eslint-disable-next-line ts/no-unnecessary-type-assertion
    for (const rule of <GeneratorRule[]> Object.values(rules)) {
      // Define function implementation
      this[<keyof (typeof this)> rule.name] =
        <any> ((input: any, context: Context & { origSource: string; offset?: number }, args: any) => {
          this.expectsSpace = false;
          this.stringBuilder.length = 0;
          this.origSource = context.origSource;
          this.generatedUntil = context?.offset ?? 0;
          this.setContext(context);

          this.subrule(rule, input, args);

          this.catchup(this.origSource.length);

          return this.stringBuilder.join('');
        });
    }
  }

  public setContext(context: Context): void {
    this.__context = context;
  }

  protected getSafeContext(): Context {
    return <Context> this.__context;
  }

  protected readonly subrule: RuleDefArg['SUBRULE'] = (cstDef, ast, arg) => {
    const def = this.rules[<Names> cstDef.name];
    if (!def) {
      throw new Error(`Rule ${cstDef.name} not found`);
    }

    const generate = (): void => def.gImpl({
      SUBRULE: this.subrule,
      PRINT: this.print,
      PRINT_WORD: this.printWord,
      PRINT_WORDS: this.printWords,
      CATCHUP: this.catchup,
      HANDLE_LOC: this.handleLoc,
    })(ast, this.getSafeContext(), arg);

    if (this.factory.isLocalized(ast)) {
      this.handleLoc(ast, generate);
    } else {
      generate();
    }
  };

  protected readonly handleLoc: RuleDefArg['HANDLE_LOC'] = (localized, handle) => {
    if (this.factory.isSourceLocationNoMaterialize(localized.loc)) {
      return;
    }
    if (this.factory.isSourceLocationStringReplace(localized.loc)) {
      this.catchup(localized.loc.start);
      this.print(localized.loc.newSource);
      this.generatedUntil = localized.loc.end;
      return;
    }
    if (this.factory.isSourceLocationNodeReplace(localized.loc)) {
      this.catchup(localized.loc.start);
      this.generatedUntil = localized.loc.end;
    }
    if (this.factory.isSourceLocationSource(localized.loc)) {
      this.catchup(localized.loc.start);
    }
    // If autoGenerate - do nothing

    const ret = handle();

    if (this.factory.isSourceLocationSource(localized.loc)) {
      this.catchup(localized.loc.end);
    }
    return ret;
  };

  protected readonly catchup: RuleDefArg['CATCHUP'] = (until) => {
    const start = this.generatedUntil;
    if (start < until) {
      this.print(this.origSource.slice(start, until));
    }
    this.generatedUntil = Math.max(this.generatedUntil, until);
  };

  protected readonly print: RuleDefArg['PRINT'] = (...args) => {
    const pureArgs = args.filter(x => x.length > 0);
    if (pureArgs.length > 0) {
      const [ head, ...tail ] = pureArgs;
      if (this.expectsSpace) {
        this.expectsSpace = false;
        const blanks = new Set([ '\n', ' ', '\t' ]);
        if (this.stringBuilder.length > 0 &&
          !(blanks.has(head[0]) || blanks.has(this.stringBuilder.at(-1)!.at(-1)!))) {
          this.stringBuilder.push(' ');
        }
      }
      this.stringBuilder.push(head);
      this.stringBuilder.push(...tail);
    }
  };

  private readonly printWord: RuleDefArg['PRINT_WORD'] = (...args) => {
    this.expectsSpace = true;
    this.print(...args);
    this.expectsSpace = true;
  };

  private readonly printWords: RuleDefArg['PRINT_WORD'] = (...args) => {
    for (const arg of args) {
      this.printWord(arg);
    }
  };
}
