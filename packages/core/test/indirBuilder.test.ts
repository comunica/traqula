import { describe, it } from 'vitest';
import { IndirBuilder } from '../lib/index.js';
import type { IndirDef } from '../lib/index.js';

describe('indirBuilder', () => {
  describe('addRuleRedundant', () => {
    it('is idempotent when the exact same rule object is added again', ({ expect }) => {
      const ruleA: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a',
      };
      const builder = IndirBuilder.create([ ruleA ]);
      expect(() => builder.addRuleRedundant(ruleA)).not.toThrow();
    });

    it('throws when a different rule object has the same name', ({ expect }) => {
      const ruleA: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a',
      };
      const ruleADup: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a-dup',
      };
      const builder = IndirBuilder.create([ ruleA ]);
      expect(() => builder.addRuleRedundant(ruleADup)).toThrow('Function ruleA already exists in the builder');
    });
  });

  describe('deleteRule', () => {
    it('removes the named rule from the builder', ({ expect }) => {
      const ruleA: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a',
      };
      const builder = IndirBuilder.create([ ruleA ]);
      const smaller = builder.deleteRule('ruleA');
      // After deletion the built object should not expose ruleA
      const built = <any>smaller.build();
      expect(built.ruleA).toBeUndefined();
    });

    it('removes the named rule from the builder bis', ({ expect }) => {
      const ruleA: IndirDef<Record<string, never>, 'ruleA', string, []> =
        { name: 'ruleA', fun: () => () => 'a' };
      const builder = IndirBuilder.create(<const>[ ruleA ]);
      const smaller = builder.deleteMany('ruleA');
      // The private rules record should no longer contain 'num'
      expect((<any>smaller).rules.ruleA).toBeUndefined();
    });

    it('removes the named rules from the builder', ({ expect }) => {
      const ruleA: IndirDef<Record<string, never>, 'ruleA', string, []> =
        { name: 'ruleA', fun: () => () => 'a' };
      const ruleB: IndirDef<Record<string, never>, 'ruleB', string, []> =
        { name: 'ruleB', fun: () => () => 'b' };
      const builder = IndirBuilder.create(<const>[ ruleA, ruleB ]);
      expect((<any>builder).rules.ruleA).toBeDefined();
      expect((<any>builder).rules.ruleB).toBeDefined();
      const smaller = builder.deleteMany('ruleA', 'ruleB');
      // The private rules record should no longer contain 'num'
      expect((<any>smaller).rules.ruleA).toBeUndefined();
      expect((<any>smaller).rules.ruleB).toBeUndefined();
    });
  });

  describe('dynamicIndirect subrule error', () => {
    it('throws when a called subrule is not present in the builder', ({ expect }) => {
      // RuleB is referenced inside ruleA but is NOT added to the builder
      const ruleB: IndirDef<Record<string, never>, 'ruleB', string, []> = {
        name: 'ruleB',
        fun: () => _ctx => 'b',
      };
      const ruleA: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: ({ SUBRULE }) => _ctx => SUBRULE(ruleB),
      };
      const built = <any>IndirBuilder.create([ ruleA ]).build();
      expect(() => built.ruleA({})).toThrow('Rule ruleB not found');
    });
  });

  describe('merge', () => {
    it('merges two builders with non-overlapping rules', ({ expect }) => {
      const ruleA: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a',
      };
      const ruleB: IndirDef<Record<string, never>, 'ruleB', string, []> = {
        name: 'ruleB',
        fun: () => _ctx => 'b',
      };
      const builderA = IndirBuilder.create([ ruleA ]);
      const builderB = IndirBuilder.create([ ruleB ]);
      const merged = builderA.merge(builderB, <const> []);
      const built = <any>merged.build();
      expect(built.ruleA({})).toBe('a');
      expect(built.ruleB({})).toBe('b');
    });

    it('merges without error when both builders share the same rule reference', ({ expect }) => {
      const ruleA: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a',
      };
      const builderA = IndirBuilder.create([ ruleA ]);
      const builderB = IndirBuilder.create([ ruleA ]);
      const merged = builderA.merge(builderB, <const> []);
      const built = <any>merged.build();
      expect(built.ruleA({})).toBe('a');
    });

    it('uses the override when conflicting rules are provided', ({ expect }) => {
      const ruleA1: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a1',
      };
      const ruleA2: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a2',
      };
      const override: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'override',
      };
      const builderA = IndirBuilder.create([ ruleA1 ]);
      const builderB = IndirBuilder.create([ ruleA2 ]);
      const merged = builderA.merge(builderB, <const> [ override ]);
      const built = <any>merged.build();
      expect(built.ruleA({})).toBe('override');
    });

    it('throws when conflicting rules have no override', ({ expect }) => {
      const ruleA1: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a1',
      };
      const ruleA2: IndirDef<Record<string, never>, 'ruleA', string, []> = {
        name: 'ruleA',
        fun: () => _ctx => 'a2',
      };
      const builderA = IndirBuilder.create([ ruleA1 ]);
      const builderB = IndirBuilder.create([ ruleA2 ]);
      expect(() => builderA.merge(builderB, <const> [])).toThrow(
        'Function with name "ruleA" already exists in the builder, specify an override to resolve conflict',
      );
    });
  });
});
