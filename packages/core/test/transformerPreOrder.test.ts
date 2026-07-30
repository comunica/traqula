import { describe, it } from 'vitest';
import { TransformerObject, TransformerSubTyped, TransformerTyped } from '../lib/index.js';

interface Chain {
  name: string;
  child?: Chain;
}

describe('transformObjectPreOrder', () => {
  const plain = new TransformerObject();

  it('maps an object before its descendants, contrary to transformObject', ({ expect }) => {
    const tree: Chain = { name: 'root', child: { name: 'middle', child: { name: 'leaf' }}};
    const preOrder: string[] = [];
    const postOrder: string[] = [];

    plain.transformObjectPreOrder(tree, (copy) => {
      preOrder.push((<Chain> copy).name);
      return copy;
    });
    plain.transformObject(tree, (copy) => {
      postOrder.push((<Chain> copy).name);
      return copy;
    });

    expect(preOrder).toEqual([ 'root', 'middle', 'leaf' ]);
    expect(postOrder).toEqual([ 'leaf', 'middle', 'root' ]);
  });

  it('iterates into the result of the mapper, not into the object it replaced', ({ expect }) => {
    const tree: Chain = { name: 'root', child: { name: 'replaced', child: { name: 'unreachable' }}};
    const seen: string[] = [];

    const result = <Chain> plain.transformObjectPreOrder(tree, (copy) => {
      const node = <Chain> copy;
      seen.push(node.name);
      return node.name === 'replaced' ? { name: 'replacement', child: { name: 'new-leaf' }} : node;
    });

    expect(seen).toEqual([ 'root', 'replaced', 'new-leaf' ]);
    expect(result.child).toEqual({ name: 'replacement', child: { name: 'new-leaf' }});
  });

  it('copies arrays and maps their object elements', ({ expect }) => {
    const items: (Chain | string | null)[] = [{ name: 'a' }, 'untouched', null, { name: 'b' }];
    const tree = { name: 'root', items };

    const result = <typeof tree> plain.transformObjectPreOrder(tree, copy =>
      ({ ...copy, name: `${(<{ name: string }> copy).name}!` }));

    expect(result.items).not.toBe(items);
    expect(result.items).toEqual([{ name: 'a!' }, 'untouched', null, { name: 'b!' }]);
    expect(items).toEqual([{ name: 'a' }, 'untouched', null, { name: 'b' }]);
  });

  it('hands the mapper a copy of the object, but not of its descendants', ({ expect }) => {
    const tree: Chain = { name: 'root', child: { name: 'child' }};
    let isCopy = false;
    let sharesDescendant = false;

    plain.transformObjectPreOrder(tree, (copy, orig) => {
      if ((<Chain> copy).name === 'root') {
        isCopy = copy !== orig;
        sharesDescendant = (<Chain> copy).child === (<Chain> orig).child;
      }
      return copy;
    });

    expect(isCopy).toBe(true);
    expect(sharesDescendant).toBe(true);
  });

  it('lets the mapper change the own properties of its copy', ({ expect }) => {
    const tree: Chain = { name: 'root', child: { name: 'child' }};

    const result = <Chain> plain.transformObjectPreOrder(tree, (copy) => {
      const node = <Chain> copy;
      node.name = `${node.name}!`;
      return node;
    });

    expect(result).toEqual({ name: 'root!', child: { name: 'child!' }});
    expect(tree).toEqual({ name: 'root', child: { name: 'child' }});
  });

  it('reaches into the input tree when the mapper changes a descendant of its copy', ({ expect }) => {
    const changeDescendant = (copy: object): object => {
      const node = <Chain> copy;
      if (node.name === 'root') {
        node.child!.name = 'changed';
      }
      return node;
    };

    // Pre-order, the descendants of the copy are not copies: changing them is not safe
    const preOrderTree: Chain = { name: 'root', child: { name: 'child' }};
    plain.transformObjectPreOrder(preOrderTree, changeDescendant);
    expect(preOrderTree.child!.name).toBe('changed');

    // Post-order, the descendants are transformed copies already: changing them is safe
    const postOrderTree: Chain = { name: 'root', child: { name: 'child' }};
    plain.transformObject(postOrderTree, changeDescendant);
    expect(postOrderTree.child!.name).toBe('child');
  });

  it('copies a replacement that was taken from the input tree', ({ expect }) => {
    const child: Chain = { name: 'child' };
    const tree: Chain = { name: 'root', child };

    // Replacing an object by its own descendant hands the mapper an object of the input tree
    const result = <Chain> plain.transformObjectPreOrder(
      tree,
      (copy) => {
        const node = <Chain> copy;
        if (node.name === 'root') {
          return node.child!;
        }
        node.name = 'changed';
        return node;
      },
      () => ({ reTransform: true }),
    );

    expect(result.name).toBe('changed');
    expect(child.name).toBe('child');
  });

  it('ends the descent when the mapper returns something that is not an object', ({ expect }) => {
    const tree = { name: 'root', child: { name: 'child', grand: { name: 'grand' }}};
    const visited: string[] = [];
    const replaceChildBy = (replacement: unknown): unknown => plain.transformObjectPreOrder(tree, (copy) => {
      const node = <{ name: string }> copy;
      visited.push(node.name);
      return node.name === 'child' ? replacement : node;
    });

    expect(replaceChildBy('a string')).toEqual({ name: 'root', child: 'a string' });
    expect(replaceChildBy(null)).toEqual({ name: 'root', child: null });
    // The grandchild is never reached, whatever the child was replaced by
    expect(visited).toEqual([ 'root', 'child', 'root', 'child' ]);
  });

  it('iterates into an array the mapper returns', ({ expect }) => {
    const grand: Chain = { name: 'grand' };
    const tree: Chain = { name: 'root', child: { name: 'child', child: grand }};
    const visited: string[] = [];

    // The mapper is not called on the array itself, it is called on the elements of its copy
    const result = <{ child: Chain[] }> plain.transformObjectPreOrder(tree, (copy) => {
      const node = <Chain> copy;
      visited.push(node.name);
      return node.name === 'child' ? [{ ...node, name: 'wrapped' }, { name: 'extra' }] : node;
    });

    expect(visited).toEqual([ 'root', 'child', 'wrapped', 'grand', 'extra' ]);
    expect(result.child.map(node => node.name)).toEqual([ 'wrapped', 'extra' ]);
    // The descendants of the elements are copied, just like those of any other object we iterate into
    expect(result.child[0].child).toEqual(grand);
    expect(result.child[0].child).not.toBe(grand);
  });

  it('maps the result of a rewrite once, unless it asks to be remapped', ({ expect }) => {
    let calls = 0;
    const rewriteAlways = (copy: object): object => {
      calls++;
      return { ...<Chain> copy, name: 'rewritten' };
    };

    // A rule creating a new object on every call would never stabilize, so it is applied once
    plain.transformObjectPreOrder({ name: 'root' }, rewriteAlways);
    expect(calls).toBe(1);
  });

  it('keeps mapping a remapping object until it stabilizes', ({ expect }) => {
    const origs: string[] = [];

    const result = <Chain> plain.transformObjectPreOrder(
      { name: 'a' },
      (copy, orig) => {
        origs.push((<Chain> orig).name);
        const node = <Chain> copy;
        return node.name.length < 3 ? { name: `${node.name}!` } : node;
      },
      () => ({ reTransform: true }),
    );

    expect(result.name).toBe('a!!');
    // Every call but the first is handed the result of the previous rewrite
    expect(origs).toEqual([ 'a', 'a!', 'a!!' ]);
  });

  it('re-evaluates the preVisitor after a rewrite', ({ expect }) => {
    const grandchild = { name: 'grandchild' };
    const tree = { name: 'root', child: { name: 'child', grandchild }};
    const contextsFor: string[] = [];

    // The rewritten object is of a whole other kind, and asks not to be iterated into
    const result = <typeof tree> plain.transformObjectPreOrder(
      tree,
      (copy) => {
        const node = <{ name: string }> copy;
        return node.name === 'child' ? { ...node, name: 'rewritten' } : node;
      },
      (orig) => {
        const node = <{ name: string }> orig;
        contextsFor.push(node.name);
        return node.name === 'rewritten' ? { continue: false } : {};
      },
    );

    expect(contextsFor).toEqual([ 'root', 'child', 'rewritten' ]);
    expect(result.child.grandchild).toBe(grandchild);
  });

  it('does not copy the result of a rewrite when the context asks not to copy', ({ expect }) => {
    const uncopying = new TransformerObject({ copy: false, reTransform: true });
    const replacement: Chain = { name: 'replacement' };

    const result = <Chain> uncopying.transformObjectPreOrder({ name: 'root' }, copy =>
      ((<Chain> copy).name === 'root' ? replacement : copy));

    expect(result).toBe(replacement);
  });

  it('respects continue, shortcut, ignoreKeys and shallowKeys', ({ expect }) => {
    const shared = { name: 'shared', deep: { name: 'deep' }};
    const tree = { name: 'root', a: shared, b: { name: 'b' }};
    const asIs = (copy: object): object => copy;

    const notContinued = <typeof tree> plain.transformObjectPreOrder(tree, asIs, () => ({ continue: false }));
    expect(notContinued.a).toBe(shared);

    const shortcutted = <typeof tree> plain.transformObjectPreOrder(tree, asIs, orig =>
      ((<{ name: string }> orig).name === 'root' ? { shortcut: true } : {}));
    expect(shortcutted.a).toBe(shared);

    const ignored = <typeof tree> plain.transformObjectPreOrder(tree, asIs, () => ({ ignoreKeys: new Set([ 'a' ]) }));
    expect(ignored.a).toBe(shared);
    expect(ignored.b).not.toBe(tree.b);

    const shallow = <typeof tree> plain.transformObjectPreOrder(tree, asIs, () => ({ shallowKeys: new Set([ 'a' ]) }));
    expect(shallow.a).not.toBe(shared);
    expect(shallow.a.deep).toBe(shared.deep);
  });

  it('skips non-own inherited properties', ({ expect }) => {
    const proto = { inherited: { name: 'inherited' }};
    const tree = <Chain & { inherited: Chain }> Object.create(proto);
    tree.name = 'root';
    const seen: string[] = [];

    // TransformObjectPreOrder iterates with for...in; non-own properties should be skipped
    plain.transformObjectPreOrder(tree, (copy) => {
      seen.push((<Chain> copy).name);
      return copy;
    });

    expect(seen).toEqual([ 'root' ]);
  });

  it('throws when the rewrite rules do not converge', ({ expect }) => {
    class ImpatientTransformer extends TransformerObject {
      protected override readonly maxNodeRewrites = 3;
    }
    const impatient = new ImpatientTransformer({ reTransform: true });

    expect(() => impatient.transformObjectPreOrder({ name: 'root' }, copy => ({ ...copy })))
      .toThrow(/Pre order transform did not converge: rewrote the same object 4 times$/u);
    expect(() => impatient.transformObjectPreOrder({ type: 'fruit' }, copy => ({ ...copy })))
      .toThrow(/Pre order transform did not converge: rewrote the same object 4 times \(last type: fruit\)$/u);
  });

  it('throws when the stack overflows', ({ expect }) => {
    class TinyTransformer extends TransformerObject {
      protected override readonly maxStackSize = 1;
    }
    expect(() => new TinyTransformer().transformObjectPreOrder({ a: { b: 'deep' }}, copy => copy))
      .toThrow(/Transform object stack overflowed/u);
  });
});

