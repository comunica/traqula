/**
 * A value that is either available synchronously, or as a native promise.
 */
export type Awaitable<T> = T | Promise<T>;

export function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise;
}

/**
 * Applies a function to a value, once it resolved when it is a promise.
 * @param value the value, or a promise of it.
 * @param apply the function to apply.
 * @return the result, or a promise of it.
 */
export function mapAwaitable<Value, Result>(
  value: Awaitable<Value>,
  apply: (value: Value) => Result,
): Awaitable<Result> {
  return isPromise(value) ? value.then(apply) : apply(value);
}

/**
 * A key of the given object, or any other string.
 * Unlike `keyof Obj | string`, the IDE keeps suggesting the keys of the object.
 */
export type ObjectKeyHint<Obj> = (keyof Obj & string) | (string & NonNullable<unknown>);

/**
 * Whether a key should not be visited according to the given ignoreKeys and visitOnlyKeys.
 */
export function isKeyIgnored(key: string, ignoreKeys?: Set<string>, visitOnlyKeys?: Set<string>): boolean {
  return (ignoreKeys?.has(key) ?? false) || !(visitOnlyKeys?.has(key) ?? true);
}

/**
 * A step of a {@link VisitPath} into every element of an array or every value of an object.
 * Created with `Symbol.for`, so the CommonJS and ES module builds of this package share it.
 */
export const pathWildcard: unique symbol = Symbol.for('@traqula/core/pathWildcard');

/**
 * A step of a {@link VisitPath}: an object key, an array index, or the {@link pathWildcard}.
 */
export type PathKey = string | number | typeof pathWildcard;

/**
 * Whether a step of a path steps into the given key of an object.
 * @param pathKey the step of the path.
 * @param objectKey the key of the object.
 * @return whether the step matches the key.
 */
export function pathKeyMatches(pathKey: PathKey, objectKey: string): boolean {
  return pathKey === pathWildcard || String(pathKey) === objectKey;
}

/**
 * The visitPaths of a context, or those of its fallback when the context gives no visitOnlyKeys.
 * @param context the more specific context.
 * @param fallback the context it falls back to.
 * @return the visitPaths to follow, if any.
 */
export function resolveVisitPaths(context: VisitContext, fallback: VisitContext): VisitContext['visitPaths'] {
  return context.visitPaths ?? (context.visitOnlyKeys ? undefined : fallback.visitPaths);
}

/**
 * Merges a context over its fallback, its visitOnlyKeys replacing the visitPaths of the fallback.
 * @param context the more specific context.
 * @param fallback the context it falls back to.
 * @return the merged context.
 */
export function mergeContextWithFallback<Context extends VisitContext>(context: Context, fallback: Context): Context {
  const merged = { ...fallback, ...context };
  // Only overwritten when it changes, keeping the plain spread fast
  if (fallback.visitPaths && !context.visitPaths && context.visitOnlyKeys) {
    merged.visitPaths = undefined;
  }
  return merged;
}

/**
 * The visitPaths from an object as a tree of their steps, the steps of each key including those of the wildcard.
 */
interface VisitPathTrie {
  /**
   * Whether a path ends at this object.
   */
  pathEnds: boolean;
  /**
   * The remaining paths per key stepped into.
   */
  stepsByKey: Map<string, VisitPathTrie>;
  /**
   * The remaining paths of the keys not in {@link stepsByKey}.
   */
  wildcardSteps?: VisitPathTrie;
}

/**
 * Builds the trie of the given paths.
 * @param paths the paths to build the trie of.
 * @return the trie.
 */
