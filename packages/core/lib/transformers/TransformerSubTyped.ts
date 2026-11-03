import type { SubTyped, Typed } from '../types.js';
import type {
  Awaitable,
  PreOrderMappingReturn,
  TransformContext,
  VisitContext,
} from './TransformerObject.js';
import { mapAwaitable } from './TransformerObject.js';
import type { DefaultNodePreVisitor, Safeness, SafeWrap } from './TransformerTyped.js';
import { isNode, TransformerTyped } from './TransformerTyped.js';

/**
 * Finds the callback of a value: the one registered for its subType, falling back to the one registered for its type.
 * @param value the value to find a callback for, which need not be a node.
 * @param nodeCallBacks the callbacks registered per type.
 * @param nodeSpecificCallBacks the callbacks registered per type and subType.
 * @param callbackName the callback to pick from a registered entry, or undefined when the entry is the callback.
 * @return the found callback, or undefined when neither the subType nor the type registered one.
 */
function findCallback(
  value: unknown,
  nodeCallBacks: Partial<Record<string, any>>,
  nodeSpecificCallBacks: Partial<Record<string, Partial<Record<string, any>>>>,
  callbackName?: 'transform' | 'preVisitor' | 'visitor',
): ((...args: any[]) => any) | undefined {
  if (!isNode(value)) {
    return undefined;
  }
  const specificEntry = value.subType === undefined ? undefined : nodeSpecificCallBacks[value.type]?.[value.subType];
  if (callbackName === undefined) {
    return specificEntry ?? nodeCallBacks[value.type];
  }
  return specificEntry?.[callbackName] ?? nodeCallBacks[value.type]?.[callbackName];
}

/**
 * Most specific AST transformer that dispatches visit and transform callbacks
 * based on both the `type` and `subType` fields of {@link SubTyped} nodes.
 *
 * Extends {@link TransformerTyped} with an additional dispatch level. When a callback
 * is registered for a specific `(type, subType)` pair, it takes precedence over
 * the type-only callback from {@link TransformerTyped.transformNode}.
 *
 * This is the recommended transformer for SPARQL ASTs where nodes have both
 * type and subType discriminators (e.g., `{ type: 'term', subType: 'literal' }`).
 *
 * @typeParam Nodes - Union type of all node types this transformer handles.
 */
export class TransformerSubTyped<Nodes extends Typed> extends TransformerTyped<Nodes> {
  public constructor(
    defaultContext: TransformContext = {},
    defaultNodePreVisitor: DefaultNodePreVisitor<Nodes> = {},
  ) {
    super(defaultContext, defaultNodePreVisitor);
  };

  public override clone(
    newDefaultContext: TransformContext = {},
    newDefaultNodePreVisitor: DefaultNodePreVisitor<Nodes> = {},
  ): TransformerSubTyped<Nodes> {
    return new TransformerSubTyped(
      { ...this.defaultContext, ...newDefaultContext },
      { ...this.defaultNodePreVisitor, ...newDefaultNodePreVisitor },
    );
  }

