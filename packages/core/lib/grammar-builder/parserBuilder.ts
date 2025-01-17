import type { ILexerConfig, IParserConfig } from '@chevrotain/types';
import type {IToken, TokenType, TokenVocabulary} from 'chevrotain';
import { EmbeddedActionsParser, Lexer } from 'chevrotain';
import { DataFactory } from 'rdf-data-factory';
import type {
  CheckOverlap,
  RuleDefMap,
  ParserFromRules,
  RuleListToObject,
  RuleNamesFromList,
  ParseMethodsFromRules,
} from './builderTypes';
import type { CstDef, ImplArgs, RuleDef } from './ruleDefTypes';

function listToRuleDefMap<T extends readonly RuleDef[]>(rules: T): RuleListToObject<T> {
  const newRules: Record<string, RuleDef> = {};
  for (const rule of rules) {
    newRules[rule.name] = rule;
  }
  return <RuleListToObject<T>>newRules;
}

export class Builder<Names extends string, RuleDefs extends RuleDefMap<Names>> {
  /**
   * Create a builder with from some initial grammar rules or an existing builder.
   * If a builder is provided, a new copy will be created.
   */
  public static createBuilder<
    Rules extends readonly RuleDef[] = RuleDef[],
    Names extends string = RuleNamesFromList<Rules>,
    RuleDefs extends RuleDefMap<Names> = RuleListToObject<Rules>,
>(start: Rules | Builder<Names, RuleDefs>): Builder<Names, RuleDefs> {
    if (start instanceof Builder) {
      return new Builder({ ...start.rules });
    }
    return <Builder<Names, RuleDefs>> <unknown> new Builder(listToRuleDefMap(start));
  }

  private rules: RuleDefs;

  private constructor(startRules: RuleDefs) {
    this.rules = startRules;
  }

  /**
   * Change the implementation of an existing grammar rule.
   */
  public patchRule<U extends Names, RET, ARGS extends unknown[]>(patch: RuleDef<U, RET, ARGS>):
  Builder<Names, {[Key in Names]: Key extends U ? RuleDef<Key, RET, ARGS> : (RuleDefs[Key] extends RuleDef<Key> ? RuleDefs[Key] : never) }> {
    const self = <Builder<Names, {[Key in Names]: Key extends U ? RuleDef<Key, RET, ARGS> : (RuleDefs[Key] extends RuleDef<Key> ? RuleDefs[Key] : never) }>>
      <unknown> this;
    self.rules[patch.name] = <any> patch;
    return self;
  }

  /**
   * Add a rule to the grammar. If the rule already exists, but the implementation differs, an error will be thrown.
   */
  public addRuleRedundant<U extends string, RET, ARGS extends unknown[]>(rule: RuleDef<U, RET, ARGS>):
  Builder<Names | U, {[K in Names | U]: K extends U ? RuleDef<K, RET, ARGS> : ( K extends Names ? (RuleDefs[K] extends RuleDef<K> ? RuleDefs[K] : never ) : never) }> {
    const self = <Builder<Names | U, {[K in Names | U]: K extends U ? RuleDef<K, RET, ARGS> : ( K extends Names ? (RuleDefs[K] extends RuleDef<K> ? RuleDefs[K] : never ) : never) }>>
      <unknown> this;
    const rules = <Record<string, RuleDef>> self.rules;
    if (rules[rule.name] !== undefined && rules[rule.name] !== rule) {
      throw new Error(`Rule ${rule.name} already exists in the builder`);
    }
    rules[rule.name] = rule;
    return self;
  }

  /**
   * Add a rule to the grammar. Will raise a typescript error if the rule already exists in the grammar.
   */
  public addRule<U extends string, RET, ARGS extends unknown[]>(
    rule: CheckOverlap<U, Names, RuleDef<U, RET, ARGS>>,
  ): Builder<Names | U, {[K in Names | U]: K extends U ? RuleDef<K, RET, ARGS> : ( K extends Names ? (RuleDefs[K] extends RuleDef<K> ? RuleDefs[K] : never ) : never) }> {
    return this.addRuleRedundant(rule);
  }

  public addMany<U extends RuleDef[]>(
    ...rules: CheckOverlap<RuleNamesFromList<U>, Names, U>
  ): Builder<
    Names | RuleNamesFromList<U>,
    {[K in Names | RuleNamesFromList<U>]:
      K extends keyof RuleListToObject<typeof rules> ? (
        RuleListToObject<typeof rules>[K] extends RuleDef<K> ? RuleListToObject<typeof rules>[K] : never
      ) : (
        K extends Names ? (RuleDefs[K] extends RuleDef<K> ? RuleDefs[K] : never) : never
      )
    }> {
    this.rules = { ...this.rules, ...listToRuleDefMap(rules) };
    return <any> <unknown> this;
  }

