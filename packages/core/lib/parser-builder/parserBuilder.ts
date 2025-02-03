import type { ILexerConfig, IParserConfig } from '@chevrotain/types';
import type { TokenType, TokenVocabulary } from 'chevrotain';
import { EmbeddedActionsParser, Lexer } from 'chevrotain';
import type { CheckOverlap } from '../utils';
import type {
  ParseMethodsFromRules,
  ParserFromRules,
  ParseRuleMap,
  ParseRulesToObject,
  ParseNamesFromList,
} from './builderTypes';
import type { CstDef, ImplArgs, ParserRule } from './ruleDefTypes';

/**
 * Converts a list of ruledefs to a record mapping a name to the corresponding ruledef.
 */
function listToRuleDefMap<T extends readonly ParserRule[]>(rules: T): ParseRulesToObject<T> {
  const newRules: Record<string, ParserRule> = {};
  for (const rule of rules) {
    newRules[rule.name] = rule;
  }
  return <ParseRulesToObject<T>>newRules;
}

/**
 * The grammar builder. This is the core of traqula (besides using the amazing chevrotain framework).
 * Using the builder you can create a grammar + AST creator.
 * At any point in time, a parser can be constructed from the added rules.
 * Constructing a parser will cause a validation which will validate the correctness of the grammar.
 */
// This code is wild so other code can be simple.
export class Builder<Context, Names extends string, RuleDefs extends ParseRuleMap<Names>> {
  /**
   * Create a builder from some initial grammar rules or an existing builder.
   * If a builder is provided, a new copy will be created.
   */
  public static createBuilder<
    Rules extends readonly ParserRule[] = readonly ParserRule[],
    Context = Rules[0] extends ParserRule<infer context> ? context : never,
    Names extends string = ParseNamesFromList<Rules>,
    RuleDefs extends ParseRuleMap<Names> = ParseRulesToObject<Rules>,
  >(
    start: Rules | Builder<Context, Names, RuleDefs>,
  ): Builder<Context, Names, RuleDefs> {
    if (start instanceof Builder) {
      return new Builder({ ...start.rules });
    }
    return <Builder<Context, Names, RuleDefs>> <unknown> new Builder(listToRuleDefMap(start));
  }

  private rules: RuleDefs;

  private constructor(startRules: RuleDefs) {
    this.rules = startRules;
  }

  /**
   * Change the implementation of an existing grammar rule.
   */
  public patchRule<U extends Names, RET, ARGS>(patch: ParserRule<Context, U, RET, ARGS>):
  Builder<Context, Names, {[Key in Names]: Key extends U ?
    ParserRule<Context, Key, RET, ARGS> :
      (RuleDefs[Key] extends ParserRule<Context, Key> ? RuleDefs[Key] : never)
  } > {
    const self = <Builder<Context, Names, {[Key in Names]: Key extends U ?
      ParserRule<Context, Key, RET, ARGS> : (RuleDefs[Key] extends ParserRule<Context, Key> ? RuleDefs[Key] : never) }>>
      <unknown> this;
    self.rules[patch.name] = <any> patch;
    return self;
  }

  /**
   * Add a rule to the grammar. If the rule already exists, but the implementation differs, an error will be thrown.
   */
  public addRuleRedundant<U extends string, RET, ARGS>(rule: ParserRule<Context, U, RET, ARGS>):
  Builder<Context, Names | U, {[K in Names | U]: K extends U ?
    ParserRule<Context, K, RET, ARGS> :
      (K extends Names ? (RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never) : never)
  }> {
    const self = <Builder<Context, Names | U, {[K in Names | U]: K extends U ?
      ParserRule<Context, K, RET, ARGS> :
        (K extends Names ? (RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never) : never) }>>
      <unknown> this;
    const rules = <Record<string, ParserRule<Context>>> self.rules;
    if (rules[rule.name] !== undefined && rules[rule.name] !== rule) {
      throw new Error(`Rule ${rule.name} already exists in the builder`);
    }
    rules[rule.name] = rule;
    return self;
  }

  /**
   * Add a rule to the grammar. Will raise a typescript error if the rule already exists in the grammar.
   */
  public addRule<U extends string, RET, ARGS>(
    rule: CheckOverlap<U, Names, ParserRule<Context, U, RET, ARGS>>,
  ): Builder<Context, Names | U, {[K in Names | U]: K extends U ?
    ParserRule<Context, K, RET, ARGS> :
      (K extends Names ? (RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never) : never) }> {
    return this.addRuleRedundant(rule);
  }

  public addMany<U extends readonly ParserRule<Context>[]>(
    ...rules: CheckOverlap<ParseNamesFromList<U>, Names, U>
  ): Builder<
      Context,
    Names | ParseNamesFromList<U>,
    {[K in Names | ParseNamesFromList<U>]:
      K extends keyof ParseRulesToObject<typeof rules> ? (
        ParseRulesToObject<typeof rules>[K] extends ParserRule<Context, K> ? ParseRulesToObject<typeof rules>[K] : never
      ) : (
        K extends Names ? (RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never) : never
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
  Builder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
    RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never }> {
    delete this.rules[ruleName];
    return <Builder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
      RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never }>>
      <unknown> this;
  }

