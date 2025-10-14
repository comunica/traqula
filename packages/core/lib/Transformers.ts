import type { Node } from './nodeTypings.js';

type Safeness = 'safe' | 'unsafe';
type SafeWrap<Safe extends Safeness, obj extends object> = Safe extends 'safe' ? {[key in keyof obj]: unknown } : obj;

export interface VisitContext {
  /**
   * Whether you should stop iterating after this object. Default false.
   */
  shortcut?: boolean;
  /**
   * Whether you should continue iterating deeper with this object. Default true.
   */
  continue?: boolean;
  /**
   * Object keys that can be ignored, meaning they do not get visited.
   */
  ignoreKeys?: Set<string>;
}

export interface TransformContext extends VisitContext {
  /**
   * Object keys that will be shallowly copied but not traversed.
   * When the same key is included here and in ignoreKeys, the copy will still be made.
   */
  shallowKeys?: Set<string>;
  /**
   * Whether the visited object should be shallowly copied or not. Defaults to true.
   */
  copy?: boolean;
}

export interface SelectiveTraversalContext<Nodes> {
  /**
   * Nodes you should visit next. Defaults to empty list
   */
  next?: Nodes[];
  /**
   * Whether you should stop visiting after visiting this object. Default false.
   */
  shortcut?: boolean;
}

export class TransformerType<Nodes extends Pick<Node, 'type'>> {
  /**
   * Creates stateless transformer.
   * @param defaultContext
   */
  public constructor(private readonly defaultContext: TransformContext = {}) {}

  /**
   * Function to shallow clone any type.
   * @param obj
   * @protected
   */
  protected clone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    const proto = Object.getPrototypeOf(obj);

    // Fast path: plain object
    if (proto === Object.prototype || proto === null) {
      // Spread or assign preserves fast properties
      return { ...obj };
    }

