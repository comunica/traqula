import { describe, it, expectTypeOf } from 'vitest';
import type { ParserRule } from '../../lib';
import { Builder } from '../../lib';

interface Context {
  world: 'hello';
}

const RuleA: ParserRule<Context, 'apple', 'apple'> = {
  name: 'apple',
  impl: () => () => 'apple',
};
const RuleB: ParserRule<Context, 'banana', 'banana'> = {
  name: 'banana',
  impl: () => () => 'banana',
};
const RuleC: ParserRule<Context, 'coconut', 'coconut'> = {
  name: 'coconut',
  impl: () => () => 'coconut',
};

describe('parserBuilder', () => {
  describe('types', () => {
    it('builder constructor', () => {
      expectTypeOf(Builder.createBuilder(<const> [ RuleA ]))
        .branded.toEqualTypeOf<Builder<Context, 'apple', { apple: typeof RuleA }>>();
      expectTypeOf(Builder.createBuilder(<const> [ RuleB ]))
        .branded.toEqualTypeOf<Builder<Context, 'banana', { banana: typeof RuleB }>>();
      expectTypeOf(Builder.createBuilder(<const> [ RuleA, RuleB ]))
        .branded
        .toEqualTypeOf<Builder<Context, 'apple' | 'banana', { apple: typeof RuleA; banana: typeof RuleB }>>();

      // AddRule
      expectTypeOf(Builder.createBuilder(<const> [ RuleA, RuleB ]).addRule(RuleC))
        .branded.toEqualTypeOf<Builder<
        Context,
'apple' | 'banana' | 'coconut',
{ apple: typeof RuleA; banana: typeof RuleB; coconut: typeof RuleC }
      >>();

      // Merge
      expectTypeOf(
        Builder.createBuilder(<const> [ RuleA ])
          .merge(Builder.createBuilder(<const> [ RuleB ]), <const> []),
      ).branded
        .toEqualTypeOf<Builder<Context, 'apple' | 'banana', { apple: typeof RuleA; banana: typeof RuleB }>>();

      expectTypeOf(
        Builder.createBuilder(<const> [ RuleA, RuleB ])
          .merge(Builder.createBuilder(<const> [ RuleB, RuleC ]), <const> []),
      ).branded
        .toEqualTypeOf<Builder<
          Context,
'apple' | 'banana' | 'coconut',
{ apple: typeof RuleA; banana: typeof RuleB; coconut: typeof RuleC }
      >>();
    });
  });
});
