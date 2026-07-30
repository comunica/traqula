import type { Typed } from '../types.js';

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
  /**
   * Only used by {@link TransformerObject.transformObjectPreOrder}.
   * Whether to re-call the transform callback onto the result of the current transform callback.
   */
  reTransform?: boolean;
}

/**
 * What a pre-order mapper ({@link TransformerObject.transformObjectPreOrder}) returns:
 * the value taking the place of the object it mapped, together with the {@link TransformContext}
 * steering how the traversal handles _that_ value - whether to map it again, to iterate into it,
 * and which of its keys to skip or to only copy shallowly.
 * Since a pre-order mapper decides what we iterate into, it is also the one providing this context:
 * contrary to the post-order {@link TransformerObject.transformObject},
 * there is no separate preVisitor to provide it.
 * Copying is not part of it: a pre-order mapper is always handed a copy to do with as it pleases,
 * so whether copies are made at all is a matter of the {@link TransformerObject.defaultContext}.
 */
export type PreOrderMapping<T = unknown> = Omit<TransformContext, 'copy'> & { newValue: T };

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

/**
 * Base transformer class for recursively visiting and transforming object trees.
 * Operates on plain JavaScript objects without requiring specific type structure.
 *
 * Uses an iterative (stack-based) algorithm instead of recursion to handle deep trees safely.
 * {@link transformObject} and {@link visitObject} traverse depth-first, processing
 * deeper objects before their parents (post-order), so a callback sees the already transformed
 * descendants of the object it maps.
 * {@link transformObjectPreOrder} traverses the same tree in the opposite order - transforming an object
 * before its descendants (pre-order) - so a callback decides what the descendants we iterate into are.
 *
 * For type-aware traversal based on `type` and `subType` fields,
 * see {@link TransformerTyped} and {@link TransformerSubTyped}.
 */
export class TransformerObject {
  protected maxStackSize = 1_000_000;
  /**
   * The number of times a single object may be rewritten by {@link transformObjectPreOrder} before we
   * assume the rewriting rules do not converge.
   */
  protected maxNodeRewrites = 1_000;
  /**
   * Creates stateless transformer.
   * @param defaultContext
   */
  public constructor(protected readonly defaultContext: TransformContext = {}) {}

  public clone(newDefaultContext: TransformContext = {}): TransformerObject {
    return new TransformerObject({ ...this.defaultContext, ...newDefaultContext });
  }

  /**
   * Function to shallow clone any type.
   * @param obj
   * @protected
   */
  public cloneObj<T>(obj: T): T {
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
   * Recursively transforms all objects that are not arrays. Mapper is called on deeper objects first.
   * @param startObject object to start iterating from
   * @param postMapper postMapper to transform the various objects - argument is a copy of the original
   * @param preVisitor callback that is evaluated before iterating deeper.
   *   If continues is false, we do not iterate deeper, current object is still mapped. - default: true
   *   If shortcut is true, we do not iterate deeper, nor do we branch out, this postMapper will be the last one called.
   *    - Default false
   */
  public transformObject(
    startObject: object,
    postMapper: (copy: object, orig: object) => unknown,
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

    // Grows with reverse stack - when popping down the stack, you realise you still want to map something.
    // Counter of stack size when we started adding the children of this object, going beyond this means a new parent
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
        parent[parentKey] = postMapper(copyToMap, origToMap);
      }
    }

