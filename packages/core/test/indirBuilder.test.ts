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
      expect(() => builder.addRuleRedundant(ruleADup)).toThrow(
        'Function ruleA already exists in the builder',
      );
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
});
