import type { SourceLocation, Typed } from '../types.js';
import type {
  Awaitable,
  PreOrderMappingReturn,
  StepIntoKey,
  TransformContext,
  VisitChildren,
  VisitContext,
  VisitKey,
} from './TransformerObject.js';
import {
  canonicalContext,
  mapAwaitable,
  TransformerObject,
} from './TransformerObject.js';

/**
 * The context of a node without a callback or per type default, shared to not allocate one per node.
 */
const emptyContext: TransformContext = Object.freeze(canonicalContext({}));

/**
 * Whether a value is a node: an object with a string type.
 * @param value the value to check.
 * @return whether the value is a node.
 */
export function isNode(value: unknown): value is Typed {
  return value !== null && typeof value === 'object' && typeof (<Partial<Typed>> value).type === 'string';
}

/**
 * Controls whether transform callbacks receive fully typed nodes (`'unsafe'`) or
 * nodes where all fields are `unknown` (`'safe'`). Using `'safe'` (the default)
 * forces explicit type narrowing, reducing the risk of incorrect assumptions.
 */
export type Safeness = 'safe' | 'unsafe';
/**
 * Conditionally wraps an object type: in `'safe'` mode, all fields become `unknown`;
 * in `'unsafe'` mode, the original types are preserved.
 */
export type SafeWrap<Safe extends Safeness, obj extends object> =
  Safe extends 'safe' ? {[key in keyof obj]: unknown } : obj;

/**
 * Default pre-visitor configuration per node type. Provides default {@link TransformContext}
 * values that apply when no explicit preVisitor is given for a node type.
 */
export type DefaultNodePreVisitor<Nodes extends Typed> =
  {[T in Nodes['type']]?: TransformContext<Extract<Nodes, Typed<T>>> };

/**
 * All keys of an object, also when the object is a union of objects.
 */
export type AllObjectKeys<Obj> = Obj extends unknown ? keyof Obj & string : never;

/**
 * All values a key can have, also when the object is a union of objects.
 */
export type AllObjectValues<Obj, Key extends string> =
  Obj extends unknown ? (Key extends keyof Obj ? Obj[Key] : never) : never;

/**
 * Values that hold no nodes, and are thus not looked into by default: source locations and RDF terms.
 */
export type NodeFreeValue = SourceLocation | { termType: string };

/**
 * Whether a value can hold a node, directly or within arrays and objects without a type.
 * Values of type `Skipped` that are not nodes themselves are not looked into.
 */
export type CanHoldNode<Value, Skipped = NodeFreeValue> = unknown extends Value ? true :
  true extends MemberCanHoldNode<Value, Skipped> ? true : false;

/**
 * Any function, which holds no nodes.
 */
type AnyFunction = (...args: any[]) => unknown;

/**
 * {@link CanHoldNode} of each member of a union.
 */
type MemberCanHoldNode<Value, Skipped> = Value extends Typed ? true :
  Value extends Skipped | AnyFunction ? false :
    Value extends readonly (infer Element)[] ? CanHoldNode<Element, Skipped> :
      Value extends object ? ([keyof Value] extends [never] ? true : CanHoldNode<Value[keyof Value], Skipped>) : false;

/**
 * The keys of an object that can hold a node, also when the object is a union of objects.
 */
export type NodeHoldingKeys<Obj, Skipped = NodeFreeValue> = {[Key in AllObjectKeys<Obj>]:
  CanHoldNode<AllObjectValues<Obj, Key>, Skipped> extends true ? Key : never }[AllObjectKeys<Obj>];

/**
 * Per node type, exactly the keys that can hold a node, mapped to `true` or to the {@link VisitChildren} of the
 * value of the key, which is stepped into first.
 * The compiler rejects missing and other keys, also for a type without such keys.
 * @typeParam Skipped - Values that are not looked into, by default source locations and RDF terms.
 */
export type KnownNodeKeys<Nodes extends Typed, Skipped = NodeFreeValue> =
  {[T in Nodes['type']]: KnownNodeKeysOfType<Extract<Nodes, Typed<T>>, Skipped> };

/**
 * The {@link KnownNodeKeys} of a single node type.
 */
