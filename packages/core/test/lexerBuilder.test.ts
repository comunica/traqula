import { describe, it } from 'vitest';
import { LexerBuilder, createToken } from '../lib/index.js';

const TokenA = createToken({ name: 'TokenA', pattern: /a/u });
const TokenB = createToken({ name: 'TokenB', pattern: /b/u });
const TokenC = createToken({ name: 'TokenC', pattern: /c/u });

describe('lexerBuilder', () => {
  describe('addBefore', () => {
    it('throws Token not found when the before-anchor is not in the list', ({ expect }) => {
      const builder = LexerBuilder.create().add(TokenA);
      // TokenB is not in the builder, so it cannot be used as the anchor
      expect(() => (<any>builder).addBefore(TokenB, TokenC)).toThrow('Token not found');
    });
  });

  describe('addAfter', () => {
    it('throws Token not found when the after-anchor is not in the list', ({ expect }) => {
      const builder = LexerBuilder.create().add(TokenA);
      // TokenB is not in the builder
      expect(() => (<any>builder).addAfter(TokenB, TokenC)).toThrow('Token not found');
    });
  });

  describe('delete', () => {
    it('throws Token not found when the token is not in the list', ({ expect }) => {
      const builder = LexerBuilder.create().add(TokenA);
      expect(() => (<any>builder).delete(TokenB)).toThrow('Token not found');
    });
  });

  describe('moveBefore', () => {
    it('throws BeforeToken not found when the anchor token is not in the list', ({ expect }) => {
      const builder = LexerBuilder.create().add(TokenA, TokenB);
      // TokenC is not in the builder -> beforeIndex = indexOf(TokenC) + 0 = -1
      expect(() => (<any>builder).moveBefore(TokenC, TokenA)).toThrow('BeforeToken not found');
    });

    it('throws Token not found when the token to move is not in the list', ({ expect }) => {
      const builder = LexerBuilder.create().add(TokenA, TokenB);
      // TokenA is the anchor (exists), TokenC is the token to move (does not exist)
      expect(() => (<any>builder).moveBefore(TokenA, TokenC)).toThrow('Token not found');
    });
  });

  describe('moveAfter', () => {
    it('throws Token not found when the token to move is not in the list', ({ expect }) => {
      const builder = LexerBuilder.create().add(TokenA, TokenB);
      // TokenA is the anchor (exists), TokenC is the token to move (does not exist)
      expect(() => (<any>builder).moveAfter(TokenA, TokenC)).toThrow('Token not found');
    });
  });

  describe('merge', () => {
    it('throws when two builders share a token name with different implementations', ({ expect }) => {
      const builder1 = LexerBuilder.create().add(TokenA);
      const TokenADup = createToken({ name: 'TokenA', pattern: /A/u });
      const builder2 = LexerBuilder.create().add(TokenADup);
      expect(() => (<any>builder1).merge(builder2)).toThrow('Token with name TokenA already exists');
    });

    it('does not throw when an overwrite entry covers the conflicting token', ({ expect }) => {
      const builder1 = LexerBuilder.create().add(TokenA);
      const TokenADup = createToken({ name: 'TokenA', pattern: /A/u });
      const builder2 = LexerBuilder.create().add(TokenADup);
      const TokenAOverwrite = createToken({ name: 'TokenA', pattern: /A/u });
      expect(() => (<any>builder1).merge(builder2, [ TokenAOverwrite ])).not.toThrow();
    });
  });
});
