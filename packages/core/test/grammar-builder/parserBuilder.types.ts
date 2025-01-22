/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
import {describe, it} from 'vitest';
import {Builder} from '../../lib';
import {SparqlContext, SparqlRuleDef} from "@traqula/rules-sparql-1-1";

const RuleA: SparqlRuleDef<'apple', 'apple'> = <any> undefined;
const RuleB: SparqlRuleDef<'banana', 'banana'> = <any> undefined;
const RuleC: SparqlRuleDef<'coconut', 'coconut'> = <any> undefined;

describe('parserBuilder', () => {
  describe('types', () => {
    it('builder constructor', () => {
      expectTypeOf(Builder.createBuilder(<const> [ RuleA ]))
        .branded.toEqualTypeOf<Builder<SparqlContext, 'apple', { apple: typeof RuleA }>>();
      expectTypeOf(Builder.createBuilder(<const> [ RuleB ]))
        .branded.toEqualTypeOf<Builder<SparqlContext, 'banana', { banana: typeof RuleB }>>();
      expectTypeOf(Builder.createBuilder(<const> [ RuleA, RuleB ]))
        .branded.toEqualTypeOf<Builder<SparqlContext, 'apple' | 'banana', { apple: typeof RuleA, banana: typeof RuleB }>>();

      // AddRule
      expectTypeOf(Builder.createBuilder(<const> [ RuleA, RuleB ]).addRule(RuleC))
        .branded.toEqualTypeOf<Builder<SparqlContext, 'apple' | 'banana' | 'coconut',
          { apple: typeof RuleA, banana: typeof RuleB, coconut: typeof RuleC }>>();

      // Merge
      expectTypeOf(
        Builder.createBuilder(<const> [ RuleA ]).
          merge(Builder.createBuilder(<const> [ RuleB ]), <const> [])
      ).branded.toEqualTypeOf<Builder<SparqlContext, 'apple' | 'banana', { apple: typeof RuleA, banana: typeof RuleB }>>();

      expectTypeOf(
        Builder.createBuilder(<const> [ RuleA, RuleB ]).
        merge(Builder.createBuilder(<const> [ RuleB, RuleC ]), <const> [])
      ).branded.toEqualTypeOf<Builder<SparqlContext, 'apple' | 'banana' | 'coconut',
          { apple: typeof RuleA, banana: typeof RuleB, coconut: typeof RuleC }>>();
    });
  });
});
