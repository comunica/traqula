import type { Typed } from '../types.js';
import type { SelectiveTraversalContext, TransformContext, VisitContext } from './TransformerObject.js';
import { TransformerObject } from './TransformerObject.js';

export type Safeness = 'safe' | 'unsafe';
export type SafeWrap<Safe extends Safeness, obj extends object> =
  Safe extends 'safe' ? {[key in keyof obj]: unknown } : obj;

export type DefaultNodePreVisitor<Nodes extends Typed> = {[T in Nodes['type']]?: TransformContext };

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
   * Transform a single node.
   * The transformation calls the preVisitor from starting from the startObject.
   * The preVisitor can dictate whether transformation should be stopped.
   * Note that stopping the transformation also prevets further copying.
   * The transformer itself transforms object starting with the deepest one that can be visited.
   * The transformer callback is performed on a copy of the original.
   * @param startObject
   * @param nodeCallBacks
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
      let ogPreVisit: ((node: any) => VisitContext) | undefined;
      let nodeContext: VisitContext = {};
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
   * Similar to {@link this.transformNode}, but without copying the startObject.
   * The pre-visitor visits starting from the root, going deeper, while the actual visitor goes in reverse.
   * @param startObject
   * @param nodeCallBacks
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

  /**
   * Traverses only selected nodes as returned by the function.
   * @param currentNode
   * @param traverse
   */
  public traverseNodes(
    currentNode: Nodes,
    traverse: {[T in Nodes['type']]?: (op: Extract<Nodes, Typed<T>>) => SelectiveTraversalContext<Nodes> },
  ): void {
    let didShortCut = false;

    const recurse = (curNode: Nodes): void => {
      const traverser = traverse[<Nodes['type']>curNode.type];
      if (traverser) {
        const { next, shortcut } = traverser(<any>curNode);
        didShortCut = shortcut ?? false;
        if (!didShortCut) {
          for (const node of next ?? []) {
            if (didShortCut) {
              return;
            }
            recurse(node);
          }
        }
      }
    };

    recurse(currentNode);
  }
}
