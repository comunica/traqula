import { describe, it } from 'vitest';
import { createToken } from '@traqula/core';
import { LexerBuilder } from '@traqula/core';

describe('LexerBuilder', () => {
  // Create some basic tokens for testing
  const tokenA = createToken({ name: 'TokenA', pattern: /a+/ });
  const tokenB = createToken({ name: 'TokenB', pattern: /b+/ });
  const tokenC = createToken({ name: 'TokenC', pattern: /c+/ });
  const tokenD = createToken({ name: 'TokenD', pattern: /d+/ });

  describe('create', () => {
    it('creates an empty builder', ({ expect }) => {
      const builder = LexerBuilder.create();
      expect(builder.tokenVocabulary).toHaveLength(0);
    });

    it('creates a copy of an existing builder', ({ expect }) => {
      const original = LexerBuilder.create().add(tokenA);
      const copy = LexerBuilder.create(original);
      expect(copy.tokenVocabulary).toHaveLength(1);
    });
  });

  describe('add', () => {
    it('adds tokens to the builder', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA).add(tokenB);
      expect(builder.tokenVocabulary).toHaveLength(2);
      expect(builder.tokenVocabulary[0]).toBe(tokenA);
      expect(builder.tokenVocabulary[1]).toBe(tokenB);
    });
  });

  describe('addBefore', () => {
    it('inserts a token before an existing token', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA).add(tokenB);
      builder.addBefore(tokenB, tokenC);
      expect(builder.tokenVocabulary[1]).toBe(tokenC);
      expect(builder.tokenVocabulary[2]).toBe(tokenB);
    });

    it('throws when the reference token is not found', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA);
      expect(() => builder.addBefore(tokenB as any, tokenC)).toThrow('Token not found');
    });
  });

  describe('addAfter', () => {
    it('inserts a token after an existing token', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA).add(tokenB);
      builder.addAfter(tokenA, tokenC);
      expect(builder.tokenVocabulary[0]).toBe(tokenA);
      expect(builder.tokenVocabulary[1]).toBe(tokenC);
      expect(builder.tokenVocabulary[2]).toBe(tokenB);
    });

    it('throws when the reference token is not found', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA);
      expect(() => (builder as any).addAfter(tokenB, tokenC)).toThrow('Token not found');
    });
  });

  describe('moveBefore', () => {
    it('moves a token before another token', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA).add(tokenB).add(tokenC);
      builder.moveBefore(tokenA, tokenC as any);
      // tokenC should now be before tokenA
      expect(builder.tokenVocabulary[0]).toBe(tokenC);
      expect(builder.tokenVocabulary[1]).toBe(tokenA);
      expect(builder.tokenVocabulary[2]).toBe(tokenB);
    });

    it('throws when the before token is not found', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA).add(tokenB);
      expect(() => builder.moveBefore(tokenC as any, tokenA as any)).toThrow('BeforeToken not found');
    });

    it('throws when the token to move is not found', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA).add(tokenB);
      expect(() => builder.moveBefore(tokenA, tokenD as any)).toThrow('Token not found');
    });
  });

  describe('moveAfter', () => {
    it('moves a token after another token', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA).add(tokenB).add(tokenC);
      builder.moveAfter(tokenA, tokenC as any);
      // tokenC should now be after tokenA
      expect(builder.tokenVocabulary[0]).toBe(tokenA);
      expect(builder.tokenVocabulary[1]).toBe(tokenC);
      expect(builder.tokenVocabulary[2]).toBe(tokenB);
    });
  });

  describe('delete', () => {
    it('removes a token from the builder', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA).add(tokenB).add(tokenC);
      (builder as any).delete(tokenB);
      expect(builder.tokenVocabulary).toHaveLength(2);
      expect(builder.tokenVocabulary).not.toContain(tokenB);
    });

    it('throws when the token to delete is not found', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA);
      expect(() => (builder as any).delete(tokenB)).toThrow('Token not found');
    });
  });

  describe('merge', () => {
    it('merges two builders', ({ expect }) => {
      const builder1 = LexerBuilder.create().add(tokenA);
      const builder2 = LexerBuilder.create().add(tokenB);
      builder1.merge(builder2);
      expect(builder1.tokenVocabulary).toHaveLength(2);
      expect(builder1.tokenVocabulary).toContain(tokenB);
    });

    it('skips tokens that are already present (same reference)', ({ expect }) => {
      const builder1 = LexerBuilder.create().add(tokenA);
      const builder2 = LexerBuilder.create().add(tokenA).add(tokenB);
      builder1.merge(builder2);
      // tokenA should not be duplicated
      expect(builder1.tokenVocabulary.filter(t => t === tokenA)).toHaveLength(1);
      expect(builder1.tokenVocabulary).toHaveLength(2);
    });

    it('throws when merging conflicting tokens with same name but different implementation', ({ expect }) => {
      const tokenAConflict = createToken({ name: 'TokenA', pattern: /different/ });
      const builder1 = LexerBuilder.create().add(tokenA);
      const builder2 = LexerBuilder.create().add(tokenAConflict);
      expect(() => builder1.merge(builder2)).toThrow('already exists');
    });

    it('allows overriding conflicting tokens with overwrite list', ({ expect }) => {
      const tokenAOverwrite = createToken({ name: 'TokenA', pattern: /a+/ });
      const builder1 = LexerBuilder.create().add(tokenA);
      const builder2 = LexerBuilder.create().add(tokenAOverwrite);
      // No conflict because tokenAOverwrite is in the overwrite list
      expect(() => builder1.merge(builder2, [ tokenAOverwrite ])).not.toThrow();
    });
  });

  describe('build', () => {
    it('builds a working lexer', ({ expect }) => {
      const whitespace = createToken({ name: 'WS', pattern: /\s+/, group: 'SKIPPED' });
      const word = createToken({ name: 'Word', pattern: /\w+/ });
      const lexer = LexerBuilder.create().add(whitespace).add(word).build();
      const result = lexer.tokenize('hello world');
      expect(result.errors).toHaveLength(0);
      expect(result.tokens).toHaveLength(2);
    });
  });

  describe('tokenVocabulary', () => {
    it('returns the list of tokens', ({ expect }) => {
      const builder = LexerBuilder.create().add(tokenA).add(tokenB);
      const vocab = builder.tokenVocabulary;
      expect(vocab).toHaveLength(2);
      expect(vocab[0]).toBe(tokenA);
      expect(vocab[1]).toBe(tokenB);
    });
  });
});
