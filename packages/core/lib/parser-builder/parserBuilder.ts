import type { ILexerConfig, IParserConfig, IRecognitionException } from '@chevrotain/types';
import type { Lexer, TokenType, TokenVocabulary, EmbeddedActionsParser } from 'chevrotain';
import { LexerBuilder } from '../lexer-builder/LexerBuilder';
import type { CheckOverlap } from '../utils';
import type {
  ParseMethodsFromRules,
  ParseNamesFromList,
  ParserFromRules,
  ParseRuleMap,
  ParseRulesToObject,
} from './builderTypes';
import { DynamicParser } from './dynamicParser';
import type { ParserRule } from './ruleDefTypes';

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
export class ParserBuilder<Context, Names extends string, RuleDefs extends ParseRuleMap<Names>> {
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
    start: Rules | ParserBuilder<Context, Names, RuleDefs>,
  ): ParserBuilder<Context, Names, RuleDefs> {
    if (start instanceof ParserBuilder) {
      return new ParserBuilder({ ...start.rules });
    }
    return <ParserBuilder<Context, Names, RuleDefs>> <unknown> new ParserBuilder(listToRuleDefMap(start));
  }

  private rules: RuleDefs;

  private constructor(startRules: RuleDefs) {
    this.rules = startRules;
  }

  public typePatch<Patch extends {[Key in Names]?: any }>():
  ParserBuilder<Context, Names, {[Key in Names]: Key extends keyof Patch ? (
    RuleDefs[Key] extends ParserRule<Context, Key, any, infer Par> ? ParserRule<Context, Key, Patch[Key], Par> : never
  ) : (RuleDefs[Key] extends ParserRule<Context, Key> ? RuleDefs[Key] : never) }> {
    return <ParserBuilder<Context, Names, {[Key in Names]: Key extends keyof Patch ? (
      RuleDefs[Key] extends ParserRule<Context, Key, any, infer Par> ? ParserRule<Context, Key, Patch[Key], Par> : never
    ) : (RuleDefs[Key] extends ParserRule<Context, Key> ? RuleDefs[Key] : never) }>> <unknown> this;
  }

  /**
   * Change the implementation of an existing grammar rule.
   */
  public patchRule<U extends Names, RET, ARGS>(patch: ParserRule<Context, U, RET, ARGS>):
  ParserBuilder<Context, Names, {[Key in Names]: Key extends U ?
    ParserRule<Context, Key, RET, ARGS> :
      (RuleDefs[Key] extends ParserRule<Context, Key> ? RuleDefs[Key] : never)
  } > {
    const self = <ParserBuilder<Context, Names, {[Key in Names]: Key extends U ?
      ParserRule<Context, Key, RET, ARGS> : (RuleDefs[Key] extends ParserRule<Context, Key> ? RuleDefs[Key] : never) }>>
      <unknown> this;
    self.rules[patch.name] = <any> patch;
    return self;
  }

  /**
   * Add a rule to the grammar. If the rule already exists, but the implementation differs, an error will be thrown.
   */
  public addRuleRedundant<U extends string, RET, ARGS>(rule: ParserRule<Context, U, RET, ARGS>):
  ParserBuilder<Context, Names | U, {[K in Names | U]: K extends U ?
    ParserRule<Context, K, RET, ARGS> :
      (K extends Names ? (RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never) : never)
  }> {
    const self = <ParserBuilder<Context, Names | U, {[K in Names | U]: K extends U ?
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
  ): ParserBuilder<Context, Names | U, {[K in Names | U]: K extends U ?
    ParserRule<Context, K, RET, ARGS> :
      (K extends Names ? (RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never) : never) }> {
    return this.addRuleRedundant(rule);
  }

  public addMany<U extends readonly ParserRule<Context>[]>(
    ...rules: CheckOverlap<ParseNamesFromList<U>, Names, U>
  ): ParserBuilder<
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
  ParserBuilder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
    RuleDefs[K] extends ParserRule<Context, K> ? RuleDefs[K] : never }> {
    delete this.rules[ruleName];
    return <ParserBuilder<Context, Exclude<Names, U>, {[K in Exclude<Names, U>]:
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
    builder: ParserBuilder<Context, OtherNames, OtherRules>,
    overridingRules: OW,
  ):
    ParserBuilder<
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

  private defaultErrorHandler(input: string, errors: IRecognitionException[]): void {
    const firstError = errors[0];
    const messageBuilder: string[] = [ 'Parse error' ];
    const lineIdx = firstError.token.startLine;
    if (lineIdx !== undefined) {
      const errorLine = input.split('\n')[lineIdx - 1];
      messageBuilder.push(` on line ${lineIdx}
${errorLine}`);
      const columnIdx = firstError.token.startColumn;
      if (columnIdx !== undefined) {
        messageBuilder.push(`\n${'-'.repeat(columnIdx - 1)}^`);
      }
    }
    messageBuilder.push(`\n${firstError.message}`);
    throw new Error(messageBuilder.join(''));
  }

  public build({
    tokenVocabulary,
    parserConfig = {},
    lexerConfig = {},
    queryPreProcessor = s => s,
    errorHandler,
  }: {
    tokenVocabulary: readonly TokenType[];
    parserConfig?: IParserConfig;
    lexerConfig?: ILexerConfig;
    queryPreProcessor?: (input: string) => string;
    errorHandler?: (errors: IRecognitionException[]) => void;
  }): ParserFromRules<Context, Names, RuleDefs> {
    const lexer: Lexer = LexerBuilder.create().add(...tokenVocabulary).build(lexerConfig);

    // Get the chevrotain parser
    const parser = this.consume({
      tokenVocabulary: <TokenType[]> tokenVocabulary,
      config: parserConfig,
    });

    // Start building a parser accepts a string instead of tokenized input
    const selfSufficientParser: Partial<ParserFromRules<Context, Names, RuleDefs>> = {};

    // To do that, we need to create a wrapper for each parser rule.
    // eslint-disable-next-line ts/no-unnecessary-type-assertion
    for (const rule of <ParserRule<Context, Names>[]> Object.values(this.rules)) {
      selfSufficientParser[rule.name] = <any> ((input: string, context: Context, arg: unknown) => {
        const processedInput = queryPreProcessor(input);
        const lexResult = lexer.tokenize(processedInput);

        // This also resets the parser
        parser.input = lexResult.tokens;
        parser.setContext(context);
        const result = parser[rule.name](context, arg);
        if (parser.errors.length > 0) {
          if (errorHandler) {
            errorHandler(parser.errors);
          } else {
            this.defaultErrorHandler(processedInput, parser.errors);
          }
        }
        return result;
      });
    }
    return <ParserFromRules<Context, Names, RuleDefs>> selfSufficientParser;
  }

  private consume({ tokenVocabulary, config = {}}: {
    tokenVocabulary: TokenVocabulary;
    config?: IParserConfig;
  }): EmbeddedActionsParser & ParseMethodsFromRules<Context, Names, RuleDefs> &
    { setContext: (context: Context) => void } {
    return <EmbeddedActionsParser & ParseMethodsFromRules<Context, Names, RuleDefs> &
      { setContext: (context: Context) => void }><unknown> new DynamicParser(this.rules, tokenVocabulary, config);
  }
}
