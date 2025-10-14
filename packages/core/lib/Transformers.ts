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
    const defaultCopyFlag = defaults.copy ?? true;
    const defaultContinues = defaults.continue ?? true;
    const defaultIgnoreKeys = defaults.ignoreKeys;
    const defaultShallowKeys = defaults.shallowKeys;
    const defaultDidShortCut = defaults.shortcut ?? false;

    // Code handles own stack instead of using recursion - this optimizes it for deep operations.
    let didShortCut = false;
    const resultWrap = { res: startObject };

    // Grows with stack
    const stack = [ startObject ];
    const stackParent: object[] = [ resultWrap ];
    const stackParentKey: string[] = [ 'res' ];

    // Grows with reverse stack - when poping down the stack, you realise you still want to map something.
    // Counter of stack size when we started adding the childeren onf this object, going beyond this means a new parent
    const handleMapperOnLen: number[] = [];
    const mapperCopyStack: object[] = [];
    const mapperOrigStack: object[] = [];
    const mapperParent: object[] = [];
    const mapperParentKey: string[] = [];

    function handleMapper(): void {
      while (stack.length === handleMapperOnLen.at(-1)) {
        handleMapperOnLen.pop();
        const copyToMap = mapperCopyStack.pop()!;
        const origToMap = mapperOrigStack.pop()!;
        const parent = <Record<string, unknown>> mapperParent.pop()!;
        const parentKey = mapperParentKey.pop()!;
        parent[parentKey] = mapper(copyToMap, origToMap);
      }
    }

    while (stack.length > 0) {
      const curObject = stack.pop()!;
      const curParent = stackParent.pop()!;
      const curKey = stackParentKey.pop()!;

      // Only add to the stack when you did not shortcut
      if (!didShortCut) {
        if (Array.isArray(curObject)) {
          // eslint-disable-next-line unicorn/no-new-array
          const newArr = new Array(curObject.length);
          handleMapperOnLen.push(stack.length);
          mapperCopyStack.push(newArr);
          mapperOrigStack.push(curObject);
          mapperParent.push(curParent);
          mapperParentKey.push(curKey);

          // eslint-disable-next-line unicorn/no-for-loop
          for (let index = 0; index < curObject.length; index++) {
            stack.push(curObject[index]);
            stackParent.push(newArr);
            stackParentKey.push(index.toString());
          }
          handleMapper();
          continue;
        }

        // Perform pre visit before expanding the stack
        const context = preVisitor(<any>curObject);
        const copyFlag = context.copy ?? defaultCopyFlag;
        const continues = context.continue ?? defaultContinues;
        const ignoreKeys = context.ignoreKeys ?? defaultIgnoreKeys;
        const shallowKeys = context.shallowKeys ?? defaultShallowKeys;
        didShortCut = context.shortcut ?? defaultDidShortCut;

        const copy = copyFlag ? this.clone(curObject) : curObject;

        // Register that you want to be visited
        handleMapperOnLen.push(stack.length);
        mapperCopyStack.push(copy);
        mapperOrigStack.push(curObject);
        mapperParent.push(curParent);
        mapperParentKey.push(curKey);

        // Extend stack if needed. When shortcutted, should still unwind the stack, but no longer add to it.
        if (continues && !didShortCut) {
          for (const key in copy) {
            if (!Object.hasOwn(copy, key)) {
              continue;
            }
            const val = (<Record<string, unknown>> copy)[key];

            // If shallow copy required, do
            const onlyShallow = shallowKeys && shallowKeys?.has(key);
            if (onlyShallow) {
              // Do not add stack entry
              (<Record<string, unknown>> copy)[key] = this.clone(val);
            }
            if (ignoreKeys && ignoreKeys.has(key)) {
              // Do not add stack entry
              continue;
            }
            if (!onlyShallow && val !== null && typeof val === 'object') {
              // Do add stack entry.
              stack.push(val);
              stackParentKey.push(key);
              stackParent.push(copy);
            }
          }
        }
      }
      handleMapper();
    }
    handleMapper();

    return <any> resultWrap.res;
  }

  /**
   * Visitor that visits all objects. Visits deeper objects first.
   */
  public visitObject(
    startObject: object,
    visitor: (orig: object) => void,
    preVisitor: (orig: object) => VisitContext = () => ({}),
  ): void {
    const defaults = this.defaultContext;
    const defaultContinues = defaults.continue ?? true;
    const defaultIgnoreKeys = defaults.ignoreKeys;
    const defaultShortcut = defaults.shortcut ?? false;

    let didShortCut = false;

    // Stack of things to preVisit
    const stack = [ startObject ];
    // When the stack is done preVisiting things above this lengths, visit the bellow
    const handleVisitorOnLen: number[] = [];
    const visitorStack: object[] = [];

    function handleVisitor(): void {
      while (stack.length === handleVisitorOnLen.at(-1)) {
        handleVisitorOnLen.pop();
        const toVisit = visitorStack.pop()!;
        visitor(toVisit);
      }
    }

    while (stack.length > 0) {
      const curObject = stack.pop()!;

      if (!didShortCut) {
        if (Array.isArray(curObject)) {
          stack.push(...curObject);
          handleVisitor();
          continue;
        }

        // Perform pre visit before expanding the stack
        const context = preVisitor(curObject);
        didShortCut = context.shortcut ?? defaultShortcut;
        const continues = context.continue ?? defaultContinues;
        const ignoreKeys = context.ignoreKeys ?? defaultIgnoreKeys;

        // Register that you want to be visited
        handleVisitorOnLen.push(stack.length);
        visitorStack.push(curObject);

        // Extend stack if needed. When shortcutted, should still unwind the stack, but no longer add to it.
        if (continues && !didShortCut) {
          for (const key in curObject) {
            if (!Object.hasOwn(curObject, key)) {
              continue;
            }
            if (ignoreKeys && ignoreKeys.has(key)) {
              continue;
            }
            const val = (<Record<string, unknown>> curObject)[key];
            if (val && typeof val === 'object') {
              stack.push(val);
            }
          }
        }
      }
      handleVisitor();
    }
    handleVisitor();
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
    const transformWrapper = (copy: object, orig: object): unknown => {
      let ogTransform: ((copy: any, orig: any) => unknown) | undefined;
      const casted = <{ type?: Nodes['type'] }>copy;
      if (casted.type) {
        ogTransform = nodeCallBacks[casted.type]?.transform;
      }
      return ogTransform ? ogTransform(casted, orig) : copy;
    };
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => VisitContext) | undefined;
      const casted = <{ type?: Nodes['type'] }>curObject;
      if (casted.type) {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
      }
      return ogPreVisit ? ogPreVisit(casted) : {};
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
      visitor?: (op: Extract<Nodes, { type: T }>) => void;
      preVisitor?: (op: Extract<Nodes, { type: T }>) => VisitContext;
    }},
  ): void {
    const visitorWrapper = (curObject: object): void => {
      const casted = <{ type?: Nodes['type'] }>curObject;
      if (casted.type) {
        const ogTransform = nodeCallBacks[casted.type]?.visitor;
        if (ogTransform) {
          ogTransform(<any> casted);
        }
      }
    };
    const preVisitWrapper = (curObject: object): VisitContext => {
      let ogPreVisit: ((node: any) => VisitContext) | undefined;
      const casted = <{ type?: Nodes['type'] }>curObject;
      if (casted.type) {
        ogPreVisit = nodeCallBacks[casted.type]?.preVisitor;
      }
      return ogPreVisit ? ogPreVisit(casted) : {};
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