type KnownNodeKeysOfType<Node, Skipped, Keys extends string = NodeHoldingKeys<Node, Skipped>> = [Keys] extends [never] ?
  Record<string, never> :
    {[Key in Keys]: true | VisitChildren<Extract<AllObjectValues<Node, Key>, object>> };

/**
 * Creates a {@link DefaultNodePreVisitor} that per node type only visits the known keys that can hold nodes,
 * skipping unknown keys like those of an extension.
 * @param knownKeys per node type, the keys that can hold a node.
 * @return the contexts per node type, to give to a {@link TransformerTyped} or {@link TransformerSubTyped}.
 */
export function visitOnlyKnownKeys<Nodes extends Typed, Skipped = NodeFreeValue>(
  knownKeys: KnownNodeKeys<Nodes, Skipped>,
): DefaultNodePreVisitor<Nodes> {
  const contexts: Record<string, TransformContext> = {};
  for (const [ type, keys ] of Object.entries(knownKeys)) {
    const entries = Object.entries(<Record<string, true | VisitChildren>> keys);
    const visitedKeys = entries.filter(([ , visitor ]) => visitor === true).map(([ key ]) => key);
    const valueVisitors = entries.flatMap(([ key, visitor ]) => visitor === true ? [] : [{ key, visitor }]);
    // A callback reads the known keys only, instead of checking every key of the node
    const visitChildren: VisitChildren<Record<string, unknown>> = (node, visitKey, stepIntoKey) => {
      for (const key of visitedKeys) {
        visitKey(node, key);
      }
      for (const { key, visitor } of valueVisitors) {
        const value = stepIntoKey(node, key);
        if (value !== null && typeof value === 'object') {
          visitor(value, visitKey, stepIntoKey);
        }
      }
    };
    contexts[type] = { visitChildren: <VisitChildren> visitChildren };
  }
  return <DefaultNodePreVisitor<Nodes>> contexts;
}

/**
 * Type-aware AST transformer that dispatches visit and transform callbacks
 * based on the `type` field of {@link Typed} nodes.
 *
 * Extends {@link TransformerObject} with node-type-specific dispatch, so you can
 * register handlers per node type rather than filtering manually.
 *
 * For even more specific dispatch based on both `type` and `subType`,
 * see {@link TransformerSubTyped}.
 *
 * @typeParam Nodes - Union type of all node types this transformer handles.
 *   Each member must extend {@link Typed}.
 */
export class TransformerTyped<Nodes extends Typed> extends TransformerObject {
  public constructor(
    defaultContext: TransformContext = {},
    protected defaultNodePreVisitor: DefaultNodePreVisitor<Nodes> = {},
  ) {
    super(defaultContext);
    this.defaultNodePreVisitor = <DefaultNodePreVisitor<Nodes>> Object.fromEntries(Object.entries(defaultNodePreVisitor)
      .map(([ type, context ]) => [ type, canonicalContext(<TransformContext> context) ]));
  };

  public override clone(
    newDefaultContext: TransformContext = {},
    newDefaultNodePreVisitor: DefaultNodePreVisitor<Nodes> = {},
  ): TransformerTyped<Nodes> {
    return new TransformerTyped(
      { ...this.defaultContext, ...newDefaultContext },
      { ...this.defaultNodePreVisitor, ...newDefaultNodePreVisitor },
    );
  }

  /**
   * Whether a traversal visits the given key of an object, by the default of its node type or the default context.
   * With {@link VisitContext.visitChildren}, whether it visits the value of the key as a whole.
   * Lets hand-written traversals respect the defaults of this transformer, like its allowlists.
   * @param object the object holding the key.
   * @param key the key to visit.
   * @return whether the key is visited.
   */
  public visitsKey(object: object, key: string): boolean {
    const nodeDefault = this.nodeDefaultOf(object);
    if ((nodeDefault?.ignoreKeys ?? this.defaultContext.ignoreKeys)?.has(key)) {
      return false;
    }
    const visitChildren = nodeDefault?.visitChildren ?? this.defaultContext.visitChildren;
    if (!visitChildren) {
      return true;
    }
    let visited = false;
    const recordVisit = <VisitKey> ((holder: object, visitedKey: string): void => {
      visited ||= holder === object && visitedKey === key;
    });
    const stepIntoKey = <StepIntoKey> ((holder: Record<string, unknown> | undefined, steppedKey: string) =>
      holder?.[steppedKey]);
    visitChildren(object, recordVisit, stepIntoKey);
    return visited;
  }

