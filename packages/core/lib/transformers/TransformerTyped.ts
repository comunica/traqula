import type { Typed } from '../types.js';
import type { TransformContext, VisitContext } from './TransformerObject.js';
import { TransformerObject } from './TransformerObject.js';

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
export type DefaultNodePreVisitor<Nodes extends Typed> = {[T in Nodes['type']]?: TransformContext };

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
      preVisitor?: (orig: Extract<Nodes, Typed<T>>) => TransformContext;
    }},
  ): Safe extends 'unsafe' ? OutType : unknown {
    return <any> this.transformObject(
      startObject,
      this.typedTransformWrapper(nodeCallBacks),
      this.typedPreVisitWrapper(nodeCallBacks),
    );
  }

  /**
   * Transform a single node ({@link Typed}) top-down, the dual of {@link this.transformNode}.
   * Takes the exact same callbacks, but transforms a node _before_ its descendants,
   * and iterates into the result of that transformation.
   *
   * This is what you want when an operation has to travel _down_ the tree, like a filter pushdown:
   * a callback only has to describe how a node swaps places with the node right below it,
   * the copy it pushed down is visited in turn, and swaps places with the node below that one.
   * ```ts
   * transformer.transformNodeDown(query, {
   *   filter: { transform: (copy) => {
   *     const child = copy.input;
   *     // Sink the filter into every branch of a union - both new filters keep sinking on their own.
   *     if (child.type === 'union') {
   *       return { ...child, input: child.input.map(branch => ({ ...copy, input: branch })) };
   *     }
   *     // Anything else is a barrier: returning the copy untouched stops the descent of this filter.
   *     return copy;
   *   }},
   * });
   * ```
   * A node that is the result of a rewrite is transformed once. Rules rewriting a node into a node taking
   * the exact same place - like a rule merging two nested filters - additionally need
   * {@link TransformContext.reTransform}, making the transform be applied until the node stabilizes.
   *
   * Contrary to {@link this.transformNode}, the descendants of the node given to the callback are not
   * transformed yet: they are the nodes of the input tree itself. You are free to replace the node,
   * to reuse its descendants in the node you return, and to change the own properties of the copy you got,
   * but changing the properties _of a descendant_ writes straight into the input tree.
   * Remapping callbacks additionally have to converge.
   * Both are documented in detail on {@link TransformerObject.transformObjectPreOrder}.
   * @param startObject the object from which we will start the transformation,
   *   potentially visiting and transforming its descendants along the way.
   * @param nodeCallBacks a dictionary mapping the various node types to objects optionally
   *    containing preVisitor and transformer.
   *    The preVisitor allows you to provide {@link TransformContext} for the current object,
   *    altering how it will be transformed. It is re-evaluated after every rewrite.
   *    The transformer allows you to manipulate the copy of the current object,
   *    and expects you to return the value that should take the current objects place.
   *    The returned value is dispatched again, and is what we iterate into.
   * @return the result of transforming the startObject and the descendants of its rewrites.
   */
  public transformNodeDown<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (copy: SafeWrap<Safe, Extract<Nodes, Typed<T>>>, orig: Extract<Nodes, Typed<T>>) => unknown;
      preVisitor?: (orig: Extract<Nodes, Typed<T>>) => TransformContext;
    }},
  ): Safe extends 'unsafe' ? OutType : unknown {
    return <any> this.transformObjectPreOrder(
      startObject,
      this.typedTransformWrapper(nodeCallBacks),
      this.typedPreVisitWrapper(nodeCallBacks),
    );
  }

  /**
   * Creates the mapper dispatching to the transform callback registered for the type of the mapped object.
   * @protected
   */
  protected typedTransformWrapper(
    nodeCallBacks: Record<string, { transform?: (copy: any, orig: any) => unknown } | undefined>,
  ): (copy: object, orig: object) => unknown {
    return (copy: object, orig: object): unknown => {
      let ogTransform: ((copy: any, orig: any) => unknown) | undefined;
      const casted = <Typed<Nodes['type']>>copy;
      if (casted.type) {
        ogTransform = nodeCallBacks[casted.type]?.transform;
      }
      return ogTransform ? ogTransform(casted, orig) : copy;
    };
  }

  /**
   * Creates the preVisitor dispatching to the preVisitor registered for the type of the visited object,
   * defaulting to the context registered in the {@link defaultNodePreVisitor} of this transformer.
   * @protected
   */
  protected typedPreVisitWrapper(
    nodeCallBacks: Record<string, { preVisitor?: (orig: any) => VisitContext } | undefined>,
  ): (orig: object) => TransformContext {
    const nodeDefaults = <Record<string, TransformContext | undefined>> this.defaultNodePreVisitor;
    return (curObject: object): TransformContext => {
      let ogPreVisit: ((node: any) => VisitContext) | undefined;
      let nodeContext: TransformContext = {};
      const casted = <Typed<Nodes['type']>>curObject;
      if (casted.type) {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
        nodeContext = nodeDefaults[casted.type] ?? nodeContext;
      }
      return ogPreVisit ? { ...nodeContext, ...ogPreVisit(casted) } : nodeContext;
    };
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
      preVisitor?: (op: Extract<Nodes, Typed<T>>) => VisitContext;
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
    return this.visitObject(startObject, visitorWrapper, this.typedPreVisitWrapper(nodeCallBacks));
  }
}
