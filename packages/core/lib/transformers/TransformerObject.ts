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
   * Only used by {@link TransformerObject.transformObjectDown}.
   * Whether an object of this kind, when it appears as the result of a rewrite, should be transformed again -
   * repeating until the mapper returns the exact object it was given. Default false.
   *
   * Needed by rules rewriting an object into another object taking the exact same place,
   * like the rule merging two nested filters into a single one: without remapping, the merged filter would
   * never be offered the chance to descend any further.
   * Rules of a kind that remaps have to be productive, see {@link TransformerObject.transformObjectDown}.
   */
  remap?: boolean;
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

/**
 * Base transformer class for recursively visiting and transforming object trees.
 * Operates on plain JavaScript objects without requiring specific type structure.
 *
 * Uses an iterative (stack-based) algorithm instead of recursion to handle deep trees safely.
 * {@link transformObject} and {@link visitObject} traverse depth-first, processing
 * deeper objects before their parents (post-order), which lets information travel _up_ the tree.
 * {@link transformObjectDown} traverses the same tree in the opposite direction - transforming an object
 * before its descendants (pre-order) - which lets information travel _down_ the tree.
 *
 * For type-aware traversal based on `type` and `subType` fields,
 * see {@link TransformerTyped} and {@link TransformerSubTyped}.
 */
export class TransformerObject {
  protected maxStackSize = 1_000_000;
  /**
   * The number of times a single object may be rewritten by {@link transformObjectDown} before we
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
    return this.transformObjectDirected(startObject, undefined, mapper, preVisitor);
  }

  /**
   * Recursively transforms all objects that are not arrays, calling the mapper on an object _before_
   * iterating into its descendants, and iterating into the *result* of that mapper.
   *
   * This is the dual of {@link transformObject}, and is what you want when information has to travel
   * _down_ the tree - like a filter that should sink to the deepest operation still binding its variables.
   * Since we iterate into the result of the mapper, a rule only has to describe how an object swaps places
   * with the object right below it: the objects the rule puts lower in the tree are visited in turn,
   * making an object travel as deep as the rules allow within a single traversal.
   *
   * A rewritten object is mapped once, unless its {@link TransformContext.remap} is set,
   * in which case the mapper is re-applied until it returns the exact object it was given
   * (reference equality). Remapping rules have to be productive: a rule that keeps returning new objects
   * throws after {@link maxNodeRewrites} rewrites. Rules that could keep triggering each other
   * (like a rule commuting two objects) should be expressed as a rewrite strictly decreasing the tree size
   * (like a rule merging both objects into one) to guarantee convergence.
   *
   * ## What the mapper may do with what it receives
   *
   * The mapper receives a shallow copy of the visited object, and the object that copy was made from.
   * Since the copy is shallow, and descendants are only transformed _after_ the mapper ran,
   * `copy.someKey === orig.someKey`: the descendants are the objects of the input tree itself.
   * That makes the following safe:
   * - Replacing the object by whatever you like, including a new object reusing descendants of the copy.
   *   Those descendants are copied in turn, as soon as we iterate into them.
   * - Returning a descendant of the copy (unwrapping the object), since the result of a rewrite is
   *   shallowly copied as well.
   * - Changing the own properties of the copy: `copy.input = x` never reaches the input tree.
   *
   * And the following unsafe:
   * - Changing the properties of a descendant: `copy.input.expression = x` writes straight into the
   *   input tree, since `copy.input` is not a copy. Either replace the descendant by a changed copy
   *   ({@link cloneObj}), or leave it to the mapper call that will receive that descendant as its own copy.
   * - Changing anything about the second argument, which is an object of the input tree.
   *
   * This is where {@link transformObject} differs the most: transforming post-order, it hands you an object
   * whose descendants are already transformed copies, making it safe to change those in place.
   *
   * @param startObject object to start iterating from
   * @param mapper mapper to transform the object before iterating into its descendants -
   *   argument is a copy of the original. The returned value takes the objects place,
   *   and is the object we iterate into. Returning something that is not an object, or is an array,
   *   ends the iteration of that branch.
   *   When remapping, the second argument is the result of the previous rewrite:
   *   the object the current copy was made from.
   * @param preVisitor callback that is evaluated before the mapper, and again after each rewrite -
   *   a rewritten object can be of a whole other kind, and thus require a whole other context.
   *   If continues is false, we do not iterate deeper, current object is still mapped. - default: true
   *   If shortcut is true, we do not iterate deeper, nor do we branch out, this mapper will be the last one
   *   called. - Default false
   *   If remap is true, an object that is the result of a rewrite is mapped again. - Default false
   */
  public transformObjectDown(
    startObject: object,
    mapper: (copy: object, orig: object) => unknown,
    preVisitor: (orig: object) => TransformContext = () => ({}),
  ): unknown {
    return this.transformObjectDirected(startObject, mapper, undefined, preVisitor);
  }