  /**
   * Transform a single node ({@link Typed}).
   * Similar to {@link this.transformNode} but also allowing you to target the subTypes.
   * @param startObject the object from which we will start the transformation,
   *   potentially visiting and transforming its descendants along the way.
   * @param nodeCallBacks a dictionary mapping the various operation types to objects optionally
   *    containing preVisitor and transformer.
   *    The preVisitor allows you to provide {@link TransformContext} for the current object,
   *    altering how it will be transformed.
   *    The transformer allows you to manipulate the copy of the current object,
   *    and expects you to return the value that should take the current objects place.
   * @param nodeSpecificCallBacks Same as nodeCallBacks but using an additional level of indirection to
   *     indicate the subType.
   * @return the result of transforming the requested descendant operations (based on the preVisitor)
   * using a transformer that works its way back up from the descendant to the startObject.
   */
  public transformNodeSpecific<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (copy: SafeWrap<Safe, Extract<Nodes, Typed<T>>>, orig: Extract<Nodes, Typed<T>>) => unknown;
      preVisitor?: (orig: Extract<Nodes, Typed<T>>) => TransformContext<Extract<Nodes, Typed<T>>>;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?: {
      [SubType in Extract<Nodes, SubTyped<Type>>['subType']]?: {
        transform?: (
          copy: SafeWrap<Safe, Extract<Nodes, SubTyped<Type, SubType>>>,
          orig: Extract<Nodes, SubTyped<Type, SubType>>,
        ) => unknown;
        preVisitor?: (
          op: Extract<Nodes, SubTyped<Type, SubType>>,
        ) => TransformContext<Extract<Nodes, SubTyped<Type, SubType>>>;
      }}},
  ): Safe extends 'unsafe' ? OutType : unknown {
    const transformWrapper = (copy: object, orig: object): unknown => {
      const transform = findCallback(copy, nodeCallBacks, nodeSpecificCallBacks, 'transform');
      return transform ? transform(copy, orig) : copy;
    };
    const preVisitWrapper = (curObject: object): TransformContext => {
      const preVisitor = findCallback(curObject, nodeCallBacks, nodeSpecificCallBacks, 'preVisitor');
      return this.withNodeDefault(curObject, preVisitor?.(curObject));
    };
    return <any> this.transformObject(startObject, transformWrapper, preVisitWrapper);
  }

  /**
   * Async variant of {@link transformNodeSpecific}, supporting promise-returning callbacks.
   * The traversal is strictly sequential (depth-first) - it does not parallelise siblings.
   */
  public transformNodeSpecificAsync<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (
        copy: SafeWrap<Safe, Extract<Nodes, Typed<T>>>,
        orig: Extract<Nodes, Typed<T>>,
      ) => Awaitable<unknown>;
      preVisitor?: (orig: Extract<Nodes, Typed<T>>) => Awaitable<TransformContext<Extract<Nodes, Typed<T>>>>;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?: {
      [SubType in Extract<Nodes, SubTyped<Type>>['subType']]?: {
        transform?: (
          copy: SafeWrap<Safe, Extract<Nodes, SubTyped<Type, SubType>>>,
          orig: Extract<Nodes, SubTyped<Type, SubType>>,
        ) => Awaitable<unknown>;
        preVisitor?: (
          op: Extract<Nodes, SubTyped<Type, SubType>>,
        ) => Awaitable<TransformContext<Extract<Nodes, SubTyped<Type, SubType>>>>;
      }}},
  ): Promise<Safe extends 'unsafe' ? OutType : unknown> {
    const transformWrapper = (copy: object, orig: object): Awaitable<unknown> => {
      const transform = findCallback(copy, nodeCallBacks, nodeSpecificCallBacks, 'transform');
      return transform ? transform(copy, orig) : copy;
    };
    const preVisitWrapper = (curObject: object): Awaitable<TransformContext> => {
      const preVisitor = findCallback(curObject, nodeCallBacks, nodeSpecificCallBacks, 'preVisitor');
      return mapAwaitable(preVisitor?.(curObject), context => this.withNodeDefault(curObject, context));
    };
    return <any> this.transformObjectAsync(startObject, transformWrapper, preVisitWrapper);
  }

  /**
   * Transform a single node pre-order,
   * the dual of {@link this.transformObjectPreOrder} with the same type specification
   * as {@link this.transformNodeSpecific}:
   * Similar to {@link TransformerTyped.transformNodePreOrder}, but also allowing you to target the subTypes:
   * the node is transformed _before_ its descendants, and we iterate into the result of that transformation,
   * making it the tool of choice for nodes that have to travel deeper into the tree, like a filter pushdown.
   *
   * Contrary to {@link this.transformNodeSpecific}, a callback does not just return the value taking the
   * place of the node, it returns a {@link PreOrderMappingReturn}: that value, plus the
   * {@link TransformContext} of that value, so there is no separate preVisitor.
   * That context completes the per type defaults of the node it returns, or else of the node it was called on.
   * Also contrary to {@link this.transformNodeSpecific}, the descendants of the node given to the callback
   * are not transformed yet: they are the nodes of the input tree itself.
   * @param startObject the object from which we will start the transformation,
   *   potentially visiting and transforming its descendants along the way.
   * @param nodeCallBacks a dictionary mapping the various node types to a mapper.
   *    The mapper allows you to manipulate the copy of the current node, and expects you to return the
   *    value that should take the current nodes place, together with the context of that value.
   *    That context steers how we iterate into the returned value.
   * @param nodeSpecificCallBacks Same as nodeCallBacks but using an additional level of indirection to
   *     indicate the subType.
   * @return the result of transforming the startObject and the descendants of its rewrites.
   */
  public transformNodeSpecificPreOrder<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?:
      (copy: SafeWrap<Safe, Extract<Nodes, Typed<T>>>, orig: Extract<Nodes, Typed<T>>) => PreOrderMappingReturn;
    },
    nodeSpecificCallBacks: {[Type in Nodes['type']]?: {[SubType in Extract<Nodes, SubTyped<Type>>['subType']]?:
      (
        copy: SafeWrap<Safe, Extract<Nodes, SubTyped<Type, SubType>>>,
        orig: Extract<Nodes, SubTyped<Type, SubType>>,
      ) => PreOrderMappingReturn;
    }},
  ): Safe extends 'unsafe' ? OutType : unknown {
    const preTransformWrapper = (copy: object, orig: object): PreOrderMappingReturn => {
      const preTransform = findCallback(copy, nodeCallBacks, nodeSpecificCallBacks);
      const result = preTransform ? preTransform(copy, orig) : { newValue: copy, reTransform: false };
      return this.withNodeDefault(result.newValue, result);
    };
    return <any> this.transformObjectPreOrder(startObject, preTransformWrapper);
  }

  /**
   * Async variant of {@link transformNodeSpecificPreOrder}, supporting promise-returning callbacks.
   * The traversal is strictly sequential (depth-first) - it does not parallelise siblings.
   */
  public transformNodeSpecificPreOrderAsync<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?:
      (
        copy: SafeWrap<Safe, Extract<Nodes, Typed<T>>>,
        orig: Extract<Nodes, Typed<T>>,
      ) => Awaitable<PreOrderMappingReturn>;
    },
    nodeSpecificCallBacks: {[Type in Nodes['type']]?: {[SubType in Extract<Nodes, SubTyped<Type>>['subType']]?:
      (
        copy: SafeWrap<Safe, Extract<Nodes, SubTyped<Type, SubType>>>,
        orig: Extract<Nodes, SubTyped<Type, SubType>>,
      ) => Awaitable<PreOrderMappingReturn>;
    }},
  ): Promise<Safe extends 'unsafe' ? OutType : unknown> {
    const preTransformWrapper = (copy: object, orig: object): Awaitable<PreOrderMappingReturn> => {
      const preTransform = findCallback(copy, nodeCallBacks, nodeSpecificCallBacks);
      const result = preTransform ? preTransform(copy, orig) : { newValue: copy, reTransform: false };
      return mapAwaitable(result, resolved => this.withNodeDefault(resolved.newValue, resolved));
    };
    return <any> this.transformObjectPreOrderAsync(startObject, preTransformWrapper);
  }

  /**
   * Visit a selected subTree given a startObject, steering the visits based on {@link Typed} nodes.
   * Similar to {@link this.visitNode}, but also allowing you to target subTypes.
   * Will call the preVisitor on the outer distinct, then the visitor of the special distinct,
   * followed by the visiting the outer distinct, printing '231'.
   * The pre-visitor visits starting from the root, going deeper, while the actual visitor goes in reverse.
   * @param startObject the object from which we will start visiting,
   *   potentially visiting its descendants along the way.
   * @param nodeCallBacks a dictionary mapping the various operation types to objects optionally
   *    containing preVisitor and visitor.
   *    The preVisitor allows you to provide {@link VisitContext} for the current object,
   *    altering how it will be visited.
   *    The visitor allows you to visit the object from deepest to the outermost object.
   *    This is useful if you for example want to manipulate the objects you visit during your visits,
   *    similar to {@link mapOperation}.
   * @param nodeSpecificCallBacks Same as nodeCallBacks but using an additional level of indirection to
   *     indicate the subType.
   */
  public visitNodeSpecific(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      visitor?: (op: Extract<Nodes, Typed<T>>) => void;
      preVisitor?: (op: Extract<Nodes, Typed<T>>) => VisitContext<Extract<Nodes, Typed<T>>>;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?:
      {[Subtype in Extract<Nodes, SubTyped<Type>>['subType']]?: {
        visitor?: (op: Extract<Nodes, SubTyped<Type, Subtype>>) => void;
        preVisitor?: (
          op: Extract<Nodes, SubTyped<Type, Subtype>>,
        ) => VisitContext<Extract<Nodes, SubTyped<Type, Subtype>>>;
      }}},
  ): void {
    const visitWrapper = (curObject: object): void => {
      const visitor = findCallback(curObject, nodeCallBacks, nodeSpecificCallBacks, 'visitor');
      visitor?.(curObject);
    };
    const preVisitWrapper = (curObject: object): VisitContext => {
      const preVisitor = findCallback(curObject, nodeCallBacks, nodeSpecificCallBacks, 'preVisitor');
      return this.withNodeDefault(curObject, preVisitor?.(curObject));
    };
    this.visitObject(startObject, visitWrapper, preVisitWrapper);
  }

  /**
   * Async variant of {@link visitNodeSpecific}, supporting promise-returning callbacks.
   * The traversal is strictly sequential (depth-first) - it does not parallelise siblings.
   */
  public visitNodeSpecificAsync(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      visitor?: (op: Extract<Nodes, Typed<T>>) => Awaitable<void>;
      preVisitor?: (op: Extract<Nodes, Typed<T>>) => Awaitable<VisitContext<Extract<Nodes, Typed<T>>>>;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?:
      {[Subtype in Extract<Nodes, SubTyped<Type>>['subType']]?: {
        visitor?: (op: Extract<Nodes, SubTyped<Type, Subtype>>) => Awaitable<void>;
        preVisitor?: (
          op: Extract<Nodes, SubTyped<Type, Subtype>>,
        ) => Awaitable<VisitContext<Extract<Nodes, SubTyped<Type, Subtype>>>>;
      }}},
  ): Promise<void> {
    const visitWrapper = (curObject: object): Awaitable<void> => {
      const visitor = findCallback(curObject, nodeCallBacks, nodeSpecificCallBacks, 'visitor');
      return visitor?.(curObject);
    };
    const preVisitWrapper = (curObject: object): Awaitable<VisitContext> => {
      const preVisitor = findCallback(curObject, nodeCallBacks, nodeSpecificCallBacks, 'preVisitor');
      return mapAwaitable(preVisitor?.(curObject), context => this.withNodeDefault(curObject, context));
    };
    return this.visitObjectAsync(startObject, visitWrapper, preVisitWrapper);
  }
}