describe('transformNodePreOrder', () => {
  /**
   * A mark that sinks through pass nodes, counting how deep it got, and stops at a stop node.
   */
  interface Mark {
    type: 'mark';
    depth: number;
    input: Op;
  }
  interface Pass {
    type: 'pass';
    input: Op;
  }
  interface Stop {
    type: 'stop';
    name: string;
  }
  type Op = Mark | Pass | Stop;

  const mark = (depth: number, input: Op): Mark => ({ type: 'mark', depth, input });
  const pass = (input: Op): Pass => ({ type: 'pass', input });
  const stop = (name = 'stop'): Stop => ({ type: 'stop', name });
  const transformer = new TransformerTyped<Op>();

  /**
   * A rule describing a single swap: the mark trades places with the node right below it.
   */
  const sink = (op: Op): Op => transformer.transformNodePreOrder<'unsafe', Op>(op, {
    // Merging two marks results in a mark taking the exact same place, which still has to descend
    mark: { preVisitor: () => ({ reTransform: true }), transform: (copy) => {
      const child = copy.input;
      switch (child.type) {
        case 'pass':
          return pass(mark(copy.depth + 1, child.input));
        case 'mark':
          return mark(copy.depth + child.depth, child.input);
        default:
          return copy;
      }
    } },
  });

  it('sinks a node through multiple levels in a single traversal', ({ expect }) => {
    expect(sink(mark(0, pass(pass(stop()))))).toEqual(pass(pass(mark(2, stop()))));
  });

  it('lets a remapping rewrite descend further', ({ expect }) => {
    // Both marks merge into one, which then sinks through the pass below it
    expect(sink(mark(1, mark(2, pass(stop()))))).toEqual(pass(mark(4, stop())));
  });

  it('stops where the callbacks stop it', ({ expect }) => {
    expect(sink(mark(0, stop()))).toEqual(mark(0, stop()));
  });

  it('takes the same callbacks as transformNode', ({ expect }) => {
    const tree = mark(0, stop());
    const rename = { stop: { transform: (copy: Stop): Stop => ({ ...copy, name: 'reached' }) }};

    expect(transformer.transformNodePreOrder<'unsafe', Op>(tree, rename))
      .toEqual(mark(0, stop('reached')));
    // The mark asked not to be iterated into, so the stop below it is never reached
    expect(transformer.transformNodePreOrder<'unsafe', Op>(tree, {
      ...rename,
      mark: { preVisitor: () => ({ continue: false }) },
    })).toEqual(tree);
  });

  it('reports the type of the node it could not converge on', ({ expect }) => {
    class ImpatientTransformer extends TransformerTyped<Op> {
      protected override readonly maxNodeRewrites = 2;
    }
    expect(() => new ImpatientTransformer().transformNodePreOrder(stop(), {
      stop: { preVisitor: () => ({ reTransform: true }), transform: copy => ({ ...copy }) },
    })).toThrow(/\(last type: stop\)$/u);
  });
});

