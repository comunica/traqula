import { describe, it, expectTypeOf } from 'vitest';
import type {
  ContainerPaths,
  KnownNodeKeys,
  ObjectKeyHint,
  PathKey,
  TransformContext,
  TransformerSubTyped,
  TransformerTyped,
  VisitContext,
  VisitPath,
} from '../lib/index.js';
import type { CanHoldNode } from '../lib/transformers/TransformerTyped.js';

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
  rows: { literal?: Literal; label: string; within: { literal: Literal }}[];
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
      expectTypeOf<KnownNodeKeys<Nodes>['pattern']>().toEqualTypeOf<{ subject: true; predicate: true }>();
      expectTypeOf<KnownNodeKeys<Nodes>['term']>().toEqualTypeOf<Record<string, never>>();
      expectTypeOf<{ pattern: { subject: true }}>().not.toExtend<KnownNodeKeys<Pattern>>();
    });

    it('accepts paths within the value of a known node key, and rejects other paths', () => {
      expectTypeOf<{ rows: [[ '*', 'literal' ], [ 0, 'within', 'literal' ]]}>()
        .toExtend<KnownNodeKeys<Shelf>['shelf']>();
      expectTypeOf<{ rows: true }>().toExtend<KnownNodeKeys<Shelf>['shelf']>();
      expectTypeOf<{ rows: [[ '*', 'label' ]]}>().not.toExtend<KnownNodeKeys<Shelf>['shelf']>();
      expectTypeOf<{ rows: [[ '*', 'literal', 'value' ]]}>().not.toExtend<KnownNodeKeys<Shelf>['shelf']>();
    });

    it('only steps through objects without a type, and ends at objects', () => {
      type RowPaths = ContainerPaths<Shelf['rows']>;
      expectTypeOf<[ '*' ] | [ 0, 'literal' ] | [ '*', 'within' ] | [ 1, '*', 'literal' ]>().toExtend<RowPaths>();
      expectTypeOf<[ '*', 'label' ]>().not.toExtend<RowPaths>();
      expectTypeOf<[ '*', 'literal', 'value' ]>().not.toExtend<RowPaths>();
      expectTypeOf<[ 'rows' ]>().not.toExtend<RowPaths>();
      expectTypeOf<ContainerPaths<{ unknown: unknown }>>().toEqualTypeOf<
        readonly ['unknown', ...PathKey[]] | readonly ['*', ...PathKey[]]
      >();
      expectTypeOf<ContainerPaths<Literal>>().toEqualTypeOf<never>();
    });

    it('hints the first key of a path to visit, but accepts any path', () => {
      expectTypeOf<VisitPath<Pattern>>().toEqualTypeOf<readonly [ObjectKeyHint<Pattern>, ...PathKey[]]>();
      expectTypeOf<NonNullable<VisitContext<Pattern>['visitPaths']>>().toEqualTypeOf<readonly VisitPath<Pattern>[]>();
      expectTypeOf<TransformContext<Pattern>>().toExtend<TransformContext<Shelf>>();
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
