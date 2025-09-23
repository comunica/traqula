import type { Node } from './nodeTypings.js';

type Safeness = 'safe' | 'unsafe';
type SafeWrap<Safe extends Safeness, obj extends object> = Safe extends 'safe' ? {[key in keyof obj]: unknown } : obj;

export interface VisitContext {
  shortcut?: boolean;
  continue?: boolean;
}

export interface SelectiveTraversalContext<Nodes> {
  next?: Nodes[];
  shortcut?: boolean;
}

export class TransformerType<Nodes extends Pick<Node, 'type'>> {
  protected clone<T>(obj: T): T {
    const newObj = Object.create(Object.getPrototypeOf(obj));
    Object.defineProperties(
      newObj,
      Object.getOwnPropertyDescriptors(obj),
    );
    return newObj;
  }

  protected safeObjectVisit(value: unknown, mapper: (some: object) => any): unknown {
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(x => this.safeObjectVisit(x, mapper));
      }
      return mapper(value);
    }
    return value;
  }

  /**
   * Recursively transforms all objects that are not arrays. Mapper is called on deeper objects first.
   * @param startObject object to start iterating from
   * @param mapper mapper to transform the various objects - argument is a copy of the original
   * @param preVisitor callback that is evaluated before iterating deeper.
   *   If continues is false, we do not iterate deeper, current object is still mapped. - default: true
   *   If shortcut is true, we do not iterate deeper, nor do we branch out, this mapper will be the last one called.
   *    - Default false
   */
  public transformObject(
    startObject: object,
    mapper: (some: object) => any,
    preVisitor: (some: object) => VisitContext = () => ({}),
  ): unknown {
    let didShortCut = false;
    const recurse = (curObject: object): unknown => {
      const copy = this.clone(curObject);
      const context = preVisitor(copy);
      didShortCut = context.shortcut ?? false;
      const continues = context.continue ?? true;
      if (continues && !didShortCut) {
        for (const [ key, value ] of Object.entries(copy)) {
          if (didShortCut) {
            return copy;
          }
          (<Record<string, unknown>> copy)[key] =
            this.safeObjectVisit(value, obj => recurse(obj));
        }
      }
      return mapper(copy);
    };

    return recurse(startObject);
  }

  /**
   * Visitor that visits all objects. Visits deeper objects first.
   */
  public visitObject(
    startObject: object,
    visitor: (some: object) => void,
    preVisitor: (some: object) => VisitContext = () => ({}),
  ): void {
    let didShortCut = false;

    const recurse = (curObject: object): void => {
      const context = preVisitor(curObject);
      didShortCut = context.shortcut ?? false;
      const continues = context.continue ?? true;
      if (continues && !didShortCut) {
        for (const value of Object.values(curObject)) {
          if (didShortCut) {
            return;
          }
          this.safeObjectVisit(value, obj => recurse(obj));
        }
      }
      visitor(curObject);
    };
    recurse(startObject);
  }

  public transformNode<Safe extends 'safe' | 'unsafe' = 'safe'>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (op: SafeWrap<Safe, Extract<Nodes, { type: T }>>) => any;
      preVisitor?: (op: Extract<Nodes, { type: T }>) => VisitContext;
    }},
  ): any {
    const transformWrapper = (curObject: object): unknown => {
      const casted = <{ type?: Nodes['type'] }>curObject;
      if (casted.type) {
        const ogFunc: ((node: any) => unknown) | undefined = nodeCallBacks[casted.type]?.transform;
        if (ogFunc) {
          return ogFunc(casted);
        }
      }
      return curObject;
    };
    const preTransformWrapper = (curObject: object): VisitContext => {
      const casted = <{ type?: Nodes['type'] }>curObject;
      if (casted.type) {
        const ogFunc: ((node: any) => VisitContext) | undefined = nodeCallBacks[casted.type]?.preVisitor;
        if (ogFunc) {
          return ogFunc(casted);
        }
      }
      return {};
    };
    return this.transformObject(startObject, transformWrapper, preTransformWrapper);
  }

  public visitNode(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      visitor?: (op: Extract<Nodes, { type: T }>) => void;
      preVisitor?: (op: Extract<Nodes, { type: T }>) => VisitContext;
    }},
  ): void {
    const visitWrapper = (curObject: object): void => {
      const casted = <{ type?: Nodes['type'] }>curObject;
      if (casted.type) {
        const ogFunc: ((node: any) => unknown) | undefined = nodeCallBacks[casted.type]?.visitor;
        if (ogFunc) {
          ogFunc(casted);
        }
      }
    };
    const preVisitWrapper = (curObject: object): VisitContext => {
      const casted = <{ type?: Nodes['type'] }>curObject;
      if (casted.type) {
        const ogFunc: ((node: any) => VisitContext) | undefined = nodeCallBacks[casted.type]?.preVisitor;
        if (ogFunc) {
          return ogFunc(casted);
        }
      }
      return {};
    };
    this.visitObject(startObject, visitWrapper, preVisitWrapper);
  }

  public traverseNodes(
    currentNode: Nodes,
    traverse: {[T in Nodes['type']]?: (op: Extract<Nodes, { type: T }>) => SelectiveTraversalContext<Nodes> },
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

export class TransformerSubType<Nodes extends Pick<Node, 'type' | 'subType'>> extends TransformerType<Nodes> {
  public transformNodeSpecific<Safe extends 'safe' | 'unsafe' = 'safe'>(
    startObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (op: SafeWrap<Safe, Extract<Nodes, { type: T }>>) => any;
      preVisitor?: (op: Extract<Nodes, { type: T }>) => VisitContext;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?: {
      [SubType in Extract<Nodes, { type: Type; subType: string }>['subType']]?: {
        transform?: (op: SafeWrap<Safe, Extract<Nodes, { type: Type; subType: SubType }>>) => any;
        preVisitor?: (op: Extract<Nodes, { type: Type; subType: SubType }>) => VisitContext;
      }}},
  ): any {
    const transformWrapper = (curObject: object): unknown => {
      let ogTransform: ((node: any) => unknown) | undefined;
      const casted = <{ type?: Nodes['type']; subType?: string }>curObject;
      if (casted.type && casted.subType) {
        const specific = nodeSpecificCallBacks[casted.type];
        if (specific) {
          ogTransform = specific[<keyof typeof specific> casted.subType]?.transform;
        }
        if (!ogTransform) {
          ogTransform = nodeCallBacks[casted.type]?.transform;
        }
      }
      return ogTransform ? ogTransform(casted) : curObject;
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
      return ogPreVisit ? ogPreVisit(casted) : curObject;
    };
    return this.transformObject(startObject, transformWrapper, preVisitWrapper);
  }

  /**
   * When both nodeCallBack and NodeSpecific callBack are matched, will only look at nodeSpecifCallback
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
      return ogPreVisit ? ogPreVisit(casted) : curObject;
    };
    this.visitObject(startObject, visitWrapper, preVisitWrapper);
  }

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