  /**
   * The per type default of a node.
   * @param node the node, which need not be an object.
   * @return the default of its type, if any.
   */
  private nodeDefaultOf(node: unknown): TransformContext | undefined {
    return isNode(node) ? this.defaultNodePreVisitor[<Nodes['type']> node.type] : undefined;
  }

  /**
   * Completes the context a callback gave for a node with the per type default of that node.
   * @param node the node the context is for, which need not be an object.
   * @param context the context of the callback, or undefined when the node has no callback.
   * @return the per type default, overwritten by the given context.
   */
  protected withNodeDefault<Context extends VisitContext = TransformContext>(
    node: unknown,
    context?: Context,
  ): Context {
    // Inlines nodeDefaultOf, since this runs for every object of a traversal
    const type = (<Partial<Typed<Nodes['type']>> | undefined> node)?.type;
    const nodeDefault = typeof type === 'string' ? this.defaultNodePreVisitor[type] : undefined;
    if (nodeDefault === undefined) {
      return context ?? <Context> emptyContext;
    }
    return context ? { ...<Context> nodeDefault, ...context } : <Context> nodeDefault;
  }

  /**
   * Async variant of {@link withNodeDefault}, awaiting the context when it is a promise.
   * @param node the node the context is for.
   * @param context the context of the callback.
   * @return the per type default, overwritten by the given context.
   */
  protected withNodeDefaultAsync<Context extends VisitContext>(
    node: object,
    context: Awaitable<Context>,
  ): Awaitable<Context> {
    return mapAwaitable(context, resolved => this.withNodeDefault(node, resolved));
  }

  /**
   * Completes the result of a pre-order mapper with the per type default of the node it returns, or else of the
   * node it mapped.
   * @param mapped the node that was mapped.
   * @param result the result of the mapper.
   * @return the per type default, overwritten by the result.
   */
  protected withNewValueDefault(mapped: object, result: PreOrderMappingReturn): PreOrderMappingReturn {
    return this.withNodeDefault(isNode(result.newValue) ? result.newValue : mapped, result);
  }

  /**
   * Async variant of {@link withNewValueDefault}, awaiting the result when it is a promise.
   * @param mapped the node that was mapped.
   * @param result the result of the mapper.
   * @return the per type default, overwritten by the result.
   */
  protected withNewValueDefaultAsync(
    mapped: object,
    result: Awaitable<PreOrderMappingReturn>,
  ): Awaitable<PreOrderMappingReturn> {
    return mapAwaitable(result, resolved => this.withNewValueDefault(mapped, resolved));
  }