  /**
   * Merge this grammar builder with another.
   * It is best to merge the bigger grammar with the smaller one.
   * If the two builders both have a grammar rule with the same name,
   * no error will be thrown case they map to the same ruledef object.
   * If they map to a different object, an error will be thrown.
   * To fix this problem, the overridingRules array should contain a rule with the same conflicting name,
   * this rule implementation will be used.
   */
  public merge<
    OtherNames extends string,
    OtherRules extends ParseRuleMap<OtherNames>,
    OW extends readonly ParserRule<Context>[],
  >(
    builder: Builder<Context, OtherNames, OtherRules>,
    overridingRules: OW,
  ):
    Builder<
      Context,
      Names | OtherNames | ParseNamesFromList<OW>,
      {[K in Names | OtherNames | ParseNamesFromList<OW>]:
        K extends keyof ParseRulesToObject<OW> ? (
          ParseRulesToObject<OW>[K] extends ParserRule<Context, K> ? ParseRulesToObject<OW>[K] : never
        )
          : (
              K extends Names ? (RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never)
                : K extends OtherNames ? (OtherRules[K] extends ParserRule<Context, K> ? OtherRules[K] : never) : never
            ) }
    > {
    // Assume the other grammar is bigger than yours. So start from that one and add this one
    const otherRules: Record<string, ParserRule<Context>> = { ...builder.rules };
    const myRules: Record<string, ParserRule<Context>> = this.rules;

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
  }): ParserFromRules<Context, Names, RuleDefs> {
    const lexer: Lexer = new Lexer(tokenVocabulary, {
      positionTracking: 'onlyStart',
      recoveryEnabled: false,
      // SafeMode: true,
      // SkipValidations: true,
      ensureOptimizations: true,
      ...lexerConfig,
    });
    // Get the chevrotain parser
    const parser = this.consume({ tokenVocabulary, config: parserConfig });
    // Start building a parser that does not pass input using a state, but instead gets it as a function argument.
    const selfSufficientParser: Partial<ParserFromRules<Context, Names, RuleDefs>> = {};
    // To do that, we need to create a wrapper for each parser rule.
    // eslint-disable-next-line ts/no-unnecessary-type-assertion
    for (const rule of <ParserRule<Context, Names>[]> Object.values(this.rules)) {
      selfSufficientParser[rule.name] = <any> ((input: string, context: Context, arg: unknown) => {
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
        if (/[\uD800-\uDBFF](?:[^\uDC00-\uDFFF]|$)/u.test(input)) {
          throw new Error(`Invalid unicode codepoint of surrogate pair without corresponding codepoint`);
        }

        const lexResult = lexer.tokenize(input);

        // This also resets the parser
        parser.input = lexResult.tokens;
        parser.setContext(context);
        const result = parser[rule.name](context, arg);
        if (parser.errors.length > 0) {
          // Console.log(lexResult.tokens);
          throw new Error(`Parse error on line ${parser.errors.map(x => x.token.startLine).join(', ')}
${parser.errors.map(x => `${x.token.startLine}: ${x.message}`).join('\n')}`);
        }
        return result;
      });
    }
    return <ParserFromRules<Context, Names, RuleDefs>> selfSufficientParser;
  }

  public consume({ tokenVocabulary, config = {}}: {
    tokenVocabulary: TokenVocabulary;
    config?: IParserConfig;
  }): EmbeddedActionsParser & ParseMethodsFromRules<Context, Names, RuleDefs> &
    { setContext: (context: Context) => void } {
    const rules = this.rules;
    class MyParser extends EmbeddedActionsParser {
      private context: Context | undefined;

      private getSafeContext(): Context {
        if (this.context === undefined) {
          throw new Error('context was not correctly set');
        }
        return this.context;
      }

      public setContext(context: Context): void {
        this.context = context;
      }

      public constructor() {
        super(tokenVocabulary, {
          // RecoveryEnabled: true,
          maxLookahead: 2,
          // SkipValidations: true,
          ...config,
        });
        this.context = undefined;
        const selfRef = this.getSelfRef();
        const implArgs: ImplArgs = {
          ...selfRef,
          cache: new WeakMap(),
        };

        for (const rule of Object.values(<Record<string, ParserRule<Context>>>rules)) {
          this[<keyof (typeof this)> rule.name] = <any> this.RULE(rule.name, rule.impl(implArgs));
        }
        this.performSelfAnalysis();
      }

      private getSelfRef(): CstDef {
        const subRuleImpl = (chevrotainSubrule: typeof this.SUBRULE): CstDef['SUBRULE'] =>
          ((cstDef, arg) =>
            chevrotainSubrule(<any> this[<keyof (typeof this)> cstDef.name], <any> { ARGS: [ this.context, arg ]})
          ) satisfies CstDef['SUBRULE'];
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
          BACKTRACK: (cstDef, ...args) =>
            this.BACKTRACK(<any> this[<keyof (typeof this)> cstDef.name], <any> { ARGS: args }),
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
    return <EmbeddedActionsParser & ParseMethodsFromRules<Context, Names, RuleDefs> &
      { setContext: (context: Context) => void }><unknown> new MyParser();
  }
}