function buildVisitPathTrie(paths: readonly (readonly PathKey[])[]): VisitPathTrie {
  const trie: VisitPathTrie = { pathEnds: paths.some(path => path.length === 0), stepsByKey: new Map() };
  const remainingPaths = (matches: (pathKey: PathKey) => boolean): PathKey[][] => paths
    .filter(path => path.length > 0 && matches(path[0]))
    .map(path => path.slice(1));
  for (const [ pathKey ] of paths) {
    if (pathKey === undefined || pathKey === pathWildcard) {
      continue;
    }
    const objectKey = String(pathKey);
    if (!trie.stepsByKey.has(objectKey)) {
      trie.stepsByKey.set(objectKey, buildVisitPathTrie(remainingPaths(other => pathKeyMatches(other, objectKey))));
    }
  }
  if (paths.some(([ pathKey ]) => pathKey === pathWildcard)) {
    trie.wildcardSteps = buildVisitPathTrie(remainingPaths(pathKey => pathKey === pathWildcard));
  }
  return trie;
}

/**
 * The trie per array of visitPaths, so an array is prepared once and should not change once used.
 */
const visitPathTrieCache = new WeakMap<readonly (readonly PathKey[])[], VisitPathTrie>();

/**
 * The trie of the given paths, built once per array.
 * @param paths the paths to get the trie of.
 * @return the trie.
 */
function visitPathTrieOf(paths: readonly (readonly PathKey[])[]): VisitPathTrie {
  let trie = visitPathTrieCache.get(paths);
  if (!trie) {
    trie = buildVisitPathTrie(paths);
    visitPathTrieCache.set(paths, trie);
  }
  return trie;
}

/**
 * How a traversal follows visitPaths, the same for every object it visits.
 */
interface PathTraversalSettings {
  /**
   * Whether to shallowly copy the objects a path steps through.
   */
  copy: boolean;
  /**
   * The ignoreKeys of the objects a path steps through.
   */
  ignoreKeys: Set<string> | undefined;
  /**
   * The shallowKeys of the objects a path steps through.
   */
  shallowKeys: Set<string> | undefined;
  /**
   * Called on each object at the end of a path, with the object holding it and its key.
   */
  onObjectFound: (value: object, holder: Record<string, unknown>, key: string) => void;
}

/**
 * A path from an object to an object it holds, see {@link VisitContext.visitPaths}.
 * The IDE suggests the first key but any path is accepted; type paths as `ContainerPaths` to check every step.
 */
export type VisitPath<Obj> = readonly [ObjectKeyHint<Obj> | typeof pathWildcard, ...PathKey[]];

/**
 * @typeParam Obj - The object this context applies to, its keys are suggested by the IDE.
 */
export interface VisitContext<Obj = object> {
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
  ignoreKeys?: Set<ObjectKeyHint<Obj>>;
  /**
   * Object keys that can be visited, all other keys are ignored. By default, all keys can be visited.
   * A key included here and in {@link ignoreKeys} is ignored.
   * An empty set in the default context makes a transformer only visit keys a node allows, unless it has visitPaths.
   */
  visitOnlyKeys?: Set<ObjectKeyHint<Obj>>;
  /**
   * Paths to the objects to visit instead of the keys of this object, stepping through objects without a type.
   * See the AST structure docs for how they combine with the other keys of a context.
   */
  visitPaths?: readonly VisitPath<Obj>[];
}

/**
 * @typeParam Obj - The object this context applies to, its keys are suggested by the IDE.
 */
