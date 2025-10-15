import type { Node } from './nodeTypings.js';
import type {
  SelectiveTraversalContext,
  TransformContext,
  VisitContext,
} from './TransformerObject.js';
import type { DefaultNodePreVisitor, Safeness, SafeWrap } from './TransformerTyped.js';
import { TransformerTyped } from './TransformerTyped.js';

export class TransformerSubTyped<Nodes extends Pick<Node, 'type' | 'subType'>> extends TransformerTyped<Nodes> {
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
   * Shares the functionality and first two arguments with {@link this.transformNode}.
   * The third argument allows you to also transform based on the subType of objects.
   * Note that when a callback for the subtype is provided, the callback for the general type is **NOT** executed.
   * @param startObject
   * @param nodeCallBacks
   * @param nodeSpecificCallBacks
   */
  public transformNodeSpecific<Safe extends Safeness = 'safe', OutType = unknown>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (copy: SafeWrap<Safe, Extract<Nodes, { type: T }>>, orig: Extract<Nodes, { type: T }>) => unknown;
      preVisitor?: (orig: Extract<Nodes, { type: T }>) => TransformContext;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?: {
      [SubType in Extract<Nodes, { type: Type; subType: string }>['subType']]?: {
        transform?: (op: SafeWrap<Safe, Extract<Nodes, { type: Type; subType: SubType }>>) => unknown;
        preVisitor?: (op: Extract<Nodes, { type: Type; subType: SubType }>) => TransformContext;
      }}},
  ): Safe extends 'unsafe' ? OutType : unknown {
    const transformWrapper = (copy: object, orig: object): unknown => {
      let ogTransform: ((copy: any, orig: any) => unknown) | undefined;
      const casted = <{ type?: Nodes['type']; subType?: string }>copy;
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
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => VisitContext) | undefined;
      const casted = <{ type?: Nodes['type']; subType?: string }>curObject;
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
   * Similar to {@link this.visitNode} but also allows you to match based on the subtype of objects.
   * When both nodeCallBack and NodeSpecific callBack are matched, will only visit nodeSpecifCallback
   */
  public visitNodeSpecific(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      visitor?: (op: Extract<Nodes, { type: T }>) => void;
      preVisitor?: (op: Extract<Nodes, { type: T }>) => VisitContext;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?:
      {[Subtype in Extract<Nodes, { type: Type; subType: string }>['subType']]?: {
        visitor?: (op: Extract<Nodes, { type: Type; subType: Subtype }>) => void;
        preVisitor?: (op: Extract<Nodes, { type: Type; subType: Subtype }>) => VisitContext;
      }}},
  ): void {
    const visitWrapper = (curObject: object): void => {
      let ogTransform: ((node: any) => void) | undefined;
      const casted = <{ type?: Nodes['type']; subType?: string }>curObject;
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
      const casted = <{ type?: Nodes['type']; subType?: string }>curObject;
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
   * Similar to {@link this.traverseNodes} but also allows you to match based on the subtype of objects.
   * @param currentNode
   * @param traverseNode
   * @param traverseSubNode
   */
  public traverseSubNodes(
    currentNode: Nodes,
    traverseNode: {[Type in Nodes['type']]?:
      (op: Extract<Nodes, { type: Type }>) => SelectiveTraversalContext<Nodes> },
    traverseSubNode: {[Type in Nodes['type']]?:
      {[Subtype in Extract<Nodes, { type: Type; subType: string }>['subType']]?:
        (op: Extract<Nodes, { type: Type; subType: Subtype }>) => SelectiveTraversalContext<Nodes> }},
  ): void {
    let didShortCut = false;

    const recurse = (curNode: Nodes): void => {
      let traverser: ((call: any) => SelectiveTraversalContext<Nodes>) | undefined;
      const subObj = traverseSubNode[<Nodes['type']>curNode.type];
      if (subObj) {
        traverser = subObj[<keyof typeof subObj>curNode.subType];
      }
      if (!traverser) {
        traverser = traverseNode[<Nodes['type']>curNode.type];
      }
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