    while (stack.length > 0 && stack.length < this.maxStackSize) {
      const curObject = stack.pop()!;
      const curParent = stackParent.pop()!;
      const curKey = stackParentKey.pop()!;

      // Only add to the stack when you did not shortcut
      if (!didShortCut) {
        if (Array.isArray(curObject)) {
          const newArr = [ ...curObject ];
          handleMapperOnLen.push(stack.length);
          mapperCopyStack.push(newArr);
          mapperOrigStack.push(curObject);
          mapperParent.push(curParent);
          mapperParentKey.push(curKey);

          for (let index = curObject.length - 1; index >= 0; index--) {
            const val = <unknown> curObject[index];
            if (val !== null && typeof val === 'object') {
              stack.push(val);
              stackParent.push(newArr);
              stackParentKey.push(index.toString());
            }
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

        const copy = copyFlag ? this.cloneObj(curObject) : curObject;

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
              // Do not add stack entry - assign straight away
              (<Record<string, unknown>> copy)[key] = this.cloneObj(val);
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
    if (stack.length >= this.maxStackSize) {
      throw new Error('Transform object stack overflowed');
    }
    handleMapper();

    return <any> resultWrap.res;
  }

  /**
   * Recursively transforms all objects that are not arrays, calling the preMapper on an object _before_
   * iterating into its descendants, and iterating into the *result* of that preMapper.
   * It should be noted that the preMapper is called using a *shallow* copy of the object.
   * Meaning manipulation of nested objects changes the original!
   * @param startObject object to start iterating from
   * @param preMapper mapper to transform the various objects - first argument is a copy of the original.
   *   It returns a {@link PreOrderMapping}: the value taking the place of the object - which is what we
   *   iterate into - and the context steering how we handle that value.
   *   Since the mapper decides what its own descendants are, it provides that context itself,
   *   there is no separate preVisitor.
   *   If continue is false, we do not iterate deeper, the value still takes the place of the object.
   *    - Default true
   *   If shortcut is true, we do not iterate deeper, nor do we branch out, this is the last mapping made.
   *    - Default false
   *   The value is handed back to the traversal, and so mapped again, when the mapping asked for
   *   {@link TransformContext.reTransform}, in which case the mapping has to converge
   *   within {@link maxNodeRewrites} rewrites.
   */
  public transformObjectPreOrder(
    startObject: object,
    preMapper: (copy: object, orig: object) => PreOrderMapping,
  ): unknown {
    const defaults = this.defaultContext;
    const defaultCopyFlag = defaults.copy ?? true;
    const defaultContinues = defaults.continue ?? true;
    const defaultIgnoreKeys = defaults.ignoreKeys;
    const defaultShallowKeys = defaults.shallowKeys;
    const defaultDidShortCut = defaults.shortcut ?? false;
    const defaultReTransform = defaults.reTransform ?? false;

    // Code handles own stack instead of using recursion - this optimizes it for deep operations.
    // Contrary to {@link transformObject}, an object is mapped when it is popped of the stack,
    // so its result can be assigned to its parent right away - no reverse stack needed.
    let didShortCut = false;
    // Counts how often the object currently on top of the stack was rewritten into another object.
    // A rewrite is pushed back onto the stack, so it is popped again on the very next iteration.
    let rewrites = 0;
    const resultWrap = { res: <unknown> startObject };

    const stack = [ startObject ];
    const stackParent: object[] = [ resultWrap ];
    const stackParentKey: string[] = [ 'res' ];

    // Since there is nothing left to unwind, a shortcut simply ends the traversal.
    // Objects still on the stack keep the place they have in the (shallow) copy of their parent.
    while (!didShortCut && stack.length > 0 && stack.length < this.maxStackSize) {
      const curObject = stack.pop()!;
      const curParent = <Record<string, unknown>> stackParent.pop()!;
      const curKey = stackParentKey.pop()!;

      if (Array.isArray(curObject)) {
        const newArr = [ ...curObject ];
        curParent[curKey] = newArr;

        for (let index = curObject.length - 1; index >= 0; index--) {
          const val = <unknown> curObject[index];
          if (val !== null && typeof val === 'object') {
            stack.push(val);
            stackParent.push(newArr);
            stackParentKey.push(index.toString());
          }
        }
        continue;
      }

      // Map the object before its descendants, so that the mapper can decide what its descendants are.
      const copy = defaultCopyFlag ? this.cloneObj(curObject) : curObject;
      const { newValue, ...context } = preMapper(copy, curObject);

      // The object is mapped, the value takes its place in the tree
      curParent[curKey] = newValue;

      // A mapper returning the object it was given is done with it, and so is one returning something we
      // never map again: an array or a plain value.
      const isRewrite = newValue !== copy && newValue !== null && typeof newValue === 'object' &&
        !Array.isArray(newValue);

      // A rewrite asking to be mapped again is simply handed back to the traversal. A rule creating a new
      // object every time would never stabilize, hence the bound on the rewrites of a single object.
      if (isRewrite && (context.reTransform ?? defaultReTransform)) {
        if (++rewrites > this.maxNodeRewrites) {
          const type = (<Partial<Typed>> newValue).type;
          throw new Error(`Pre order transform did not converge: rewrote the same object ${
            this.maxNodeRewrites + 1} times${typeof type === 'string' ? ` (last type: ${type})` : ''}`);
        }
        stack.push(newValue);
        stackParent.push(curParent);
        stackParentKey.push(curKey);
        continue;
      }
      rewrites = 0;

      const continues = context.continue ?? defaultContinues;
      const ignoreKeys = context.ignoreKeys ?? defaultIgnoreKeys;
      const shallowKeys = context.shallowKeys ?? defaultShallowKeys;
      didShortCut = context.shortcut ?? defaultDidShortCut;

      // Extend stack if needed. Only objects can be iterated into,
      // and when shortcutted, the traversal ends, so no longer add to it.
      if (newValue !== null && typeof newValue === 'object' && continues && !didShortCut) {
        if (Array.isArray(newValue)) {
          // An array the mapper returned is handed back to the traversal,
          // which copies it and maps its elements in turn.
          stack.push(newValue);
          stackParent.push(curParent);
          stackParentKey.push(curKey);
          continue;
        }
        // A rewrite can be an object taken straight from the input tree, and iterating into an object
        // writes into it, so copy it first - just like we copied the object we started from.
        const node = <Record<string, unknown>> (isRewrite && defaultCopyFlag ? this.cloneObj(newValue) : newValue);
        curParent[curKey] = node;
        for (const key in node) {
          if (!Object.hasOwn(node, key)) {
            continue;
          }
          const val = node[key];

          // If shallow copy required, do
          const onlyShallow = shallowKeys && shallowKeys?.has(key);
          if (onlyShallow) {
            // Do not add stack entry - assign straight away
            node[key] = this.cloneObj(val);
          }
          if (ignoreKeys && ignoreKeys.has(key)) {
            // Do not add stack entry
            continue;
          }
          if (!onlyShallow && val !== null && typeof val === 'object') {
            // Do add stack entry.
            stack.push(val);
            stackParentKey.push(key);
            stackParent.push(node);
          }
        }
      }
    }
    if (stack.length >= this.maxStackSize) {
      throw new Error('Transform object stack overflowed');
    }

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

    while (stack.length > 0 && stack.length < this.maxStackSize) {
      const curObject = stack.pop()!;

      if (!didShortCut) {
        if (Array.isArray(curObject)) {
          for (let i = curObject.length - 1; i >= 0; i--) {
            const val = <unknown> curObject[i];
            if (val !== null && typeof val === 'object') {
              stack.push(val);
            }
          }
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
    if (stack.length >= this.maxStackSize) {
      throw new Error('Transform object stack overflowed');
    }
    handleVisitor();
  }
}