describe('transformNodeSpecificPreOrder', () => {
  interface Wide {
    type: 'box';
    subType: 'wide';
    label: string;
    inner?: Box;
  }
  interface Tall {
    type: 'box';
    subType: 'tall';
    label: string;
  }
  type Box = Tall | Wide;

  const transformer = new TransformerSubTyped<Box>();
  const tall: Tall = { type: 'box', subType: 'tall', label: 'tall' };

  it('prefers the subType callback and iterates into its result', ({ expect }) => {
    const tree: Wide = { type: 'box', subType: 'wide', label: 'a', inner: tall };
    const labels: string[] = [];

    const result = transformer.transformNodeSpecificPreOrder<'unsafe', Wide>(tree, {
      box: { transform: copy => ({ ...copy, label: 'type' }) },
    }, {
      box: { wide: {
        preVisitor: () => ({ reTransform: true }),
        transform: (copy) => {
          labels.push(copy.label);
          return copy.label === 'a' ? { ...copy, label: 'subType' } : copy;
        },
      }},
    });

    expect(labels).toEqual([ 'a', 'subType' ]);
    expect(result.label).toBe('subType');
  });

  it('falls back to the type callback', ({ expect }) => {
    const result = transformer.transformNodeSpecificPreOrder<'unsafe', Tall>(tall, {
      box: { transform: copy => ({ ...copy, label: 'fallback' }) },
    }, {});

    expect(result.label).toBe('fallback');
  });
});
