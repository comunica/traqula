import { describe, it, expectTypeOf } from 'vitest';
import type {
  ObjectKeyHint,
  TransformContext,
  TransformerSubTyped,
  TransformerTyped,
  VisitContext,
} from '../lib/index.js';

interface Pattern {
  type: 'pattern';
  subject: object;
  predicate: object;
}

interface Literal {
  type: 'term';
  subType: 'literal';
  value: string;
}

type Nodes = Pattern | Literal;

type AnyString = string & NonNullable<unknown>;

/**
 * The keys hinted by a context. Contexts themselves are compared loosely, since Set is bivariant.
 */
type HintedKeys<Context extends VisitContext<any> | undefined> =
  NonNullable<NonNullable<Context>['ignoreKeys']> extends Set<infer Key> ? Key : never;

describe('transformer', () => {
  describe('types', () => {
    it('hints the keys of an object', () => {
      expectTypeOf<ObjectKeyHint<Pattern>>().toEqualTypeOf<'type' | 'subject' | 'predicate' | AnyString>();
      expectTypeOf<ObjectKeyHint<object>>().toEqualTypeOf<AnyString>();
      expectTypeOf<HintedKeys<TransformContext>>().toEqualTypeOf<AnyString>();
    });

    it('accepts any string key set', () => {
      expectTypeOf<Set<string>>().toExtend<TransformContext<Pattern>['ignoreKeys']>();
      expectTypeOf<TransformContext<Pattern>>().toExtend<TransformContext>();
    });

    it('hints the keys of the node in typed callbacks', () => {
      type TransformCallBacks = NonNullable<Parameters<TransformerTyped<Nodes>['transformNode']>[1]['pattern']>;
      type VisitCallBacks = NonNullable<Parameters<TransformerTyped<Nodes>['visitNode']>[1]['pattern']>;
      expectTypeOf<HintedKeys<ReturnType<NonNullable<TransformCallBacks['preVisitor']>>>>()
        .toEqualTypeOf<ObjectKeyHint<Pattern>>();
      expectTypeOf<HintedKeys<ReturnType<NonNullable<VisitCallBacks['preVisitor']>>>>()
        .toEqualTypeOf<ObjectKeyHint<Pattern>>();
    });

    it('hints the keys of the node in subTyped callbacks', () => {
      type SpecificCallBacks = Parameters<TransformerSubTyped<Nodes>['transformNodeSpecific']>[2];
      type LiteralCallBacks = NonNullable<NonNullable<SpecificCallBacks['term']>['literal']>;
      expectTypeOf<HintedKeys<ReturnType<NonNullable<LiteralCallBacks['preVisitor']>>>>()
        .toEqualTypeOf<ObjectKeyHint<Literal>>();
    });

    it('hints the keys of the node in default node contexts', () => {
      type DefaultNodeContexts = NonNullable<Parameters<TransformerTyped<Nodes>['clone']>[1]>;
      expectTypeOf<HintedKeys<DefaultNodeContexts['pattern']>>().toEqualTypeOf<ObjectKeyHint<Pattern>>();
    });
  });
});