export interface TransformContext<Obj = object> extends VisitContext<Obj> {
  /**
   * Object keys that will be shallowly copied but not traversed.
   * When the same key is ignored through {@link ignoreKeys} or {@link visitOnlyKeys}, the copy will still be made.
   */
  shallowKeys?: Set<ObjectKeyHint<Obj>>;
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
    return new TransformerObject(mergeContextWithFallback(newDefaultContext, this.defaultContext));
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
    if (Array.isArray(obj)) {
      return <T> [ ...obj ];
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
   * Whether visitPaths end at the given object, even with steps left. Never by default.
   * @param _object the object a path steps into.
   * @return whether the paths end there.
   */
  protected endsPathsAt(_object: object): boolean {
    return false;
  }

  /**
   * Whether the given paths visit the value of a key as a whole: a path ends at it, or it ends paths itself.
   * @param paths the paths from the holder.
   * @param holder the object holding the key.
   * @param key the key of the holder.
   * @return whether the value is visited as a whole.
   */
  protected pathsVisitWholeKey(paths: readonly (readonly PathKey[])[], holder: object, key: string): boolean {
    const trie = visitPathTrieOf(paths);
    const next = trie.stepsByKey.get(key) ?? trie.wildcardSteps;
    const value = (<Record<string, unknown>> holder)[key];
    return next !== undefined &&
      (next.pathEnds || (value !== null && typeof value === 'object' && this.endsPathsAt(value)));
  }

  /**
   * Calls the traversal back on the objects at the given paths, in the order a traversal of the keys pushes them.
   * @param holder the object the paths start from.
   * @param trie the paths to follow.
   * @param ignoreKeys the keys of the holder not to step into.
   * @param shallowKeys the keys of the holder to shallowly copy instead of stepping into.
   * @param traversal how to follow the paths past the holder.
   */
  private findObjectsAtPaths(
    holder: Record<string, unknown>,
    trie: VisitPathTrie,
    ignoreKeys: Set<string> | undefined,
    shallowKeys: Set<string> | undefined,
    traversal: PathTraversalSettings,
  ): void {
    if (Array.isArray(holder)) {
      for (let index = holder.length - 1; index >= 0; index--) {
        const element: unknown = holder[index];
        if (element !== null && typeof element === 'object') {
          this.findObjectsAtPathKey(holder, index.toString(), trie, ignoreKeys, shallowKeys, traversal);
        }
      }
      return;
    }
    for (const key in holder) {
      if (Object.hasOwn(holder, key)) {
        this.findObjectsAtPathKey(holder, key, trie, ignoreKeys, shallowKeys, traversal);
      }
    }
  }

  /**
   * Follows the given paths into one key of the holder, see {@link findObjectsAtPaths}.
   * @param holder the object holding the key.
   * @param key the key to step into.
   * @param trie the paths to follow from the holder.
   * @param ignoreKeys the keys of the holder not to step into.
   * @param shallowKeys the keys of the holder to shallowly copy instead of stepping into.
   * @param traversal how to follow the paths past the holder.
   */
  private findObjectsAtPathKey(
    holder: Record<string, unknown>,
    key: string,
    trie: VisitPathTrie,
    ignoreKeys: Set<string> | undefined,
    shallowKeys: Set<string> | undefined,
    traversal: PathTraversalSettings,
  ): void {
    let value = holder[key];
    if (value === null || typeof value !== 'object') {
      return;
    }
    if (shallowKeys?.has(key)) {
      holder[key] = this.cloneObj(value);
      return;
    }
    const next = trie.stepsByKey.get(key) ?? trie.wildcardSteps;
    if (!next || isKeyIgnored(key, ignoreKeys)) {
      return;
    }
    if (next.pathEnds || this.endsPathsAt(value)) {
      traversal.onObjectFound(value, holder, key);
      return;
    }
    if (traversal.copy) {
      value = this.cloneObj(value);
      holder[key] = value;
    }
    const container = <Record<string, unknown>> value;
    this.findObjectsAtPaths(container, next, traversal.ignoreKeys, traversal.shallowKeys, traversal);
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
  public async transformObjectAsync(
    startObject: object,
    postMapper: (copy: object, orig: object) => Awaitable<unknown>,
    preVisitor: (orig: object) => Awaitable<TransformContext> = () => ({}),
  ): Promise<unknown> {
    return this.runTransformObject(startObject, postMapper, preVisitor, true);
  }

  protected runTransformObject(
    startObject: object,
    postMapper: (copy: object, orig: object) => Awaitable<unknown>,
    preVisitor: (orig: object) => Awaitable<TransformContext>,
    allowAsync: boolean,
  ): unknown {
    const defaults = this.defaultContext;
    const defaultCopyFlag = defaults.copy ?? true;
    const defaultContinues = defaults.continue ?? true;
    const defaultIgnoreKeys = defaults.ignoreKeys;
    const defaultVisitOnlyKeys = defaults.visitOnlyKeys;
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
    // below S. maxStackSize bounds M too, capping depth so a cycle overflows instead of growing without bound.
    // Watermarks are non-decreasing bottom-to-top; a match at the top
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

    const pushChild = (val: object, parent: object, key: string): void => {
      stack.push(val);
      stackParentKey.push(key);
      stackParent.push(parent);
    };
    const copyingPathTraversal: PathTraversalSettings = {
      copy: true,
      ignoreKeys: defaultIgnoreKeys,
      shallowKeys: defaultShallowKeys,
      onObjectFound: pushChild,
    };
    const inPlacePathTraversal: PathTraversalSettings = { ...copyingPathTraversal, copy: false };

    // Everything after the preVisitor call - split out so it can also run from inside a resolved promise.
    const expand = (curObject: object, curParent: object, curKey: string, context: TransformContext): void => {
      const copyFlag = context.copy ?? defaultCopyFlag;
      const continues = context.continue ?? defaultContinues;
      const ignoreKeys = context.ignoreKeys ?? defaultIgnoreKeys;
      const visitOnlyKeys = context.visitOnlyKeys ?? defaultVisitOnlyKeys;
      const visitPaths = resolveVisitPaths(context, defaults);
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
        if (visitPaths) {
          const holder = <Record<string, unknown>> copy;
          const traversal = copyFlag ? copyingPathTraversal : inPlacePathTraversal;
          this.findObjectsAtPaths(holder, visitPathTrieOf(visitPaths), ignoreKeys, shallowKeys, traversal);
          return;
        }
        for (const key in copy) {
          if (!Object.hasOwn(copy, key)) {
            continue;
          }
          const val = (<Record<string, unknown>> copy)[key];

          // If shallow copy required, do
          if (shallowKeys && shallowKeys?.has(key)) {
            // Do not add stack entry - assign straight away
            (<Record<string, unknown>> copy)[key] = this.cloneObj(val);
          } else if (val !== null && typeof val === 'object' && !isKeyIgnored(key, ignoreKeys, visitOnlyKeys)) {
            pushChild(val, copy, key);
          }
        }
      }
    };

    // The loop is wrapped so it can return at a suspension point and be called again to resume.
    const wrappedExecutionLoop = (): unknown => {
      while (stack.length > 0 && stack.length < this.maxStackSize && handleMapperOnLen.length < this.maxStackSize) {
        const curObject = stack.pop()!;
        const curParent = stackParent.pop()!;
        const curKey = stackParentKey.pop()!;

        // Only add to the stack when you did not shortcut
        if (!didShortCut) {
          if (Array.isArray(curObject)) {
            const newArr = this.cloneObj(curObject);
            handleMapperOnLen.push(stack.length);
            mapperCopyStack.push(newArr);
            mapperOrigStack.push(curObject);
            mapperParent.push(curParent);
            mapperParentKey.push(curKey);

            for (let index = curObject.length - 1; index >= 0; index--) {
              const val = <unknown> curObject[index];
              if (val !== null && typeof val === 'object') {
                pushChild(val, newArr, index.toString());
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
          if (allowAsync && isPromise(context)) {
            return context.then((context) => {
              expand(curObject, curParent, curKey, context);
              const pending = handleMapper();
              return pending ? pending.then(wrappedExecutionLoop) : wrappedExecutionLoop();
            });
          }
          expand(curObject, curParent, curKey, <TransformContext>context);
        }
        const pending = handleMapper();
        if (pending) {
          return pending.then(wrappedExecutionLoop);
        }
      }
      if (stack.length >= this.maxStackSize || handleMapperOnLen.length >= this.maxStackSize) {
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
  public async transformObjectPreOrderAsync(
    startObject: object,
    preMapper: (copy: object, orig: object) => Awaitable<PreOrderMappingReturn>,
  ): Promise<unknown> {
    return this.runTransformObjectPreOrder(startObject, preMapper, true);
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
    const defaultVisitOnlyKeys = defaults.visitOnlyKeys;
    const defaultShallowKeys = defaults.shallowKeys;
    const defaultDidShortCut = defaults.shortcut ?? false;
    const defaultReTransform = defaults.reTransform ?? false;

    // Code handles own stack instead of using recursion - this optimizes it for deep operations.
    // Contrary to {@link transformObject}, an object is mapped when it is popped of the stack,
    // so its result can be assigned to its parent right away - no reverse (post-map) stack needed.
    let didShortCut = false;
    const resultWrap = { res: <unknown> startObject };

    // Work stack: nodes still to visit. Parallel arrays, length S.
    //   stack[i]             - original node to visit
    //   stackParent[i]       - object to write the mapped value into, under stackParentKey[i]
    //   stackRewriteCount[i] - how many times this position was already handed back (remap/array-wrap),
    //     bounded by maxNodeRewrites so non-converging rules throw instead of looping forever.
    //   stackDepth[i]        - nesting depth of the position. With no ancestor stack to bound, maxStackSize
    //     bounds this too, so a cycle overflows instead of growing without bound.
    // Seeded with the root under resultWrap.res. S is the DFS frontier (all unvisited siblings on all
    // levels), not the depth — this is what maxStackSize bounds.
    const stack = [ startObject ];
    const stackParent: object[] = [ resultWrap ];
    const stackParentKey: string[] = [ 'res' ];
    // Counts for ech object how many times it has been rewritten
    const stackRewriteCount: number[] = [ 0 ];
    const stackDepth: number[] = [ 0 ];

    function pushArrayOnStack(array: unknown[], rewriteCount: number, depth: number): void {
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
          stackDepth.push(depth + 1);
        }
      }
    }

    // The depth of the children pushed, set before pushing them, so pushChild is created once
    let childDepth = 0;
    const pushChild = (val: object, parent: object, key: string): void => {
      stack.push(val);
      stackParent.push(parent);
      stackParentKey.push(key);
      stackRewriteCount.push(0);
      stackDepth.push(childDepth);
    };
    const pathTraversal: PathTraversalSettings = {
      copy: defaultCopyFlag,
      ignoreKeys: defaultIgnoreKeys,
      shallowKeys: defaultShallowKeys,
      onObjectFound: pushChild,
    };

    const applyResult = (
      mapperResult: PreOrderMappingReturn,
      curParent: Record<string, unknown>,
      curKey: string,
      rewriteCount: number,
      depth: number,
    ): void => {
      const newValue = mapperResult.newValue;

      // The object is mapped, the value takes its place in the tree
      curParent[curKey] = newValue;

      const continues = mapperResult.continue ?? defaultContinues;
      const ignoreKeys = mapperResult.ignoreKeys ?? defaultIgnoreKeys;
      const visitOnlyKeys = mapperResult.visitOnlyKeys ?? defaultVisitOnlyKeys;
      const visitPaths = resolveVisitPaths(mapperResult, defaults);
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
        pushArrayOnStack(newValue, rewriteCount + 1, depth);
        return;
      }
      // If we need to re transform, register the object instead of its children.
      if (reTransform) {
        stack.push(newValue);
        stackParent.push(curParent);
        stackParentKey.push(curKey);
        stackRewriteCount.push(rewriteCount + 1);
        stackDepth.push(depth);
        return;
      }
      const newAsRecord = <Record<string, unknown>> newValue;
      childDepth = depth + 1;
      if (visitPaths) {
        this.findObjectsAtPaths(newAsRecord, visitPathTrieOf(visitPaths), ignoreKeys, shallowKeys, pathTraversal);
        return;
      }
      // In any other case, push the children, ignoring ignoreKeys, keys not in visitOnlyKeys, and shallowKeys.
      // Creating shallow copies of shallowKeys, even when they are ignored.
      for (const key in newAsRecord) {
        if (!Object.hasOwn(newAsRecord, key)) {
          continue;
        }
        const val = newAsRecord[key];
        if (val !== null && typeof val === 'object') {
          if (shallowKeys?.has(key)) {
            newAsRecord[key] = this.cloneObj(val);
          } else if (!isKeyIgnored(key, ignoreKeys, visitOnlyKeys)) {
            pushChild(val, newAsRecord, key);
          }
        }
      }
    };

    // The loop is wrapped so it can return at a suspension point and be called again to resume.
    // Since there is nothing left to unwind, a shortcut simply ends the traversal.
    // Objects still on the stack keep the place they have in the (shallow) copy of their parent.
    const wrappedExecutionLoop = (): unknown => {
      // The didShortCut flag is flipped inside applyResult (a separate closure), which the rule cannot see.
      // eslint-disable-next-line no-unmodified-loop-condition
      while (!didShortCut && stack.length > 0 && stack.length < this.maxStackSize) {
        const curObject = stack.pop()!;
        // Parent is always a raw object (not an array since we handle that differently)
        const curParent = <Record<string, unknown>> stackParent.pop()!;
        const curKey = stackParentKey.pop()!;
        const rewriteCount = stackRewriteCount.pop()!;
        const depth = stackDepth.pop()!;

        if (rewriteCount >= this.maxNodeRewrites) {
          throw new Error(`Pre order transform did not converge: rewrote the same position ${this.maxNodeRewrites} times.`, { cause: curObject });
        }
        if (depth >= this.maxStackSize) {
          throw new Error('Transform object stack overflowed');
        }

        if (Array.isArray(curObject)) {
          const newArr = this.cloneObj(curObject);
          curParent[curKey] = newArr;
          pushArrayOnStack(newArr, rewriteCount, depth);
          continue;
        }

        // Map the object before its descendants, so that the mapper can decide what its descendants are.
        const copy = defaultCopyFlag ? this.cloneObj(curObject) : curObject;
        const mapperResult = preMapper(copy, curObject);
        if (allowAsync && isPromise(mapperResult)) {
          return mapperResult.then((result): unknown => {
            applyResult(result, curParent, curKey, rewriteCount, depth);
            return wrappedExecutionLoop();
          });
        }
        applyResult(<PreOrderMappingReturn>mapperResult, curParent, curKey, rewriteCount, depth);
      }
      if (stack.length >= this.maxStackSize) {
        throw new Error('Transform object stack overflowed');
      }
      return resultWrap.res;
    };

    return wrappedExecutionLoop();
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
  public async visitObjectAsync(
    startObject: object,
    visitor: (orig: object) => Awaitable<void>,
    preVisitor: (orig: object) => Awaitable<VisitContext> = () => ({}),
  ): Promise<void> {
    await this.runVisitObject(startObject, visitor, preVisitor, true);
  }

  protected runVisitObject(
    startObject: object,
    visitor: (orig: object) => Awaitable<void>,
    preVisitor: (orig: object) => Awaitable<VisitContext>,
    allowAsync: boolean,
  ): unknown {
    const defaults = this.defaultContext;
    const defaultContinues = defaults.continue ?? true;
    const defaultIgnoreKeys = defaults.ignoreKeys;
    const defaultVisitOnlyKeys = defaults.visitOnlyKeys;
    const defaultShortcut = defaults.shortcut ?? false;

    let didShortCut = false;

    // Work stack: nodes still to preVisit. Single array, length S.
    // Unlike {@link transformObject} there is no copying, so a parent/key is not tracked - we only visit.
    // Seeded with the root. S is the DFS frontier (all unvisited siblings on all levels),
    // not the depth — this is what maxStackSize bounds.
    const stack = [ startObject ];

    // Visit stack: preVisited, awaiting the actual visitor. Parallel arrays, length M.
    //   handleVisitorOnLen[i] - stack.length snapshotted after popping node i, before pushing its children.
    //     The frontier returning to this value means i's subtree is done, so i can be visited.
    //   visitorStack[i]       - the node to hand to the visitor, undefined for an array since those are not visited
    // M is the current ancestor chain, so M <= nesting depth and is usually far below S.
    // maxStackSize bounds M too, capping depth so a cycle overflows instead of growing without bound.
    const handleVisitorOnLen: number[] = [];
    const visitorStack: (object | undefined)[] = [];

    // Returns a promise only when a visitor suspended - it keeps unwinding itself once that resolves.
    function handleVisitor(): PromiseLike<void> | undefined {
      while (stack.length === handleVisitorOnLen.at(-1)) {
        handleVisitorOnLen.pop();
        const toVisit = visitorStack.pop();
        if (toVisit === undefined) {
          continue;
        }
        const visited = visitor(toVisit);
        if (allowAsync && isPromise(visited)) {
          return visited.then((): PromiseLike<void> | undefined => handleVisitor());
        }
      }
      return undefined;
    }

    const pushChild = (val: object): void => {
      stack.push(val);
    };
    // A visit copies nothing, also not the shallowKeys
    const pathTraversal: PathTraversalSettings = {
      copy: false,
      ignoreKeys: defaultIgnoreKeys,
      shallowKeys: undefined,
      onObjectFound: pushChild,
    };

    // Everything after the preVisitor call - split out so it can also run from inside a resolved promise.
    const expand = (curObject: object, context: VisitContext): void => {
      didShortCut = context.shortcut ?? defaultShortcut;
      const continues = context.continue ?? defaultContinues;
      const ignoreKeys = context.ignoreKeys ?? defaultIgnoreKeys;
      const visitOnlyKeys = context.visitOnlyKeys ?? defaultVisitOnlyKeys;
      const visitPaths = resolveVisitPaths(context, defaults);

      // Register that you want to be visited
      handleVisitorOnLen.push(stack.length);
      visitorStack.push(curObject);

      // Extend stack if needed. When shortcutted, should still unwind the stack, but no longer add to it.
      if (continues && !didShortCut) {
        if (visitPaths) {
          const holder = <Record<string, unknown>> curObject;
          this.findObjectsAtPaths(holder, visitPathTrieOf(visitPaths), ignoreKeys, undefined, pathTraversal);
          return;
        }
        for (const key in curObject) {
          if (!Object.hasOwn(curObject, key)) {
            continue;
          }
          const val = (<Record<string, unknown>> curObject)[key];
          if (val && typeof val === 'object' && !isKeyIgnored(key, ignoreKeys, visitOnlyKeys)) {
            pushChild(val);
          }
        }
      }
    };

    // The loop is wrapped so it can return at a suspension point and be called again to resume.
    const wrappedExecutionLoop = (): unknown => {
      while (stack.length > 0 && stack.length < this.maxStackSize && handleVisitorOnLen.length < this.maxStackSize) {
        const curObject = stack.pop()!;

        if (!didShortCut) {
          if (Array.isArray(curObject)) {
            // Arrays join the ancestor chain, so a cycle of arrays overflows it too.
            handleVisitorOnLen.push(stack.length);
            visitorStack.push(undefined);
            for (let i = curObject.length - 1; i >= 0; i--) {
              const val = <unknown> curObject[i];
              if (val !== null && typeof val === 'object') {
                pushChild(val);
              }
            }
            const pending = handleVisitor();
            if (pending) {
              return pending.then(wrappedExecutionLoop);
            }
            continue;
          }

          // Perform pre visit before expanding the stack
          const context = preVisitor(curObject);
          if (allowAsync && isPromise(context)) {
            return context.then((ctx): unknown => {
              expand(curObject, ctx);
              const pending = handleVisitor();
              return pending ? pending.then(wrappedExecutionLoop) : wrappedExecutionLoop();
            });
          }
          expand(curObject, <VisitContext>context);
        }
        const pending = handleVisitor();
        if (pending) {
          return pending.then(wrappedExecutionLoop);
        }
      }
      if (stack.length >= this.maxStackSize || handleVisitorOnLen.length >= this.maxStackSize) {
        throw new Error('Transform object stack overflowed');
      }
      return undefined;
    };

    return wrappedExecutionLoop();
  }
}