  /**
   * Transform a single node ({@link Typed}).
   * @param startObject the object from which we will start the transformation,
   *   potentially visiting and transforming its descendants along the way.
   * @param nodeCallBacks a dictionary mapping the various node types to objects optionally
   *    containing preVisitor and transformer.
   *    The preVisitor allows you to provide {@link TransformContext} for the current object,
   *    altering how it will be transformed.
   *    The transformer allows you to manipulate the copy of the current object,
   *    and expects you to return the value that should take the current objects place.
   * @return the result of transforming the requested descendant operations (based on the preVisitor)
   * using a transformer that works its way back up from the descendant to the startObject.
   */
  public transformNode<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (copy: SafeWrap<Safe, Extract<Nodes, Typed<T>>>, orig: Extract<Nodes, Typed<T>>) => unknown;
      preVisitor?: (orig: Extract<Nodes, Typed<T>>) => TransformContext<Extract<Nodes, Typed<T>>>;
    }},
  ): Safe extends 'unsafe' ? OutType : unknown {
    const transformWrapper = (copy: object, orig: object): unknown => {
      let ogTransform: ((copy: any, orig: any) => unknown) | undefined;
      const casted = <Typed<Nodes['type']>>copy;
      if (typeof casted.type === 'string') {
        ogTransform = nodeCallBacks[casted.type]?.transform;
      }
      return ogTransform ? ogTransform(casted, orig) : copy;
    };
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => TransformContext) | undefined;
      const casted = <Typed<Nodes['type']>>curObject;
      if (typeof casted.type === 'string') {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
      }
      return this.withNodeDefault(casted, ogPreVisit?.(casted));
    };
    return <any> this.transformObject(startObject, transformWrapper, preVisitWrapper);
  }

  /**
   * Async variant of {@link transformNode}, supporting promise-returning callbacks.
   * The traversal is strictly sequential (depth-first) - it does not parallelise siblings.
   */
  public transformNodeAsync<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (
        copy: SafeWrap<Safe, Extract<Nodes, Typed<T>>>,
        orig: Extract<Nodes, Typed<T>>,
      ) => Awaitable<unknown>;
      preVisitor?: (orig: Extract<Nodes, Typed<T>>) => Awaitable<TransformContext<Extract<Nodes, Typed<T>>>>;
    }},
  ): Promise<Safe extends 'unsafe' ? OutType : unknown> {
    const transformWrapper = (copy: object, orig: object): Awaitable<unknown> => {
      let ogTransform: ((copy: any, orig: any) => Awaitable<unknown>) | undefined;
      const casted = <Typed<Nodes['type']>>copy;
      if (typeof casted.type === 'string') {
        ogTransform = nodeCallBacks[casted.type]?.transform;
      }
      return ogTransform ? ogTransform(casted, orig) : copy;
    };
    const preVisitWrapper = (curObject: object): Awaitable<TransformContext> => {
      let ogPreVisit: ((node: any) => Awaitable<TransformContext>) | undefined;
      const casted = <Typed<Nodes['type']>>curObject;
      if (typeof casted.type === 'string') {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
      }
      return ogPreVisit ? this.withNodeDefaultAsync(casted, ogPreVisit(casted)) : this.withNodeDefault(casted);
    };
    return <any> this.transformObjectAsync(startObject, transformWrapper, preVisitWrapper);
  }

  /**
   * Transform a single node ({@link Typed}) pre-order,
   * the dual of {@link this.transformObjectPreOrder} with the same type specification as {@link this.transformNode}:
   * a node is transformed _before_ its descendants, and we iterate into the result of that transformation.
   * This is what you want when a node has to travel deeper into the tree:
   * the callback only describes how a node swaps places with the node right below it,
   * the copy it sank into is dispatched in turn, and swaps places with the node below that one.
   *
   * Contrary to {@link this.transformNode}, a callback does not just return the value taking the place of
   * the node, it returns a {@link PreOrderMappingReturn}: that value, plus the {@link TransformContext} of
   * that value. Since the callback decides what we iterate into, it is the one telling us how to iterate
   * into it, so there is no separate preVisitor - it only completes the per type defaults of this
   * transformer, which are looked up using the type of the node it returns, or else of the node it was called on.
   * A node without a callback is left alone: it keeps those defaults, but is never re-transformed.
   *
   * Also contrary to {@link this.transformNode}, the descendants of the node given to the callback are not
   * transformed yet: they are the nodes of the input tree itself.
   * @param startObject the object from which we will start the transformation,
   *   potentially visiting and transforming its descendants along the way.
   * @param nodeCallBacks a dictionary mapping the various node types to a mapper.
   *    The mapper allows you to manipulate the copy of the current node, and expects you to return the
   *    value that should take the current nodes place, together with the context of that value.
   *    That context steers how we iterate into the returned value.
   * @return the result of transforming the startObject and the descendants of its rewrites.
   */
  public transformNodePreOrder<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?:
      (copy: SafeWrap<Safe, Extract<Nodes, Typed<T>>>, orig: Extract<Nodes, Typed<T>>) => PreOrderMappingReturn;
    },
  ): Safe extends 'unsafe' ? OutType : unknown {
    const preTransformWrapper = (copy: object, orig: object): PreOrderMappingReturn => {
      let ogPreTransform: ((copy: any, orig: any) => PreOrderMappingReturn) | undefined;
      const casted = <Typed<Nodes['type']>>copy;
      if (typeof casted.type === 'string') {
        ogPreTransform = nodeCallBacks[casted.type];
      }
      return this.withNewValueDefault(copy, ogPreTransform ?
        ogPreTransform(copy, orig) :
          { newValue: copy, reTransform: false });
    };

    return <any> this.transformObjectPreOrder(startObject, preTransformWrapper);
  }

  /**
   * Async variant of {@link transformNodePreOrder}, supporting promise-returning callbacks.
   * The traversal is strictly sequential (depth-first) - it does not parallelise siblings.
   */
  public transformNodePreOrderAsync<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?:
      (
        copy: SafeWrap<Safe, Extract<Nodes, Typed<T>>>,
        orig: Extract<Nodes, Typed<T>>,
      ) => Awaitable<PreOrderMappingReturn>;
    },
  ): Promise<Safe extends 'unsafe' ? OutType : unknown> {
    const preTransformWrapper = (copy: object, orig: object): Awaitable<PreOrderMappingReturn> => {
      let ogPreTransform: ((copy: any, orig: any) => Awaitable<PreOrderMappingReturn>) | undefined;
      const casted = <Typed<Nodes['type']>>copy;
      if (typeof casted.type === 'string') {
        ogPreTransform = nodeCallBacks[casted.type];
      }
      return this.withNewValueDefaultAsync(copy, ogPreTransform ?
        ogPreTransform(copy, orig) :
          { newValue: copy, reTransform: false });
    };

    return <any> this.transformObjectPreOrderAsync(startObject, preTransformWrapper);
  }

  /**
   * Visit a selected subTree given a startObject, steering the visits based on {@link Typed} nodes.
   * Will first call the preVisitor on the project and notice it should not iterate on its descendants.
   * It then visits the project, and the outermost distinct, printing '21'.
   * The pre-visitor visits starting from the root, going deeper, while the actual visitor goes in reverse.
   * @param startObject the object from which we will start visiting,
   *   potentially visiting its descendants along the way.
   * @param nodeCallBacks a dictionary mapping the various operation types to objects optionally
   *    containing preVisitor and visitor.
   *    The preVisitor allows you to provide {@link VisitContext} for the current object,
   *    altering how it will be visited.
   *    The visitor allows you to visit the object from deepest to the outermost object.
   *    This is useful if you for example want to manipulate the objects you visit during your visits,
   *    similar to {@link this.transformNode}.
   */
  public visitNode(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      visitor?: (op: Extract<Nodes, Typed<T>>) => void;
      preVisitor?: (op: Extract<Nodes, Typed<T>>) => VisitContext<Extract<Nodes, Typed<T>>>;
    }},
  ): void {
    const visitorWrapper = (curObject: object): void => {
      const casted = <Typed<Nodes['type']>>curObject;
      if (typeof casted.type === 'string') {
        const ogTransform = nodeCallBacks[casted.type]?.visitor;
        if (ogTransform) {
          ogTransform(<any> casted);
        }
      }
    };
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => VisitContext) | undefined;
      const casted = <Typed<Nodes['type']>>curObject;
      if (typeof casted.type === 'string') {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
      }
      return this.withNodeDefault(casted, ogPreVisit?.(casted));
    };
    return this.visitObject(startObject, visitorWrapper, preVisitWrapper);
  }

  /**
   * Async variant of {@link visitNode}, supporting promise-returning callbacks.
   * The traversal is strictly sequential (depth-first) - it does not parallelise siblings.
   */
  public visitNodeAsync(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      visitor?: (op: Extract<Nodes, Typed<T>>) => Awaitable<void>;
      preVisitor?: (op: Extract<Nodes, Typed<T>>) => Awaitable<VisitContext<Extract<Nodes, Typed<T>>>>;
    }},
  ): Promise<void> {
    const visitorWrapper = (curObject: object): Awaitable<void> => {
      const casted = <Typed<Nodes['type']>>curObject;
      if (typeof casted.type === 'string') {
        const ogTransform = nodeCallBacks[casted.type]?.visitor;
        if (ogTransform) {
          return ogTransform(<any> casted);
        }
      }
    };
    const preVisitWrapper = (curObject: object): Awaitable<VisitContext> => {
      let ogPreVisit: ((node: any) => Awaitable<VisitContext>) | undefined;
      const casted = <Typed<Nodes['type']>>curObject;
      if (typeof casted.type === 'string') {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
      }
      return ogPreVisit ? this.withNodeDefaultAsync(casted, ogPreVisit(casted)) : this.withNodeDefault(casted);
    };
    return this.visitObjectAsync(startObject, visitorWrapper, preVisitWrapper);
  }
}