  /**
   * Engine shared by {@link transformObject} and {@link transformObjectDown}.
   * Accepting both a downMapper and an upMapper, it is able to transform in both directions
   * within a single traversal.
   * @param startObject object to start iterating from
   * @param downMapper mapper called on an object before iterating into its descendants,
   *   iteration continues into its result. Not called on arrays.
   * @param upMapper mapper called on an object after its descendants have been transformed.
   * @param preVisitor callback that is evaluated before iterating deeper.
   * @protected
   */
  protected transformObjectDirected(
    startObject: object,
    downMapper: ((copy: object, orig: object) => unknown) | undefined,
    upMapper: ((copy: object, orig: object) => unknown) | undefined,
    preVisitor: (orig: object) => TransformContext,
  ): unknown {
    const defaults = this.defaultContext;
    const defaultCopyFlag = defaults.copy ?? true;
    const defaultContinues = defaults.continue ?? true;
    const defaultIgnoreKeys = defaults.ignoreKeys;
    const defaultShallowKeys = defaults.shallowKeys;
    const defaultDidShortCut = defaults.shortcut ?? false;
    const defaultRemap = defaults.remap ?? false;

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
        parent[parentKey] = upMapper!(copyToMap, origToMap);
      }
    }

    /**
     * Register the transformed object with its parent. When there is an upMapper, the object still has to
     * be mapped after its descendants are handled, so we delay the assignment until then.
     */
    function registerResult(result: unknown, orig: object, parent: object, parentKey: string): void {
      if (upMapper) {
        handleMapperOnLen.push(stack.length);
        mapperCopyStack.push(<object> result);
        mapperOrigStack.push(orig);
        mapperParent.push(parent);
        mapperParentKey.push(parentKey);
      } else {
        (<Record<string, unknown>> parent)[parentKey] = result;
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
          registerResult(newArr, curObject, curParent, curKey);

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
        let context = preVisitor(<any>curObject);
        let copyFlag = context.copy ?? defaultCopyFlag;

        let copy: unknown = copyFlag ? this.cloneObj(curObject) : curObject;
        // Whether the (potentially rewritten) object is something we can still iterate into.
        let traversable = true;

        if (downMapper) {
          // Map the object before its descendants, so that the mapper can decide what its descendants are.
          let orig = curObject;
          let rewrites = 0;
          for (;;) {
            const mapped: unknown = downMapper(<object> copy, orig);
            if (mapped === copy) {
              break;
            }
            if (mapped === null || typeof mapped !== 'object' || Array.isArray(mapped)) {
              copy = mapped;
              traversable = false;
              break;
            }
            if (++rewrites > this.maxNodeRewrites) {
              const type = (<Typed> mapped).type;
              throw new Error(`Down transform did not converge: rewrote the same object ${rewrites} times${
                typeof type === 'string' ? ` (last type: ${type})` : ''}`);
            }
            orig = mapped;
            // The replacement can be an object taken straight from the input tree, copy before iterating into it
            copy = copyFlag ? this.cloneObj(mapped) : mapped;
            // The rewritten object can be of a whole other kind, and thus require a whole other context
            context = preVisitor(<any> copy);
            copyFlag = context.copy ?? defaultCopyFlag;
            // Only objects asking to be remapped are mapped again - a rule creating a new object every time
            // would never stabilize otherwise.
            if (!(context.remap ?? defaultRemap)) {
              break;
            }
          }
        }

        const continues = context.continue ?? defaultContinues;
        const ignoreKeys = context.ignoreKeys ?? defaultIgnoreKeys;
        const shallowKeys = context.shallowKeys ?? defaultShallowKeys;
        didShortCut = context.shortcut ?? defaultDidShortCut;

        // Register that you want to be visited
        registerResult(copy, curObject, curParent, curKey);

        // Extend stack if needed. When shortcutted, should still unwind the stack, but no longer add to it.
        if (traversable && continues && !didShortCut) {
          const node = <Record<string, unknown>> copy;
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
      handleMapper();
    }
    if (stack.length >= this.maxStackSize) {
      throw new Error('Transform object stack overflowed');
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
