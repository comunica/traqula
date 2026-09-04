/**
 * A value that is either available synchronously, or as a native promise.
 */
export type Awaitable<T> = T | Promise<T>;

export function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise;
}

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

export type PreOrderMappingReturn = Omit<TransformContext, 'copy'> & {
  /**
   * The value to replace the current one with.
   */
  newValue: unknown;
};

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
   * The number of times {@link transformObjectPreOrder} may hand the same position in the tree back to the
   * traversal - by remapping it, or by wrapping it in an array - before we assume the rules do not converge.
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
   *
   * `transformObject` never inspects the values a mapper returns; a returned promise is stored as-is.
   * `transformObjectAsync` awaits any thenable a mapper returns, so it cannot store one as a value.
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
    return this.runTransformObject(startObject, postMapper, preVisitor, false);
  }

  /**
   * Async variant of {@link transformObject}, supporting promise-returning callbacks.
   * The traversal is strictly sequential (depth-first, one suspension point) - it does not parallelise siblings.
   *
   * `transformObject` never inspects the values a mapper returns; a returned promise is stored as-is.
   * `transformObjectAsync` awaits any thenable a mapper returns, so it cannot store one as a value.
   * @param startObject object to start iterating from
   * @param postMapper postMapper to transform the various objects - argument is a copy of the original
   * @param preVisitor callback that is evaluated before iterating deeper.
   */
  public transformObjectAsync(
    startObject: object,
    postMapper: (copy: object, orig: object) => Awaitable<unknown>,
    preVisitor: (orig: object) => TransformContext = () => ({}),
  ): Promise<unknown> {
    return Promise.resolve(this.runTransformObject(startObject, postMapper, preVisitor, true));
  }

  protected runTransformObject(
    startObject: object,
    postMapper: (copy: object, orig: object) => Awaitable<unknown>,
    preVisitor: (orig: object) => TransformContext,
    allowAsync: boolean,
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

    // Work stack: nodes still to visit. Parallel arrays, length S.
    //   stack[i]        - original node to visit
    //   stackParent[i]  - copy to write the result into, under stackParentKey[i]
    // Seeded with the root under resultWrap.res, so the root's mapped value has
    // somewhere to land. S is the DFS frontier (all unvisited siblings on all levels),
    // not the depth — this is what maxStackSize bounds.
    const stack = [ startObject ];
    const stackParent: object[] = [ resultWrap ];
    const stackParentKey: string[] = [ 'res' ];

    // Post-map stack: visited, awaiting postMapper. Parallel arrays, length M.
    //   handleMapperOnLen[i] - stack.length snapshotted after popping node i, before pushing its children.
    //     The frontier returning to this value means i's subtree is done.
    //   mapperParent/Key[i]  - where postMapper's return value goes (may differ from the copy, hence a separate write)
    // M is the current ancestor chain, so M <= nesting depth and is usually far
    // below S. Watermarks are non-decreasing bottom-to-top; a match at the top
    // flushes and cascades to the parent.
    const handleMapperOnLen: number[] = [];
    const mapperCopyStack: object[] = [];
    const mapperOrigStack: object[] = [];
    const mapperParent: object[] = [];
    const mapperParentKey: string[] = [];

    // Returns a promise only when a postMapper suspended - it keeps unwinding itself once that resolves.
    function handleMapper(): PromiseLike<void> | undefined {
      while (stack.length === handleMapperOnLen.at(-1)) {
        handleMapperOnLen.pop();
        const copyToMap = mapperCopyStack.pop()!;
        const origToMap = mapperOrigStack.pop()!;
        const parent = <Record<string, unknown>> mapperParent.pop()!;
        const parentKey = mapperParentKey.pop()!;
        const mapped = postMapper(copyToMap, origToMap);
        if (allowAsync && isPromise(mapped)) {
          return mapped.then((value): PromiseLike<void> | undefined => {
            parent[parentKey] = value;
            return handleMapper();
          });
        }
        parent[parentKey] = mapped;
      }
      return undefined;
    }

    // The loop is wrapped so it can return at a suspension point and be called again to resume.
    const wrappedExecutionLoop = (): unknown => {
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
            const pending = handleMapper();
            if (pending) {
              return pending.then(wrappedExecutionLoop);
            }
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
        const pending = handleMapper();
        if (pending) {
          return pending.then(wrappedExecutionLoop);
        }
      }
      if (stack.length >= this.maxStackSize) {
        throw new Error('Transform object stack overflowed');
      }
      return resultWrap.res;
    };

    return wrappedExecutionLoop();
  }

  /**
   * Recursively transforms all objects that are not arrays, calling the preMapper on an object _before_
   * iterating into its descendants, and iterating into the *result* of that preMapper.
   * It should be noted that the preMapper is called using a *shallow* copy of the object.
   * Meaning manipulation of nested objects changes the original!
   * @param startObject object to start iterating from
   * @param preMapper mapper to transform the various objects -
   *   first argument is a copy of the original if default setup says to copy.
   *   It returns a {@link PreOrderMappingReturn}: the value taking the place of the object - the value we
   *   iterate into - together with the {@link TransformContext} steering that iteration. Since the mapper
   *   is the one deciding what the descendants of that value are, it hands us that context itself, there is
   *   no separate preVisitor. Whether we copy is therefore not up to the mapper either,
   *   the default context of this transformer decides that.
   *   The returned value is only handed back to the traversal - and thus mapped again - when the mapper
   *   asked for {@link TransformContext.reTransform}, in any other case we iterate straight into its
   *   descendants. An array is the exception: it is never mapped as a whole, its elements are handed back
   *   and mapped in turn. Either way the rules have to settle a position within {@link maxNodeRewrites}
   *   hand-backs of that position, or we assume they do not converge and throw.
   *   A {@link VisitContext.shortcut} simply ends the traversal - since an object is already mapped when we
   *   iterate into it, there is nothing left to unwind - leaving the objects still on the stack in the place
   *   they have in the (shallow) copy of their parent.
   *
   *   `transformObjectPreOrder` never inspects the values a mapper returns; a returned promise is stored as-is.
   *   `transformObjectPreOrderAsync` awaits any thenable a mapper returns, so it cannot store one as a value.
   */
  public transformObjectPreOrder(
    startObject: object,
    preMapper: (copy: object, orig: object) => PreOrderMappingReturn,
  ): unknown {
    return this.runTransformObjectPreOrder(startObject, preMapper, false);
  }

  /**
   * Async variant of {@link transformObjectPreOrder}, supporting promise-returning callbacks.
   * The traversal is strictly sequential (depth-first, one suspension point) - it does not parallelise siblings.
   *
   * `transformObjectPreOrder` never inspects the values a mapper returns; a returned promise is stored as-is.
   * `transformObjectPreOrderAsync` awaits any thenable a mapper returns, so it cannot store one as a value.
   * @param startObject object to start iterating from
   * @param preMapper mapper to transform the various objects.
   */
  public transformObjectPreOrderAsync(
    startObject: object,
    preMapper: (copy: object, orig: object) => Awaitable<PreOrderMappingReturn>,
  ): Promise<unknown> {
    return Promise.resolve(this.runTransformObjectPreOrder(startObject, preMapper, true));
  }

  protected runTransformObjectPreOrder(
    startObject: object,
    preMapper: (copy: object, orig: object) => Awaitable<PreOrderMappingReturn>,
    allowAsync: boolean,
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
    const resultWrap = { res: <unknown> startObject };

    const stack = [ startObject ];
    const stackParent: object[] = [ resultWrap ];
    const stackParentKey: string[] = [ 'res' ];
    // Counts for ech object how many times it has been rewritten
    const stackRewriteCount: number[] = [ 0 ];

    function pushArrayOnStack(array: unknown[], rewriteCount: number): void {
      // Register all containing objects in the stack to be handled.
      // The elements inherit the count of the array: an array is not mapped as a whole, so it does not
      // settle the position it takes, a rule wrapping its argument in one has to keep climbing.
      for (let index = array.length - 1; index >= 0; index--) {
        const val = array[index];
        if (val !== null && typeof val === 'object') {
          stack.push(val);
          stackParent.push(array);
          stackParentKey.push(index.toString());
          stackRewriteCount.push(rewriteCount);
        }
      }
    }

    const applyResult = (
      mapperResult: PreOrderMappingReturn,
      curParent: Record<string, unknown>,
      curKey: string,
      rewriteCount: number,
    ): void => {
      const newValue = mapperResult.newValue;

      // The object is mapped, the value takes its place in the tree
      curParent[curKey] = newValue;

      const continues = mapperResult.continue ?? defaultContinues;
      const ignoreKeys = mapperResult.ignoreKeys ?? defaultIgnoreKeys;
      const shallowKeys = mapperResult.shallowKeys ?? defaultShallowKeys;
      const reTransform = mapperResult.reTransform ?? defaultReTransform;
      didShortCut = mapperResult.shortcut ?? defaultDidShortCut;

      // Register values of returned object onto the stack
      // If primitive, or we do not go further, cannot do
      if (!continues || didShortCut || (newValue === null || typeof newValue !== 'object')) {
        return;
      }
      // We cannot retransform an array since the API never gives array to the callback.
      // Its elements are handed back to the traversal instead, and are mapped in turn.
      if (Array.isArray(newValue)) {
        pushArrayOnStack(newValue, rewriteCount + 1);
        return;
      }
      // If we need to re transform, register the object instead of its children.
      if (reTransform) {
        stack.push(newValue);
        stackParent.push(curParent);
        stackParentKey.push(curKey);
        stackRewriteCount.push(rewriteCount + 1);
        return;
      }
      // In any other case, push the children, ignoring ignoreKeys and shallowKeys.
      // Creating shallow copies of shallowKeys.
      const newAsRecord = <Record<string, unknown>> newValue;
      for (const key in newAsRecord) {
        if (!Object.hasOwn(newAsRecord, key) || ignoreKeys?.has(key)) {
          continue;
        }
        const val = newAsRecord[key];
        if (val !== null && typeof val === 'object') {
          if (shallowKeys?.has(key)) {
            newAsRecord[key] = this.cloneObj(val);
          } else {
            stack.push(val);
            stackParent.push(newAsRecord);
            stackParentKey.push(key);
            stackRewriteCount.push(0);
          }
        }
      }
    };

    // The loop is wrapped so it can return at a suspension point and be called again to resume.
    // Since there is nothing left to unwind, a shortcut simply ends the traversal.
    // Objects still on the stack keep the place they have in the (shallow) copy of their parent.
    const drive = (): unknown => {
      // The didShortCut flag is flipped inside applyResult (a separate closure), which the rule cannot see.
      // eslint-disable-next-line no-unmodified-loop-condition
      while (!didShortCut && stack.length > 0 && stack.length < this.maxStackSize) {
        const curObject = stack.pop()!;
        // Parent is always a raw object (not an array since we handle that differently)
        const curParent = <Record<string, unknown>> stackParent.pop()!;
        const curKey = stackParentKey.pop()!;
        const rewriteCount = stackRewriteCount.pop()!;

        if (rewriteCount >= this.maxNodeRewrites) {
          throw new Error(`Pre order transform did not converge: rewrote the same position ${this.maxNodeRewrites} times.`, { cause: curObject });
        }

        if (Array.isArray(curObject)) {
          const newArr = [ ...curObject ];
          curParent[curKey] = newArr;
          pushArrayOnStack(newArr, rewriteCount);
          continue;
        }

        // Map the object before its descendants, so that the mapper can decide what its descendants are.
        const copy = defaultCopyFlag ? this.cloneObj(curObject) : curObject;
        const mapperResult = preMapper(copy, curObject);
        if (allowAsync && isPromise(mapperResult)) {
          return mapperResult.then((result): unknown => {
            applyResult(result, curParent, curKey, rewriteCount);
            return drive();
          });
        }
        applyResult(<PreOrderMappingReturn>mapperResult, curParent, curKey, rewriteCount);
      }
      if (stack.length >= this.maxStackSize) {
        throw new Error('Transform object stack overflowed');
      }
      return resultWrap.res;
    };

    return drive();
  }

  /**
   * Visitor that visits all objects. Visits deeper objects first.
   *
   * `visitObjectAsync` awaits any thenable a visitor returns before visiting the next node.
   */
  public visitObject(
    startObject: object,
    visitor: (orig: object) => void,
    preVisitor: (orig: object) => VisitContext = () => ({}),
  ): void {
    this.runVisitObject(startObject, visitor, preVisitor, false);
  }

  /**
   * Async variant of {@link visitObject}, supporting promise-returning callbacks.
   * The traversal is strictly sequential (depth-first, one suspension point) - it does not parallelise siblings.
   */
  public visitObjectAsync(
    startObject: object,
    visitor: (orig: object) => Awaitable<void>,
    preVisitor: (orig: object) => VisitContext = () => ({}),
  ): Promise<void> {
    return <Promise<void>> Promise.resolve(this.runVisitObject(startObject, visitor, preVisitor, true));
  }

  protected runVisitObject(
    startObject: object,
    visitor: (orig: object) => Awaitable<void>,
    preVisitor: (orig: object) => VisitContext,
    allowAsync: boolean,
  ): unknown {
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

    // Returns a promise only when a visitor suspended - it keeps unwinding itself once that resolves.
    function handleVisitor(): PromiseLike<void> | undefined {
      while (stack.length === handleVisitorOnLen.at(-1)) {
        handleVisitorOnLen.pop();
        const toVisit = visitorStack.pop()!;
        const visited = visitor(toVisit);
        if (allowAsync && isPromise(visited)) {
          return visited.then((): PromiseLike<void> | undefined => handleVisitor());
        }
      }
      return undefined;
    }

    // The loop is wrapped so it can return at a suspension point and be called again to resume.
    const drive = (): unknown => {
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
            const pending = handleVisitor();
            if (pending) {
              return pending.then(drive);
            }
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
        const pending = handleVisitor();
        if (pending) {
          return pending.then(drive);
        }
      }
      if (stack.length >= this.maxStackSize) {
        throw new Error('Transform object stack overflowed');
      }
      return undefined;
    };

    return drive();
  }
}
