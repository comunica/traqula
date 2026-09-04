import type { SubTyped, Typed } from '../types.js';
import type {
  Awaitable,
  PreOrderMappingReturn,
  TransformContext,
  VisitContext,
} from './TransformerObject.js';
import type { DefaultNodePreVisitor, Safeness, SafeWrap } from './TransformerTyped.js';
import { TransformerTyped } from './TransformerTyped.js';

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
  // TODO(major): these functions here should care about the default pre visitor provided to the constructor!
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
      preVisitor?: (orig: Extract<Nodes, Typed<T>>) => TransformContext;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?: {
      [SubType in Extract<Nodes, SubTyped<Type>>['subType']]?: {
        transform?: (op: SafeWrap<Safe, Extract<Nodes, SubTyped<Type, SubType>>>) => unknown;
        preVisitor?: (op: Extract<Nodes, SubTyped<Type, SubType>>) => TransformContext;
      }}},
  ): Safe extends 'unsafe' ? OutType : unknown {
    const transformWrapper = (copy: object, orig: object): unknown => {
      let ogTransform: ((copy: any, orig: any) => unknown) | undefined;
      const casted = <SubTyped<Nodes['type']>>copy;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogTransform = specific[<keyof typeof specific> casted.subType]?.transform;
        }
        if (!ogTransform) {
          ogTransform = nodeCallBacks[casted.type]?.transform;
        }
      }
      return ogTransform ? ogTransform(casted, orig) : copy;
    };
    const preVisitWrapper = (curObject: object): TransformContext => {
      let ogPreVisit: ((node: any) => TransformContext) | undefined;
      const casted = <SubTyped<Nodes['type']>>curObject;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogPreVisit = specific[<keyof typeof specific> casted.subType]?.preVisitor;
        }
        if (!ogPreVisit) {
          ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
        }
      }
      return ogPreVisit ? ogPreVisit(casted) : {};
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
      preVisitor?: (orig: Extract<Nodes, Typed<T>>) => Awaitable<TransformContext>;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?: {
      [SubType in Extract<Nodes, SubTyped<Type>>['subType']]?: {
        transform?: (op: SafeWrap<Safe, Extract<Nodes, SubTyped<Type, SubType>>>) => Awaitable<unknown>;
        preVisitor?: (op: Extract<Nodes, SubTyped<Type, SubType>>) => Awaitable<TransformContext>;
      }}},
  ): Promise<Safe extends 'unsafe' ? OutType : unknown> {
    const transformWrapper = (copy: object, orig: object): Awaitable<unknown> => {
      let ogTransform: ((copy: any, orig: any) => Awaitable<unknown>) | undefined;
      const casted = <SubTyped<Nodes['type']>>copy;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogTransform = specific[<keyof typeof specific> casted.subType]?.transform;
        }
        if (!ogTransform) {
          ogTransform = nodeCallBacks[casted.type]?.transform;
        }
      }
      return ogTransform ? ogTransform(casted, orig) : copy;
    };
    const preVisitWrapper = (curObject: object): Awaitable<TransformContext> => {
      let ogPreVisit: ((node: any) => Awaitable<TransformContext>) | undefined;
      const casted = <SubTyped<Nodes['type']>>curObject;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogPreVisit = specific[<keyof typeof specific> casted.subType]?.preVisitor;
        }
        if (!ogPreVisit) {
          ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
        }
      }
      return ogPreVisit ? ogPreVisit(casted) : {};
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
      (op: SafeWrap<Safe, Extract<Nodes, SubTyped<Type, SubType>>>) => PreOrderMappingReturn;
    }},
  ): Safe extends 'unsafe' ? OutType : unknown {
    const preTransformWrapper = (copy: object, orig: object): PreOrderMappingReturn => {
      let ogPreTransform: ((copy: any, orig: any) => PreOrderMappingReturn) | undefined;
      const casted = <SubTyped<Nodes['type']>> copy;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogPreTransform = specific[<keyof typeof specific> casted.subType];
        }
        if (!ogPreTransform) {
          ogPreTransform = nodeCallBacks[casted.type];
        }
      }
      return ogPreTransform ? ogPreTransform(copy, orig) : { newValue: copy };
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
      (op: SafeWrap<Safe, Extract<Nodes, SubTyped<Type, SubType>>>) => Awaitable<PreOrderMappingReturn>;
    }},
  ): Promise<Safe extends 'unsafe' ? OutType : unknown> {
    const preTransformWrapper = (copy: object, orig: object): Awaitable<PreOrderMappingReturn> => {
      let ogPreTransform: ((copy: any, orig: any) => Awaitable<PreOrderMappingReturn>) | undefined;
      const casted = <SubTyped<Nodes['type']>> copy;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogPreTransform = specific[<keyof typeof specific> casted.subType];
        }
        if (!ogPreTransform) {
          ogPreTransform = nodeCallBacks[casted.type];
        }
      }
      return ogPreTransform ? ogPreTransform(copy, orig) : { newValue: copy };
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
      preVisitor?: (op: Extract<Nodes, Typed<T>>) => VisitContext;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?:
      {[Subtype in Extract<Nodes, SubTyped<Type>>['subType']]?: {
        visitor?: (op: Extract<Nodes, SubTyped<Type, Subtype>>) => void;
        preVisitor?: (op: Extract<Nodes, SubTyped<Type, Subtype>>) => VisitContext;
      }}},
  ): void {
    const visitWrapper = (curObject: object): void => {
      let ogTransform: ((node: any) => void) | undefined;
      const casted = <SubTyped<Nodes['type']>>curObject;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogTransform = specific[<keyof typeof specific> casted.subType]?.visitor;
        }
        if (!ogTransform) {
          ogTransform = nodeCallBacks[casted.type]?.visitor;
        }
      }
      if (ogTransform) {
        ogTransform(casted);
      }
    };
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => VisitContext) | undefined;
      const casted = <SubTyped<Nodes['type']>>curObject;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogPreVisit = specific[<keyof typeof specific> casted.subType]?.preVisitor;
        }
        if (!ogPreVisit) {
          ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
        }
      }
      return ogPreVisit ? ogPreVisit(casted) : {};
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
      preVisitor?: (op: Extract<Nodes, Typed<T>>) => Awaitable<VisitContext>;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?:
      {[Subtype in Extract<Nodes, SubTyped<Type>>['subType']]?: {
        visitor?: (op: Extract<Nodes, SubTyped<Type, Subtype>>) => Awaitable<void>;
        preVisitor?: (op: Extract<Nodes, SubTyped<Type, Subtype>>) => Awaitable<VisitContext>;
      }}},
  ): Promise<void> {
    const visitWrapper = (curObject: object): Awaitable<void> => {
      let ogTransform: ((node: any) => Awaitable<void>) | undefined;
      const casted = <SubTyped<Nodes['type']>>curObject;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogTransform = specific[<keyof typeof specific> casted.subType]?.visitor;
        }
        if (!ogTransform) {
          ogTransform = nodeCallBacks[casted.type]?.visitor;
        }
      }
      if (ogTransform) {
        return ogTransform(casted);
      }
    };
    const preVisitWrapper = (curObject: object): Awaitable<VisitContext> => {
      let ogPreVisit: ((node: any) => Awaitable<VisitContext>) | undefined;
      const casted = <SubTyped<Nodes['type']>>curObject;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogPreVisit = specific[<keyof typeof specific> casted.subType]?.preVisitor;
        }
        if (!ogPreVisit) {
          ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
        }
      }
      return ogPreVisit ? ogPreVisit(casted) : {};
    };
    return this.visitObjectAsync(startObject, visitWrapper, preVisitWrapper);
  }
}
