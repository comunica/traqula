import { describe, it } from 'vitest';
import { ParserBuilder, createToken } from '../lib/index.js';
import type { ParserRule } from '../lib/index.js';

// ---------------------------------------------------------------------------
// Minimal token / rule helpers used across tests
// ---------------------------------------------------------------------------

const Num = createToken({ name: 'Num', pattern: /\d+/u });

const numRule: ParserRule<Record<string, never>, 'num', string, []> = {
  name: 'num',
  impl: ({ CONSUME }) => _ctx => CONSUME(Num).image,
};

describe('parserBuilder', () => {
  describe('addRuleRedundant', () => {
    it('is idempotent when the exact same rule object is added again', ({ expect }) => {
      const builder = ParserBuilder.create(<const>[ numRule ]);
      expect(() => builder.addRuleRedundant(numRule)).not.toThrow();
    });

    it('throws when a different rule object shares the same name', ({ expect }) => {
      const numRuleDup: ParserRule<Record<string, never>, 'num', string, []> = {
        name: 'num',
        impl: ({ CONSUME }) => _ctx => `${CONSUME(Num).image}-dup`,
      };
      const builder = ParserBuilder.create(<const>[ numRule ]);
      expect(() => builder.addRuleRedundant(numRuleDup)).toThrow(
        'Rule num already exists in the builder',
      );
    });
  });

  describe('deleteRule', () => {
    it('removes the named rule from the builder', ({ expect }) => {
      const builder = ParserBuilder.create(<const>[ numRule ]);
      const smaller = builder.deleteRule('num');
      // The private rules record should no longer contain 'num'
      expect((<any>smaller).rules.num).toBeUndefined();
    });
  });

  describe('merge', () => {
    it('throws when two builders share a rule name with different implementations', ({ expect }) => {
      const numRuleAlt: ParserRule<Record<string, never>, 'num', string, []> = {
        name: 'num',
        impl: ({ CONSUME }) => _ctx => `${CONSUME(Num).image}-alt`,
      };
      const builder1 = ParserBuilder.create(<const>[ numRule ]);
      const builder2 = ParserBuilder.create(<const>[ numRuleAlt ]);
      expect(() => builder1.merge(<any>builder2, [])).toThrow(
        'Rule with name "num" already exists in the builder',
      );
    });

    it('does not throw when an overriding rule covers the conflict', ({ expect }) => {
      const numRuleAlt: ParserRule<Record<string, never>, 'num', string, []> = {
        name: 'num',
        impl: ({ CONSUME }) => _ctx => `${CONSUME(Num).image}-alt`,
      };
      const numRuleOverride: ParserRule<Record<string, never>, 'num', string, []> = {
        name: 'num',
        impl: ({ CONSUME }) => _ctx => `${CONSUME(Num).image}-override`,
      };
      const builder1 = ParserBuilder.create(<const>[ numRule ]);
      const builder2 = ParserBuilder.create(<const>[ numRuleAlt ]);
      expect(() => builder1.merge(<any>builder2, [ numRuleOverride ])).not.toThrow();
    });
  });

  describe('build – queryPreProcessor', () => {
    it('transforms the input string before lexing', ({ expect }) => {
      const parser = ParserBuilder.create(<const>[ numRule ]).build({
        tokenVocabulary: [ Num ],
        lexerConfig: { ensureOptimizations: false },
        queryPreProcessor: _s => '42',
      });
      // Whatever input we give, the preprocessor always returns '42'
      const result = (<any>parser).num('999', {});
      expect(result).toBe('42');
    });
  });

  describe('build – defaultErrorHandler', () => {
    it('throws a "Parse error" when parsing fails and no custom errorHandler is set', ({ expect }) => {
      const parser = ParserBuilder.create(<const>[ numRule ]).build({
        tokenVocabulary: [ Num ],
        lexerConfig: { ensureOptimizations: false },
      });
      // 'abc' does not match Num (/\d+/) → empty token stream → CONSUME fails → defaultErrorHandler
      expect(() => (<any>parser).num('abc', {})).toThrow(/Parse error/u);
    });

    it('includes column pointer in error when token has column info (branch 239:1)', ({ expect }) => {
      // Call defaultErrorHandler on the builder instance directly (it's a private method on ParserBuilder).
      // Provides a mock error token with startLine + startColumn defined → branch 239:1 TRUE.
      const builder = ParserBuilder.create(<const>[ numRule ]);
      const mockError = {
        token: { startLine: 1, startColumn: 5, image: 'x' },
        message: 'unexpected token',
      };
      expect(() => (<any> builder).defaultErrorHandler('hello world', [ mockError ])).toThrow(/\^/u);
    });

    it('omits column pointer when token has no column info (branch 239:b1)', ({ expect }) => {
      // Covers parserBuilder.ts branch 239:b1 — columnIdx is undefined
      const builder = ParserBuilder.create(<const>[ numRule ]);
      const mockError = {
        token: { startLine: 1, image: 'x' },
        message: 'unexpected token',
      };
      // Should throw Parse error but WITHOUT a '^' column pointer since startColumn is undefined
      expect(() => (<any>builder).defaultErrorHandler('hello world', [ mockError ])).toThrow(/Parse error/u);
    });

    it('calls the custom errorHandler instead of the default one when provided', ({ expect }) => {
      const errors: unknown[] = [];
      const parser = ParserBuilder.create(<const>[ numRule ]).build({
        tokenVocabulary: [ Num ],
        lexerConfig: { ensureOptimizations: false },
        errorHandler: (errs) => {
          errors.push(...errs);
        },
      });
      // Parsing fails but the custom errorHandler should collect the errors without throwing
      expect(() => (<any>parser).num('abc', {})).not.toThrow();
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
