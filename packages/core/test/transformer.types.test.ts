import { describe, it, expectTypeOf } from 'vitest';
import type {
  ChildKey,
  ChildValue,
  KnownKeyVisitor,
  KnownNodeKeys,
  ObjectKeyHint,
  TransformContext,
  TransformerSubTyped,
  TransformerTyped,
  VisitChildren,
  VisitContext,
} from '../lib/index.js';
import type { CanHoldNode } from '../lib/transformers/TransformerTyped.js';
import type { SourceLocation } from '../lib/types.js';

interface Pattern {
  type: 'pattern';
  subject: Literal;
  predicate: Literal;
}

interface Literal {
  type: 'term';
  subType: 'literal';
  value: string;
}

interface Shelf {
  type: 'shelf';
  rows: {
    literal?: Literal;
    label: string;
    within: { literal: Literal };
    loc: SourceLocation;
    term: { termType: 'Quad'; subject: Literal };
  }[];
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

    it('requires known node keys to list exactly the keys that can hold nodes', () => {
      expectTypeOf<KnownNodeKeys<Nodes>['pattern']>().toEqualTypeOf<{
        subject: true | KnownKeyVisitor<Pattern>;
        predicate: true | KnownKeyVisitor<Pattern>;
      }>();
      expectTypeOf<KnownNodeKeys<Nodes>['term']>().toEqualTypeOf<Record<string, never>>();
      expectTypeOf<{ pattern: { subject: true }}>().not.toExtend<KnownNodeKeys<Pattern>>();
    });

    it('accepts a visitor for a known node key', ({ expect }) => {
      expectTypeOf<{ rows: KnownKeyVisitor<Shelf> }>().toExtend<KnownNodeKeys<Shelf>['shelf']>();
      expectTypeOf<{ rows: true }>().toExtend<KnownNodeKeys<Shelf>['shelf']>();
      expectTypeOf<{ rows: []}>().not.toExtend<KnownNodeKeys<Shelf>['shelf']>();
      const visitRows: KnownKeyVisitor<Shelf> = (shelf, visitKey, stepIntoKey) => {
        visitKey(stepIntoKey(stepIntoKey(shelf, 'rows'), 0), 'literal');
      };
      expect(visitRows).toBeTypeOf('function');
    });

    it('names the keys and values of objects, also of unions, and the indexes of arrays', () => {
      expectTypeOf<ChildKey<Shelf>>().toEqualTypeOf<'type' | 'rows'>();
      expectTypeOf<ChildKey<Shelf['rows']>>().toEqualTypeOf<number>();
      expectTypeOf<ChildValue<Shelf['rows'], number>>().toEqualTypeOf<Shelf['rows'][number]>();
      expectTypeOf<ChildKey<Pattern | Literal>>()
        .toEqualTypeOf<'type' | 'subject' | 'predicate' | 'subType' | 'value'>();
      expectTypeOf<ChildValue<Pattern | Literal, 'type'>>().toEqualTypeOf<'pattern' | 'term'>();
      expectTypeOf<ChildValue<Pattern | Literal, 'value'>>().toEqualTypeOf<string | undefined>();
    });

    it('keeps the context of a node a context of any object', () => {
      expectTypeOf<VisitContext<Pattern>['visitChildren']>().toEqualTypeOf<VisitChildren<Pattern> | undefined>();
      expectTypeOf<TransformContext<Pattern>>().toExtend<TransformContext>();
    });

    it('finds nodes within arrays and objects without a type, but not within skipped values', () => {
      interface Location {
        start: number;
        within?: Location;
      }
      expectTypeOf<CanHoldNode<string | undefined>>().toEqualTypeOf<false>();
      expectTypeOf<CanHoldNode<() => Literal>>().toEqualTypeOf<false>();
      expectTypeOf<CanHoldNode<{ untyped: { value: string }}>>().toEqualTypeOf<false>();
      expectTypeOf<CanHoldNode<{ untyped: object }>>().toEqualTypeOf<true>();
      expectTypeOf<CanHoldNode<{ termType: 'Quad'; subject: Literal }>>().toEqualTypeOf<false>();
      expectTypeOf<CanHoldNode<string | Record<string, Literal>[]>>().toEqualTypeOf<true>();
      expectTypeOf<CanHoldNode<unknown>>().toEqualTypeOf<true>();
      expectTypeOf<CanHoldNode<Location | { location: Location }, Location>>().toEqualTypeOf<false>();
      expectTypeOf<CanHoldNode<Literal, Literal>>().toEqualTypeOf<true>();
    });
  });
});