    // Otherwise, preserve prototype for custom objects
    return Object.assign(Object.create(proto), obj);
  }

  /**
   * Function that will call the visitor callback only on true objects.
   * If the provided value is an array object, it will callback on all members
   * @param value
   * @param visitor
   * @protected
   */
  protected safeObjectVisit(value: unknown, visitor: (some: object) => unknown): void {
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        for (const x of value) {
          this.safeObjectVisit(x, visitor);
        }
        return;
      }
      visitor(value);
    }
  }

  protected safeObjectMap(value: unknown, mapper: (some: object) => unknown): unknown {
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        // Map() creates new array, preserves fast elements
        const len = value.length;
        // eslint-disable-next-line unicorn/no-new-array
        const result = new Array(len);
        for (let i = 0; i < len; i++) {
          result[i] = this.safeObjectMap(value[i], mapper);
        }
        return result;
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
    mapper: (copy: object, orig: object) => unknown,
    preVisitor: (orig: object) => TransformContext = () => ({}),
  ): unknown {
    const defaults = this.defaultContext;
    let didShortCut = false;

    const recurse = (curObject: object): unknown => {
      const context = preVisitor(curObject);
      const copyFlag = context.copy ?? defaults.copy ?? true;
      const copy = copyFlag ? this.clone(curObject) : curObject;

      didShortCut = context.shortcut ?? defaults.shortcut ?? false;
      const continues = context.continue ?? defaults.continue ?? true;
      const ignoreKeys = context.ignoreKeys ?? defaults.ignoreKeys ?? undefined;
      const shallowKeys = context.shallowKeys ?? defaults.shallowKeys ?? undefined;

      if (continues && !didShortCut) {
        for (const key in copy) {
          if (!Object.hasOwn(copy, key)) {
            continue;
          }
          if (didShortCut) {
            return copy;
          }
          const val = (<Record<string, unknown>> copy)[key];

          // If shallow copy required, do
          const onlyShallow = shallowKeys && shallowKeys.has(key);
          if (onlyShallow) {
            (<Record<string, unknown>> copy)[key] = this.clone(val);
          }
          if (ignoreKeys && ignoreKeys.has(key)) {
            continue;
          }
          if (!onlyShallow) {
            (<Record<string, unknown>> copy)[key] = this.safeObjectMap(val, recurse);
          }
        }
      }
      return mapper(copy, curObject);
    };

    return recurse(startObject);
  }

  /**
   * Visitor that visits all objects. Visits deeper objects first.
   */
  public visitObject(
    startObject: object,
    visitor: (orig: object) => void,
    preVisitor: (orig: object) => VisitContext = () => ({}),
  ): void {
    let didShortCut = false;
    const defaults = this.defaultContext;
    const defaultContinueFlag = defaults.continue ?? true;
    const defaultShortCut = defaults.shortcut ?? false;

    const recurse = (curObject: object): void => {
      const context = preVisitor(curObject);
      didShortCut = context.shortcut ?? defaultShortCut;
      const continues = context.continue ?? defaultContinueFlag;
      const ignoreKeys = context.ignoreKeys ?? defaults.ignoreKeys;

      if (continues && !didShortCut) {
        for (const key in curObject) {
          if (!Object.hasOwn(curObject, key)) {
            continue;
          }
          const val = (<Record<string, unknown>> curObject)[key];

          if (didShortCut) {
            return;
          }
          if (ignoreKeys && ignoreKeys.has(key)) {
            continue;
          }
          this.safeObjectVisit(val, recurse);
        }
      }
      visitor(curObject);
    };
    recurse(startObject);
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
      transform?: (copy: SafeWrap<Safe, Extract<Nodes, { type: T }>>, orig: Extract<Nodes, { type: T }>) => unknown;
      preVisitor?: (orig: Extract<Nodes, { type: T }>) => TransformContext;
    }},
  ): Safe extends 'unsafe' ? OutType : unknown {
    const defaults = this.defaultContext;
    const defaultCopy = defaults.copy ?? true;
    const defaultContinueFlag = defaults.continue ?? true;
    const defaultShortCut = defaults.shortcut ?? false;
    const defaultIgnoreKeys = defaults.ignoreKeys;
    const defaultShallowKeys = defaults.ignoreKeys;
    let didShortCut = false;

    const recurse = (curObject: object): unknown => {
      let copyFlag = defaultCopy;
      let continues = defaultContinueFlag;
      let ignoreKeys = defaultIgnoreKeys;
      let shallowKeys: Set<string> | undefined = defaultShallowKeys;
      didShortCut = defaultShortCut;

      const casted = <{ type?: Nodes['type'] }>curObject;
      let callBacks: (typeof nodeCallBacks)[string];
      if (casted.type) {
        callBacks = nodeCallBacks[casted.type];
      }
      if (callBacks?.preVisitor) {
        const context = callBacks.preVisitor(<any>curObject);
        copyFlag = context.copy ?? defaultCopy;
        continues = context.continue ?? defaultContinueFlag;
        ignoreKeys = context.ignoreKeys ?? defaultIgnoreKeys;
        shallowKeys = context.shallowKeys ?? defaultShallowKeys;
        didShortCut = context.shortcut ?? didShortCut;
      }

      const copy = copyFlag ? this.clone(curObject) : curObject;

      if (continues && !didShortCut) {
        for (const key in copy) {
          if (!Object.hasOwn(copy, key)) {
            continue;
          }
          if (didShortCut) {
            return copy;
          }
          const val = (<Record<string, unknown>> copy)[key];

          // If shallow copy required, do
          const onlyShallow = shallowKeys && shallowKeys?.has(key);
          if (onlyShallow) {
            (<Record<string, unknown>> copy)[key] = this.clone(val);
          }
          if (ignoreKeys && ignoreKeys.has(key)) {
            continue;
          }
          if (!onlyShallow) {
            (<Record<string, unknown>> copy)[key] = this.safeObjectMap(val, recurse);
          }
        }
      }
      if (callBacks?.transform) {
        return callBacks.transform(<any> copy, <any> curObject);
      }
      return copy;
    };

    return <any> recurse(startObject);
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
      visitor?: (op: Extract<Nodes, { type: T }>) => void;
      preVisitor?: (op: Extract<Nodes, { type: T }>) => VisitContext;
    }},
  ): void {
    let didShortCut = false;

    const recurse = (curObject: object): void => {
      didShortCut = this.defaultContext.shortcut ?? false;
      let continues = this.defaultContext.continue ?? true;
      let ignoreKeys = this.defaultContext.ignoreKeys ?? undefined;
      const casted = <{ type?: Nodes['type'] }>curObject;
      let callBacks: (typeof nodeCallBacks)[string];
      if (casted.type) {
        callBacks = nodeCallBacks[casted.type];
      }
      if (callBacks?.preVisitor) {
        const context = callBacks.preVisitor(<any> casted);
        didShortCut = context.shortcut ?? didShortCut;
        continues = context.continue ?? continues;
        ignoreKeys = context.ignoreKeys ?? ignoreKeys;
      }
      if (continues && !didShortCut) {
        for (const [ key, value ] of Object.entries(curObject)) {
          if (didShortCut) {
            return;
          }
          if (ignoreKeys && ignoreKeys.has(key)) {
            continue;
          }
          this.safeObjectVisit(value, recurse);
        }
      }
      if (callBacks?.visitor) {
        callBacks.visitor(<any> curObject);
      }
    };
    recurse(startObject);
  }

  /**
   * Traverses only selected nodes as returned by the function.
   * @param currentNode
   * @param traverse
   */
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
      return ogPreVisit ? ogPreVisit(casted) : curObject;
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
      return ogPreVisit ? ogPreVisit(casted) : curObject;
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
