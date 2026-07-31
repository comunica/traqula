import type { Typed } from '../types.js';
import type { PreOrderMappingReturn, TransformContext, VisitContext } from './TransformerObject.js';
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
    const transformWrapper = (copy: object, orig: object): unknown => {
      let ogTransform: ((copy: any, orig: any) => unknown) | undefined;
      const casted = <Typed<Nodes['type']>>copy;
      if (casted.type) {
        ogTransform = nodeCallBacks[casted.type]?.transform;
      }
      return ogTransform ? ogTransform(casted, orig) : copy;
    };
    const nodeDefaults = this.defaultNodePreVisitor;
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => TransformContext) | undefined;
      let nodeContext: TransformContext = {};
      const casted = <Typed<Nodes['type']>>curObject;
      if (casted.type) {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
        nodeContext = nodeDefaults[casted.type] ?? nodeContext;
      }
      return ogPreVisit ? { ...nodeContext, ...ogPreVisit(casted) } : nodeContext;
    };
    return <any> this.transformObject(startObject, transformWrapper, preVisitWrapper);
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
   * transformer, which are looked up using the type of the node it was called on.
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
    const nodeDefaults = this.defaultNodePreVisitor;
    const preTransformWrapper = (copy: object, orig: object): PreOrderMappingReturn => {
      let ogPreTransform: ((copy: any, orig: any) => PreOrderMappingReturn) | undefined;
      let nodeContext: TransformContext = {};
      const casted = <Typed<Nodes['type']>>copy;
      if (casted.type) {
        ogPreTransform = nodeCallBacks[casted.type];
        nodeContext = nodeDefaults[casted.type] ?? nodeContext;
      }
      return ogPreTransform ?
          { ...nodeContext, ...ogPreTransform(copy, orig) } :
          { ...nodeContext, newValue: copy, reTransform: false };
    };

    return <any> this.transformObjectPreOrder(startObject, preTransformWrapper);
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
    const nodeDefaults = this.defaultNodePreVisitor;
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => VisitContext) | undefined;
      let nodeContext: VisitContext = {};
      const casted = <Typed<Nodes['type']>>curObject;
      if (casted.type) {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
        nodeContext = nodeDefaults[casted.type] ?? nodeContext;
      }
      return ogPreVisit ? { ...nodeContext, ...ogPreVisit(casted) } : nodeContext;
    };
    return this.visitObject(startObject, visitorWrapper, preVisitWrapper);
  }
}
