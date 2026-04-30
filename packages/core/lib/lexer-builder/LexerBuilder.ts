import type { ILexerConfig, TokenType } from '@traqula/chevrotain';
import { Lexer } from '@traqula/chevrotain';
import type { CheckOverlap, NamedToken } from '../utils.js';

/**
 * Builder for constructing Chevrotain lexers with type-safe token management.
 * Token ordering matters — the lexer matches the first token that fits, so more specific
 * tokens (e.g., keywords) must be positioned before more general ones (e.g., identifiers).
 *
 * Builders mutate internal state and return `this`.
 * Always start by copying an existing builder with `LexerBuilder.create(existingBuilder)`.
 */
export class LexerBuilder<NAMES extends string = string> {
  private readonly tokens: TokenType[];

  /**
   * Create a new LexerBuilder, optionally copying from an existing one.
   * @param starter - An existing builder to copy tokens from. If omitted, starts empty.
   */
  public static create<U extends LexerBuilder<T>, T extends string = never>(starter?: U): U {
    return <U> new LexerBuilder(starter);
  }

  private constructor(starter?: LexerBuilder<NAMES>) {
    this.tokens = starter?.tokens ? [ ...starter.tokens ] : [];
  }

  /**
   * Merge tokens from another LexerBuilder into this one.
   * Duplicate tokens (by reference) are skipped. Different tokens with the same name
   * cause an error unless an override is provided.
   * @param merge - The other builder whose tokens to merge.
   * @param overwrite - Tokens that take precedence when names conflict.
   */
  public merge<OtherNames extends string, OW extends string>(
    merge: LexerBuilder<OtherNames>,
    overwrite: NamedToken<OW>[] = [],
  ):
    LexerBuilder<NAMES | OtherNames> {
    const extraTokens = merge.tokens.filter((token) => {
      const overwriteToken = overwrite.find(t => t.name === token.name);
      if (overwriteToken) {
        return false;
      }
      const match = this.tokens.find(t => t.name === token.name);
      if (match) {
        if (match !== token) {
          throw new Error(`Token with name ${token.name} already exists. Implementation is different and no overwrite was provided.`);
        }
        return false;
      }
      return true;
    });
    this.tokens.push(...extraTokens);
    return this;
  }

  /**
   * Append tokens to the end of the builder's token list.
   * TypeScript errors if a token name already exists.
   * @param token - One or more tokens to add.
   */
  public add<Name extends string>(...token: CheckOverlap<Name, NAMES, NamedToken<Name>[]>):
  LexerBuilder<Name | NAMES> {
    this.tokens.push(...token);
    return this;
  }

  /**
   * Insert tokens before a specified reference token in the ordering.
   * @param before - The existing token to insert before.
   * @param token - One or more tokens to insert.
   */
  public addBefore<Name extends string>(
    before: NamedToken<NAMES>,
    ...token: CheckOverlap<Name, NAMES, NamedToken<Name>[]>
  ): LexerBuilder<NAMES | Name> {
    const index = this.tokens.indexOf(before);
    if (index === -1) {
      throw new Error('Token not found');
    }
    this.tokens.splice(index, 0, ...token);
    return this;
  }

  private moveBeforeOrAfter<Name extends string>(
    beforeOrAfter: 'before' | 'after',
    before: NamedToken<NAMES>,
    ...tokens: CheckOverlap<Name, NAMES, never, NamedToken<Name>[]>
  ): LexerBuilder<NAMES> {
    const beforeIndex = this.tokens.indexOf(before) + (beforeOrAfter === 'before' ? 0 : 1);
    if (beforeIndex === -1) {
      throw new Error('BeforeToken not found');
    }
    for (const token of tokens) {
      const tokenIndex = this.tokens.indexOf(token);
      if (tokenIndex === -1) {
        throw new Error('Token not found');
      }
      this.tokens.splice(tokenIndex, 1);
      this.tokens.splice(beforeIndex, 0, token);
    }
    return this;
  }

  /**
   * Move existing tokens so they appear before a specified reference token.
   * The tokens must already exist in the builder.
   * @param before - The reference token to move before.
   * @param tokens - The tokens to reposition.
   */
  public moveBefore<Name extends string>(
    before: NamedToken<NAMES>,
    ...tokens: CheckOverlap<Name, NAMES, never, NamedToken<Name>[]>
  ): LexerBuilder<NAMES> {
    return this.moveBeforeOrAfter('before', before, ...tokens);
  }

  /**
   * Move existing tokens so they appear after a specified reference token.
   * The tokens must already exist in the builder.
   * @param after - The reference token to move after.
   * @param tokens - The tokens to reposition.
   */
  public moveAfter<Name extends string>(
    after: NamedToken<NAMES>,
    ...tokens: CheckOverlap<Name, NAMES, never, NamedToken<Name>[]>
  ): LexerBuilder<NAMES> {
    return this.moveBeforeOrAfter('after', after, ...tokens);
  }

  /**
   * Insert tokens after a specified reference token in the ordering.
   * @param after - The existing token to insert after.
   * @param token - One or more tokens to insert.
   */
  public addAfter<Name extends string>(
    after: NamedToken<NAMES>,
    ...token: CheckOverlap<Name, NAMES, NamedToken<Name>[]>
  ): LexerBuilder<NAMES | Name> {
    const index = this.tokens.indexOf(after);
    if (index === -1) {
      throw new Error('Token not found');
    }
    this.tokens.splice(index + 1, 0, ...token);
    return this;
  }

  /**
   * Remove tokens from the builder by reference.
   * @param token - One or more tokens to remove. Throws if a token is not found.
   */
  public delete<Name extends NAMES>(...token: NamedToken<Name>[]): LexerBuilder<Exclude<NAMES, Name>> {
    for (const t of token) {
      const index = this.tokens.indexOf(t);
      if (index === -1) {
        throw new Error('Token not found');
      }
      this.tokens.splice(index, 1);
    }
    return this;
  }

  /**
   * Construct a Chevrotain {@link Lexer} from the current token ordering.
   * @param lexerConfig - Optional Chevrotain lexer configuration overrides.
   */
  public build(lexerConfig?: ILexerConfig): Lexer {
    return new Lexer(this.tokens, {
      positionTracking: 'onlyStart',
      recoveryEnabled: false,
      ensureOptimizations: true,
      // SafeMode: true,
      // SkipValidations: true,
      ...lexerConfig,
    });
  }

  /**
   * Get the current token list (readonly).
   * Useful for passing to {@link ParserBuilder.build} as the `tokenVocabulary` argument.
   */
  public get tokenVocabulary(): readonly TokenType[] {
    return this.tokens;
  }
}