  public deleteRule<U extends Names>(ruleName: U):
  Builder<Exclude<Names, U>, { [K in Exclude<Names, U>]: RuleDefs[K] extends RuleDef<K> ? RuleDefs[K] : never }> {
    delete this.rules[ruleName];
    return <Builder<Exclude<Names, U>, { [K in Exclude<Names, U>]: RuleDefs[K] extends RuleDef<K> ? RuleDefs[K] : never }>>
      <unknown> this;
  }

  public merge<OtherNames extends string, OtherRules extends RuleDefMap<OtherNames>, OW extends readonly RuleDef[]>(
    builder: Builder<OtherNames, OtherRules>,
    overridingRules: OW,
  ):
    Builder<
      Names | OtherNames | RuleNamesFromList<OW>,
      {[K in Names | OtherNames | RuleNamesFromList<OW>]:
        K extends keyof RuleListToObject<OW> ? (
          RuleListToObject<OW>[K] extends RuleDef<K> ? RuleListToObject<OW>[K] : never
        )
        : (
          K extends Names ? (RuleDefs[K] extends RuleDef<K> ? RuleDefs[K] : never)
          : K extends OtherNames ? (OtherRules[K] extends RuleDef<K> ? OtherRules[K] : never) : never
        )}> {
    // Assume the other grammar is bigger than yours. So start from that one and add this one
    const otherRules: Record<string, RuleDef> = { ...builder.rules };
    const myRules: Record<string, RuleDef> = this.rules;

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
            throw new Error(`Rule with name "${rule.name}" already exists in the builder, specify an override to resolve conflict`);
          }
        }
      }
    }

    this.rules = <any> <unknown> otherRules;
    return <any> <unknown> this;
  }

  public consumeToParser({ tokenVocabulary, parserConfig = {}, lexerConfig = {}}: {
    tokenVocabulary: TokenType[];
    parserConfig?: IParserConfig;
    lexerConfig?: ILexerConfig;
  }, context: Partial<ImplArgs['context']> = {}): ParserFromRules<Names, RuleDefs> {
    const lexer: Lexer = new Lexer(tokenVocabulary, {
      positionTracking: 'onlyStart',
      recoveryEnabled: false,
      // SafeMode: true,
      // SkipValidations: true,
      ensureOptimizations: true,
      ...lexerConfig,
    });
    const parser = this.consume({ tokenVocabulary, config: parserConfig }, context);
    const selfSufficientParser: Partial<ParserFromRules<Names, RuleDefs>> = {};
    // eslint-disable-next-line ts/no-unnecessary-type-assertion
    for (const rule of <RuleDef<Names>[]> Object.values(this.rules)) {
      selfSufficientParser[rule.name] = <any> ((input: string, arg: unknown) => {
        // Transform input in accordance to 19.2
        input = input.replaceAll(
          /\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/gu,
          (_, unicode4: string, unicode8: string) => {
            if (unicode4) {
              const charCode = Number.parseInt(unicode4, 16);
              return String.fromCodePoint(charCode);
            }
            const charCode = Number.parseInt(unicode8, 16);
            if (charCode < 0xFFFF) {
              return String.fromCodePoint(charCode);
            }
            const substractedCharCode = charCode - 0x10000;
            return String.fromCodePoint(0xD800 + (substractedCharCode >> 10), 0xDC00 + (substractedCharCode & 0x3FF));
          },
        );
        // Test for invalid unicode surrogate pairs
        if (/[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/u.test(input)) {
          throw new Error(`Invalid unicode codepoint of surrogate pair without corresponding codepoint`);
        }

        const lexResult = lexer.tokenize(input);
        // Console.log(lexResult.tokens);

        parser.reset();
        parser.input = lexResult.tokens;
        const result = parser[rule.name](arg);
        if (parser.errors.length > 0) {
          // Console.log(lexResult.tokens);
          throw new Error(`Parse error on line ${parser.errors.map(x => x.token.startLine).join(', ')}
${parser.errors.map(x => `${x.token.startLine}: ${x.message}`).join('\n')}`);
        }
        return result;
      });
    }
    return <ParserFromRules<Names, RuleDefs>> selfSufficientParser;
  }

  public consume({ tokenVocabulary, config = {}}: {
    tokenVocabulary: TokenVocabulary;
    config?: IParserConfig;
  }, context: Partial<ImplArgs['context']> = {}): EmbeddedActionsParser & ParseMethodsFromRules<Names, RuleDefs> {
    const rules = this.rules;
    class MyParser extends EmbeddedActionsParser {
      private readonly initialParseContext: ImplArgs['context'];
      private readonly runningContext: ImplArgs['context'];

      public constructor() {
        super(tokenVocabulary, {
          // RecoveryEnabled: true,
          maxLookahead: 2,
          // SkipValidations: true,
          ...config,
        });

        const selfRef = this.getSelfRef();
        // !!! Remember to change the RESET function accordingly !!!
        this.initialParseContext = {
          dataFactory: new DataFactory({ blankNodePrefix: 'g_' }),
          baseIRI: undefined,
          parseMode: new Set(),
          skipValidation: false,
          ...context,
          prefixes: context.prefixes ? { ...context.prefixes } : {},
        };
        this.runningContext = {
          ...this.initialParseContext,
          prefixes: { ...this.initialParseContext.prefixes },
          parseMode: new Set(this.initialParseContext.parseMode),
        };

        const implArgs: ImplArgs = {
          ...selfRef,
          cache: new WeakMap(),
          context: this.runningContext,
        };

        for (const rule of Object.values(<Record<string, RuleDef>>rules)) {
          this[<keyof (typeof this)> rule.name] = <any> this.RULE(rule.name, rule.impl(implArgs));
        }
        this.performSelfAnalysis();
      }

      public override reset(): void {
        super.reset();
        // We need to keep the original object reference.
        Object.assign(this.runningContext, {
          ...this.initialParseContext,
        });
        this.runningContext.prefixes = { ...this.initialParseContext.prefixes };
        this.runningContext.parseMode = new Set(this.initialParseContext.parseMode);
      }

      private getSelfRef(): CstDef {
        const subRuleImpl = (subrule: typeof this.SUBRULE): CstDef['SUBRULE'] => {
          return ((cstDef, ...args) => {
            return subrule(<any> this[<keyof (typeof this)> cstDef.name], <any> { ARGS: args });
          }) satisfies CstDef['SUBRULE'];
        }
        return {
          CONSUME: (tokenType, option) => this.CONSUME(tokenType, option),
          CONSUME1: (tokenType, option) => this.CONSUME1(tokenType, option),
          CONSUME2: (tokenType, option) => this.CONSUME2(tokenType, option),
          CONSUME3: (tokenType, option) => this.CONSUME3(tokenType, option),
          CONSUME4: (tokenType, option) => this.CONSUME4(tokenType, option),
          CONSUME5: (tokenType, option) => this.CONSUME5(tokenType, option),
          CONSUME6: (tokenType, option) => this.CONSUME6(tokenType, option),
          CONSUME7: (tokenType, option) => this.CONSUME7(tokenType, option),
          CONSUME8: (tokenType, option) => this.CONSUME8(tokenType, option),
          CONSUME9: (tokenType, option) => this.CONSUME9(tokenType, option),
          OPTION: actionORMethodDef => this.OPTION(actionORMethodDef),
          OPTION1: actionORMethodDef => this.OPTION1(actionORMethodDef),
          OPTION2: actionORMethodDef => this.OPTION2(actionORMethodDef),
          OPTION3: actionORMethodDef => this.OPTION3(actionORMethodDef),
          OPTION4: actionORMethodDef => this.OPTION4(actionORMethodDef),
          OPTION5: actionORMethodDef => this.OPTION5(actionORMethodDef),
          OPTION6: actionORMethodDef => this.OPTION6(actionORMethodDef),
          OPTION7: actionORMethodDef => this.OPTION7(actionORMethodDef),
          OPTION8: actionORMethodDef => this.OPTION8(actionORMethodDef),
          OPTION9: actionORMethodDef => this.OPTION9(actionORMethodDef),
          OR: altsOrOpts => this.OR(altsOrOpts),
          OR1: altsOrOpts => this.OR1(altsOrOpts),
          OR2: altsOrOpts => this.OR2(altsOrOpts),
          OR3: altsOrOpts => this.OR3(altsOrOpts),
          OR4: altsOrOpts => this.OR4(altsOrOpts),
          OR5: altsOrOpts => this.OR5(altsOrOpts),
          OR6: altsOrOpts => this.OR6(altsOrOpts),
          OR7: altsOrOpts => this.OR7(altsOrOpts),
          OR8: altsOrOpts => this.OR8(altsOrOpts),
          OR9: altsOrOpts => this.OR9(altsOrOpts),
          MANY: actionORMethodDef => this.MANY(actionORMethodDef),
          MANY1: actionORMethodDef => this.MANY1(actionORMethodDef),
          MANY2: actionORMethodDef => this.MANY2(actionORMethodDef),
          MANY3: actionORMethodDef => this.MANY3(actionORMethodDef),
          MANY4: actionORMethodDef => this.MANY4(actionORMethodDef),
          MANY5: actionORMethodDef => this.MANY5(actionORMethodDef),
          MANY6: actionORMethodDef => this.MANY6(actionORMethodDef),
          MANY7: actionORMethodDef => this.MANY7(actionORMethodDef),
          MANY8: actionORMethodDef => this.MANY8(actionORMethodDef),
          MANY9: actionORMethodDef => this.MANY9(actionORMethodDef),
          MANY_SEP: options => this.MANY_SEP(options),
          MANY_SEP1: options => this.MANY_SEP1(options),
          MANY_SEP2: options => this.MANY_SEP2(options),
          MANY_SEP3: options => this.MANY_SEP3(options),
          MANY_SEP4: options => this.MANY_SEP4(options),
          MANY_SEP5: options => this.MANY_SEP5(options),
          MANY_SEP6: options => this.MANY_SEP6(options),
          MANY_SEP7: options => this.MANY_SEP7(options),
          MANY_SEP8: options => this.MANY_SEP8(options),
          MANY_SEP9: options => this.MANY_SEP9(options),
          AT_LEAST_ONE: actionORMethodDef => this.AT_LEAST_ONE(actionORMethodDef),
          AT_LEAST_ONE1: actionORMethodDef => this.AT_LEAST_ONE1(actionORMethodDef),
          AT_LEAST_ONE2: actionORMethodDef => this.AT_LEAST_ONE2(actionORMethodDef),
          AT_LEAST_ONE3: actionORMethodDef => this.AT_LEAST_ONE3(actionORMethodDef),
          AT_LEAST_ONE4: actionORMethodDef => this.AT_LEAST_ONE4(actionORMethodDef),
          AT_LEAST_ONE5: actionORMethodDef => this.AT_LEAST_ONE5(actionORMethodDef),
          AT_LEAST_ONE6: actionORMethodDef => this.AT_LEAST_ONE6(actionORMethodDef),
          AT_LEAST_ONE7: actionORMethodDef => this.AT_LEAST_ONE7(actionORMethodDef),
          AT_LEAST_ONE8: actionORMethodDef => this.AT_LEAST_ONE8(actionORMethodDef),
          AT_LEAST_ONE9: actionORMethodDef => this.AT_LEAST_ONE9(actionORMethodDef),
          AT_LEAST_ONE_SEP: options => this.AT_LEAST_ONE_SEP(options),
          AT_LEAST_ONE_SEP1: options => this.AT_LEAST_ONE_SEP1(options),
          AT_LEAST_ONE_SEP2: options => this.AT_LEAST_ONE_SEP2(options),
          AT_LEAST_ONE_SEP3: options => this.AT_LEAST_ONE_SEP3(options),
          AT_LEAST_ONE_SEP4: options => this.AT_LEAST_ONE_SEP4(options),
          AT_LEAST_ONE_SEP5: options => this.AT_LEAST_ONE_SEP5(options),
          AT_LEAST_ONE_SEP6: options => this.AT_LEAST_ONE_SEP6(options),
          AT_LEAST_ONE_SEP7: options => this.AT_LEAST_ONE_SEP7(options),
          AT_LEAST_ONE_SEP8: options => this.AT_LEAST_ONE_SEP8(options),
          AT_LEAST_ONE_SEP9: options => this.AT_LEAST_ONE_SEP9(options),
          ACTION: func => this.ACTION(func),
          BACKTRACK: (cstDef, ...args) => {
            try {
              return this.BACKTRACK(<any> this[<keyof (typeof this)> cstDef.name], <any> { ARGS: args });
            } catch (error: unknown) {
              throw error;
            }
          },
          SUBRULE: subRuleImpl((rule, args) => this.SUBRULE(rule, args)),
          SUBRULE1: subRuleImpl((rule, args) => this.SUBRULE1(rule, args)),
          SUBRULE2: subRuleImpl((rule, args) => this.SUBRULE2(rule, args)),
          SUBRULE3: subRuleImpl((rule, args) => this.SUBRULE3(rule, args)),
          SUBRULE4: subRuleImpl((rule, args) => this.SUBRULE4(rule, args)),
          SUBRULE5: subRuleImpl((rule, args) => this.SUBRULE5(rule, args)),
          SUBRULE6: subRuleImpl((rule, args) => this.SUBRULE6(rule, args)),
          SUBRULE7: subRuleImpl((rule, args) => this.SUBRULE7(rule, args)),
          SUBRULE8: subRuleImpl((rule, args) => this.SUBRULE8(rule, args)),
          SUBRULE9: subRuleImpl((rule, args) => this.SUBRULE9(rule, args)),
        };
      }
    }
    return <EmbeddedActionsParser & ParseMethodsFromRules<Names, RuleDefs>><unknown> new MyParser();
  }
}
