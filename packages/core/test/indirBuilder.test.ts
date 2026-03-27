import { describe, it } from 'vitest';
import { IndirBuilder } from '@traqula/core';
import type { IndirDef } from '@traqula/core';

interface TestContext {
  prefix: string;
}

describe('IndirBuilder', () => {
  const greetRule: IndirDef<TestContext, 'greet', string, []> = {
    name: 'greet',
    fun: () => (ctx) => `${ctx.prefix} world`,
  };

  const shoutRule: IndirDef<TestContext, 'shout', string, [string]> = {
    name: 'shout',
    fun: () => (ctx, msg) => `${ctx.prefix} ${msg.toUpperCase()}`,
  };

  describe('create from array', () => {
    it('creates a builder from an array of rules', ({ expect }) => {
      const builder = IndirBuilder.create([ greetRule ]);
      expect(builder).toBeDefined();
    });

    it('creates a copy of an existing builder', ({ expect }) => {
      const original = IndirBuilder.create([ greetRule ]);
      const copy = IndirBuilder.create(original);
      expect(copy).toBeDefined();
    });
  });

  describe('build', () => {
    it('builds an indirection object that can be called', ({ expect }) => {
      const built = IndirBuilder.create([ greetRule ]).build();
      const ctx: TestContext = { prefix: 'Hello' };
      expect((built as any).greet(ctx)).toBe('Hello world');
    });

    it('passes arguments to the rule function', ({ expect }) => {
      const built = IndirBuilder.create([ shoutRule ]).build();
      const ctx: TestContext = { prefix: 'Hey' };
      expect((built as any).shout(ctx, 'there')).toBe('Hey THERE');
    });
  });

  describe('patchRule', () => {
    it('replaces an existing rule', ({ expect }) => {
      const patchedGreet: IndirDef<TestContext, 'greet', string, []> = {
        name: 'greet',
        fun: () => (ctx) => `${ctx.prefix} patched`,
      };
      const built = IndirBuilder.create([ greetRule ]).patchRule(patchedGreet).build();
      const ctx: TestContext = { prefix: 'Hi' };
      expect((built as any).greet(ctx)).toBe('Hi patched');
    });
  });

  describe('addRuleRedundant', () => {
    it('adds a new rule', ({ expect }) => {
      const built = IndirBuilder.create([ greetRule ]).addRuleRedundant(shoutRule).build();
      const ctx: TestContext = { prefix: 'Hi' };
      expect((built as any).greet(ctx)).toBe('Hi world');
      expect((built as any).shout(ctx, 'yo')).toBe('Hi YO');
    });

    it('accepts the same rule instance as a no-op', ({ expect }) => {
      expect(() => {
        IndirBuilder.create([ greetRule ]).addRuleRedundant(greetRule);
      }).not.toThrow();
    });

    it('throws when adding a different rule with the same name', ({ expect }) => {
      const conflictRule: IndirDef<TestContext, 'greet', string, []> = {
        name: 'greet',
        fun: () => () => 'conflict',
      };
      expect(() => {
        IndirBuilder.create([ greetRule ]).addRuleRedundant(conflictRule);
      }).toThrow('Function greet already exists in the builder');
    });
  });

  describe('addRule', () => {
    it('adds a new rule', ({ expect }) => {
      const builder = IndirBuilder.create([ greetRule ]).addRule(shoutRule);
      const built = builder.build();
      const ctx: TestContext = { prefix: 'Hi' };
      expect((built as any).shout(ctx, 'test')).toBe('Hi TEST');
    });
  });

  describe('addMany', () => {
    it('adds multiple rules at once', ({ expect }) => {
      const extraRule: IndirDef<TestContext, 'extra', number, []> = {
        name: 'extra',
        fun: () => () => 42,
      };
      const built = IndirBuilder.create([]).addMany(greetRule, shoutRule, extraRule).build();
      const ctx: TestContext = { prefix: 'Hi' };
      expect((built as any).greet(ctx)).toBe('Hi world');
      expect((built as any).extra(ctx)).toBe(42);
    });
  });

  describe('deleteRule', () => {
    it('removes a rule from the builder', ({ expect }) => {
      const built = IndirBuilder.create([ greetRule, shoutRule ]).deleteRule('shout').build();
      // shout should be gone
      expect((built as any).shout).toBeUndefined();
      // greet should still work
      const ctx: TestContext = { prefix: 'Hi' };
      expect((built as any).greet(ctx)).toBe('Hi world');
    });
  });

  describe('getRule', () => {
    it('returns the rule definition by name', ({ expect }) => {
      const builder = IndirBuilder.create([ greetRule ]);
      const rule = builder.getRule('greet');
      expect(rule).toBe(greetRule);
    });
  });

  describe('SUBRULE', () => {
    it('allows rules to call other rules via SUBRULE', ({ expect }) => {
      const baseRule: IndirDef<TestContext, 'base', string, []> = {
        name: 'base',
        fun: () => (ctx) => ctx.prefix,
      };
      const compositeRule: IndirDef<TestContext, 'composite', string, []> = {
        name: 'composite',
        fun: ({ SUBRULE }) => (ctx) => `${SUBRULE(baseRule)} composed`,
      };
      const built = IndirBuilder.create([ baseRule, compositeRule ]).build();
      const ctx: TestContext = { prefix: 'prefix' };
      expect((built as any).composite(ctx)).toBe('prefix composed');
    });
  });
});
