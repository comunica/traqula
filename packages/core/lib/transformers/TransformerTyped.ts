import type { Typed } from '../types.js';
import type {
  Awaitable,
  ChildKey,
  ChildValue,
  PreOrderMappingReturn,
  TransformContext,
  VisitChildren,
  VisitContext,
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
 * The keys of an object whose value can be an object or array, other than a function, including unknown values.
 */
type ObjectValuedKeys<Obj> = {
  [Key in ChildKey<Obj>]: unknown extends ChildValue<Obj, Key> ? Key :
      [Exclude<Extract<ChildValue<Obj, Key>, object>, Function>] extends [never] ? never : Key
}[ChildKey<Obj>];

/**
 * Per node type, every key whose value can be an object, mapped to whether it is visited, or to the
 * {@link VisitChildren} of its value, which is stepped into first.
 */
export type KnownNodeKeys<Nodes extends Typed> = {
  [T in Nodes['type']]: {
    [Key in ObjectValuedKeys<Extract<Nodes, Typed<T>>>]:
      | boolean
      | VisitChildren<Extract<ChildValue<Extract<Nodes, Typed<T>>, Key>, object>> };
};

/**
 * Creates a {@link DefaultNodePreVisitor} that per node type only visits the known keys it is told to visit,
 * skipping the others, and unknown keys like those of an extension.
 * @param knownKeys per node type, its keys holding objects, and whether to visit them.
 * @return the contexts per node type, to give to a {@link TransformerTyped} or {@link TransformerSubTyped}.
 */
export function visitOnlyKnownKeys<Nodes extends Typed>(knownKeys: KnownNodeKeys<Nodes>): DefaultNodePreVisitor<Nodes> {
  const contexts: Record<string, TransformContext> = {};
  for (const [ type, keys ] of Object.entries(knownKeys)) {
    const entries = Object.entries(<Record<string, boolean | VisitChildren>> keys);
    const visitedKeys = entries.filter(([ , visitor ]) => visitor === true).map(([ key ]) => key);
    const valueVisitors = entries
      .flatMap(([ key, visitor ]) => typeof visitor === 'function' ? [{ key, visitor }] : []);
    // A callback reads the known keys only, instead of checking every key of the node
    const visitChildren: VisitChildren<Record<string, unknown>> = (node, helpers) => {
      for (const key of visitedKeys) {
        helpers.visitKey(node, key);
      }
      for (const { key, visitor } of valueVisitors) {
        const value = helpers.stepIntoKey(node, key);
        if (value !== null && typeof value === 'object') {
          visitor(value, helpers);
        }
      }
    };
    contexts[type] = { visitChildren: <VisitChildren> visitChildren };
  }
  return <DefaultNodePreVisitor<Nodes>> contexts;
}

/**
 * Creates a {@link VisitChildren} of an array that visits its nodes, and the given keys of its other elements.
 * @param keys the keys to visit of the elements without a type.
 * @return the callback visiting the elements of an array.
 */
export function visitElementKeys<Element extends object>(
  ...keys: ChildKey<Exclude<Element, Typed>>[]
): VisitChildren<Element[]> {
  return (elements, { visitKey, stepIntoKey }) => {
    // Loops backwards, so the elements are traversed in order.
    for (let index = elements.length - 1; index >= 0; index--) {
      if (isNode(elements[index])) {
        visitKey(elements, index);
        continue;
      }
      const element = stepIntoKey(elements, index);
      for (const key of keys) {
        visitKey(element, <never> key);
      }
    }
  };
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
  protected readonly defaultNodePreVisitor: DefaultNodePreVisitor<Nodes>;

  public constructor(defaultContext: TransformContext = {}, defaultNodePreVisitor: DefaultNodePreVisitor<Nodes> = {}) {
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
   * Completes the context a callback gave for a node with the per type default of that node.
   * @param node the node the context is for, which need not be an object.
   * @param context the context of the callback, or undefined when the node has no callback.
   * @return the per type default, overwritten by the given context.
   */
  protected withNodeDefault<Context extends VisitContext = TransformContext>(
    node: unknown,
    context?: Context,
  ): Context {
    const type = (<Partial<Typed<Nodes['type']>> | undefined> node)?.type;
    const nodeDefault = typeof type === 'string' ? this.defaultNodePreVisitor[type] : undefined;
    if (nodeDefault === undefined) {
      return context ?? <Context> emptyContext;
    }
    return context ? { ...<Context> nodeDefault, ...context } : <Context> nodeDefault;
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
      if (casted.type) {
        ogTransform = nodeCallBacks[casted.type]?.transform;
      }
      return ogTransform ? ogTransform(casted, orig) : copy;
    };
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => TransformContext) | undefined;
      const casted = <Typed<Nodes['type']>>curObject;
      if (casted.type) {
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
      if (casted.type) {
        ogTransform = nodeCallBacks[casted.type]?.transform;
      }
      return ogTransform ? ogTransform(casted, orig) : copy;
    };
    const preVisitWrapper = (curObject: object): Awaitable<TransformContext> => {
      let ogPreVisit: ((node: any) => Awaitable<TransformContext>) | undefined;
      const casted = <Typed<Nodes['type']>>curObject;
      if (casted.type) {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
      }
      return mapAwaitable(ogPreVisit?.(casted), context => this.withNodeDefault(casted, context));
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
      if (casted.type) {
        ogPreTransform = nodeCallBacks[casted.type];
      }
      const result = ogPreTransform ? ogPreTransform(copy, orig) : { newValue: copy, reTransform: false };
      return this.withNodeDefault(result.newValue, result);
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
      if (casted.type) {
        ogPreTransform = nodeCallBacks[casted.type];
      }
      const result = ogPreTransform ? ogPreTransform(copy, orig) : { newValue: copy, reTransform: false };
      return mapAwaitable(result, resolved => this.withNodeDefault(resolved.newValue, resolved));
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
      if (casted.type) {
        const ogTransform = nodeCallBacks[casted.type]?.visitor;
        if (ogTransform) {
          ogTransform(<any> casted);
        }
      }
    };
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => VisitContext) | undefined;
      const casted = <Typed<Nodes['type']>>curObject;
      if (casted.type) {
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
      if (casted.type) {
        const ogTransform = nodeCallBacks[casted.type]?.visitor;
        if (ogTransform) {
          return ogTransform(<any> casted);
        }
      }
    };
    const preVisitWrapper = (curObject: object): Awaitable<VisitContext> => {
      let ogPreVisit: ((node: any) => Awaitable<VisitContext>) | undefined;
      const casted = <Typed<Nodes['type']>>curObject;
      if (casted.type) {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
      }
      return mapAwaitable(ogPreVisit?.(casted), context => this.withNodeDefault(casted, context));
    };
    return this.visitObjectAsync(startObject, visitorWrapper, preVisitWrapper);
  }
}
