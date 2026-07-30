import { describe, it } from 'vitest';
import type { PreOrderMapping, TransformContext } from '../lib/index.js';
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
      return { newValue: copy };
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
      if (node.name === 'replaced') {
        return { newValue: { name: 'replacement', child: { name: 'new-leaf' }}};
      }
      return { newValue: node };
    });

    expect(seen).toEqual([ 'root', 'replaced', 'new-leaf' ]);
    expect(result.child).toEqual({ name: 'replacement', child: { name: 'new-leaf' }});
  });

  it('copies arrays and maps their object elements', ({ expect }) => {
    const items: (Chain | string | null)[] = [{ name: 'a' }, 'untouched', null, { name: 'b' }];
    const tree = { name: 'root', items };

    const result = <typeof tree> plain.transformObjectPreOrder(tree, copy =>
      ({ newValue: { ...copy, name: `${(<{ name: string }> copy).name}!` }}));

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
      return { newValue: copy };
    });

    expect(isCopy).toBe(true);
    expect(sharesDescendant).toBe(true);
  });

  it('lets the mapper change the own properties of its copy', ({ expect }) => {
    const tree: Chain = { name: 'root', child: { name: 'child' }};

    const result = <Chain> plain.transformObjectPreOrder(tree, (copy) => {
      const node = <Chain> copy;
      node.name = `${node.name}!`;
      return { newValue: node };
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
    plain.transformObjectPreOrder(preOrderTree, copy => ({ newValue: changeDescendant(copy) }));
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
    const result = <Chain> plain.transformObjectPreOrder(tree, (copy) => {
      const node = <Chain> copy;
      if (node.name === 'root') {
        return { newValue: node.child!, reTransform: true };
      }
      node.name = 'changed';
      return { newValue: node };
    });

    expect(result.name).toBe('changed');
    expect(child.name).toBe('child');
  });

  it('ends the descent when the mapper returns something that is not an object', ({ expect }) => {
    const tree = { name: 'root', child: { name: 'child', grand: { name: 'grand' }}};
    const visited: string[] = [];
    const replaceChildBy = (replacement: unknown): unknown => plain.transformObjectPreOrder(tree, (copy) => {
      const node = <{ name: string }> copy;
      visited.push(node.name);
      return { newValue: node.name === 'child' ? replacement : node };
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
      return { newValue: node.name === 'child' ? [{ ...node, name: 'wrapped' }, { name: 'extra' }] : node };
    });

    expect(visited).toEqual([ 'root', 'child', 'wrapped', 'grand', 'extra' ]);
    expect(result.child.map(node => node.name)).toEqual([ 'wrapped', 'extra' ]);
    // The descendants of the elements are copied, just like those of any other object we iterate into
    expect(result.child[0].child).toEqual(grand);
    expect(result.child[0].child).not.toBe(grand);
  });

  it('maps the result of a rewrite once, unless it asks to be remapped', ({ expect }) => {
    let calls = 0;
    const rewriteAlways = (copy: object): PreOrderMapping => {
      calls++;
      return { newValue: { ...<Chain> copy, name: 'rewritten' }};
    };

    // A rule creating a new object on every call would never stabilize, so it is applied once
    plain.transformObjectPreOrder({ name: 'root' }, rewriteAlways);
    expect(calls).toBe(1);
  });

  it('keeps mapping a remapping object until it stabilizes', ({ expect }) => {
    const origs: string[] = [];

    const result = <Chain> plain.transformObjectPreOrder({ name: 'a' }, (copy, orig) => {
      origs.push((<Chain> orig).name);
      const node = <Chain> copy;
      return node.name.length < 3 ? { newValue: { name: `${node.name}!` }, reTransform: true } : { newValue: node };
    });

    expect(result.name).toBe('a!!');
    // Every call but the first is handed the result of the previous rewrite
    expect(origs).toEqual([ 'a', 'a!', 'a!!' ]);
  });

  it('takes the context the mapper hands out with its result', ({ expect }) => {
    const grandchild = { name: 'grandchild' };
    const tree = { name: 'root', child: { name: 'child', grandchild }};

    // The mapper describes the object it returns, which is of a whole other kind than the one it mapped
    const result = <typeof tree> plain.transformObjectPreOrder(tree, (copy) => {
      const node = <{ name: string }> copy;
      return node.name === 'child' ?
          { newValue: { ...node, name: 'rewritten' }, continue: false } :
          { newValue: node };
    });

    expect(result.child.name).toBe('rewritten');
    expect(result.child.grandchild).toBe(grandchild);
  });

  it('does not copy the result of a rewrite when the context asks not to copy', ({ expect }) => {
    const uncopying = new TransformerObject({ copy: false, reTransform: true });
    const replacement: Chain = { name: 'replacement' };

    const result = <Chain> uncopying.transformObjectPreOrder({ name: 'root' }, copy =>
      ({ newValue: (<Chain> copy).name === 'root' ? replacement : copy }));

    expect(result).toBe(replacement);
  });

  it('respects continue, shortcut, ignoreKeys and shallowKeys', ({ expect }) => {
    const shared = { name: 'shared', deep: { name: 'deep' }};
    const tree = { name: 'root', a: shared, b: { name: 'b' }};
    const asIs = (context: TransformContext) =>
      (copy: object): PreOrderMapping => ({ ...context, newValue: copy });

    const notContinued = <typeof tree> plain.transformObjectPreOrder(tree, asIs({ continue: false }));
    expect(notContinued.a).toBe(shared);

    const shortcutted = <typeof tree> plain.transformObjectPreOrder(tree, copy =>
      ({ newValue: copy, shortcut: (<{ name: string }> copy).name === 'root' }));
    expect(shortcutted.a).toBe(shared);

    const ignored = <typeof tree> plain.transformObjectPreOrder(tree, asIs({ ignoreKeys: new Set([ 'a' ]) }));
    expect(ignored.a).toBe(shared);
    expect(ignored.b).not.toBe(tree.b);

    const shallow = <typeof tree> plain.transformObjectPreOrder(tree, asIs({ shallowKeys: new Set([ 'a' ]) }));
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
      return { newValue: copy };
    });

    expect(seen).toEqual([ 'root' ]);
  });

  it('throws when the rewrite rules do not converge', ({ expect }) => {
    class ImpatientTransformer extends TransformerObject {
      protected override readonly maxNodeRewrites = 3;
    }
    const impatient = new ImpatientTransformer({ reTransform: true });

    expect(() => impatient.transformObjectPreOrder({ name: 'root' }, copy => ({ newValue: { ...copy }})))
      .toThrow(/Pre order transform did not converge: rewrote the same position 4 times$/u);
    expect(() => impatient.transformObjectPreOrder({ type: 'fruit' }, copy => ({ newValue: { ...copy }})))
      .toThrow(/Pre order transform did not converge: rewrote the same position 4 times \(last type: fruit\)$/u);
  });

  it('throws when a rule keeps wrapping its argument in an array', ({ expect }) => {
    class ImpatientTransformer extends TransformerObject {
      protected override readonly maxNodeRewrites = 3;
    }

    // The elements of a returned array are mapped again, so a rule wrapping its argument never stabilizes.
    // The stack does not grow while this happens, so only the hand-back bound catches it.
    expect(() => new ImpatientTransformer().transformObjectPreOrder({ name: 'root' }, copy =>
      ({ newValue: [ copy ]}))).toThrow(/did not converge: rewrote the same position 4 times$/u);
  });

  it('counts the hand-backs of a position, not those of the whole traversal', ({ expect }) => {
    class ImpatientTransformer extends TransformerObject {
      protected override readonly maxNodeRewrites = 3;
    }
    const impatient = new ImpatientTransformer();
    // Positions that hand back an array we can map nothing of - a rule deleting nodes, say - would let the
    // count of one leak into the next were it kept for the traversal as a whole
    const siblings = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [ `k${index}`, { name: `k${index}` }]),
    );

    const result = impatient.transformObjectPreOrder({ name: 'root', ...siblings }, (copy) => {
      const node = <Chain> copy;
      return { newValue: node.name === 'root' ? node : []};
    });

    expect(result).toEqual({ name: 'root', ...Object.fromEntries(Object.keys(siblings).map(key => [ key, []])) });
  });

  it('lets the elements of a handed back array inherit its count', ({ expect }) => {
    class ImpatientTransformer extends TransformerObject {
      protected override readonly maxNodeRewrites = 3;
    }
    const impatient = new ImpatientTransformer();

    // Alternating between wrapping in an array and remapping never stabilizes either, and neither step
    // settles the position, so the two have to keep counting towards the same bound
    expect(() => impatient.transformObjectPreOrder({ name: 'root' }, (copy) => {
      const node = <Chain> copy;
      return node.name === 'root' ?
          { newValue: [{ ...node, name: 'wrapped' }]} :
          { newValue: { ...node, name: 'root' }, reTransform: true };
    })).toThrow(/did not converge: rewrote the same position 4 times$/u);
  });

  it('shortcuts a mapping that asks to be remapped', ({ expect }) => {
    const mapped: string[] = [];

    const result = <Chain> plain.transformObjectPreOrder({ name: 'a', child: { name: 'child' }}, (copy) => {
      const node = <Chain> copy;
      mapped.push(node.name);
      return { newValue: { ...node, name: `${node.name}!` }, reTransform: true, shortcut: true };
    });

    // The mapping is made, but the shortcut ends the traversal before it is handed back
    expect(mapped).toEqual([ 'a' ]);
    expect(result.name).toBe('a!');
  });

  it('copies a replacement taken from the input tree, even when not iterating into it', ({ expect }) => {
    const inner: Chain = { name: 'inner' };
    const items = [ inner ];
    const tree = { name: 'root', child: { name: 'child', inner, items }};
    const replaceChildBy = (pick: (child: any) => unknown, context: TransformContext): any =>
      plain.transformObjectPreOrder(tree, (copy) => {
        const node = <{ name: string }> copy;
        return node.name === 'child' ? { ...context, newValue: pick(node) } : { newValue: node };
      });

    // Both an object and an array of the input tree end up copied, so the result never aliases the input
    for (const context of <TransformContext[]> [{ continue: false }, { shortcut: true }]) {
      expect(replaceChildBy(child => child.inner, context)).toEqual({ name: 'root', child: inner });
      expect(replaceChildBy(child => child.inner, context).child).not.toBe(inner);
      expect(replaceChildBy(child => child.items, context).child).not.toBe(items);
      expect(replaceChildBy(child => child.items, context).child).toEqual([ inner ]);
    }
  });

  it('throws when the stack overflows', ({ expect }) => {
    class TinyTransformer extends TransformerObject {
      protected override readonly maxStackSize = 1;
    }
    expect(() => new TinyTransformer().transformObjectPreOrder({ a: { b: 'deep' }}, copy => ({ newValue: copy })))
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
    input?: Op;
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
    mark: (copy) => {
      const child = copy.input;
      switch (child.type) {
        case 'pass':
          return { newValue: pass(mark(copy.depth + 1, child.input)) };
        case 'mark':
          // Merging two marks results in a mark taking the exact same place, which still has to descend
          return { newValue: mark(copy.depth + child.depth, child.input), reTransform: true };
        default:
          return { newValue: copy };
      }
    },
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

  it('dispatches on the node type, just like transformNode', ({ expect }) => {
    const tree = mark(0, stop());
    const rename = { stop: (copy: Stop): PreOrderMapping => ({ newValue: { ...copy, name: 'reached' }}) };

    expect(transformer.transformNodePreOrder<'unsafe', Op>(tree, rename))
      .toEqual(mark(0, stop('reached')));
    // The mark asked not to be iterated into, so the stop below it is never reached
    expect(transformer.transformNodePreOrder<'unsafe', Op>(tree, {
      ...rename,
      mark: copy => ({ newValue: copy, continue: false }),
    })).toEqual(tree);
  });

  it('takes the per type defaults of the value the mapper returns', ({ expect }) => {
    const guarded = new TransformerTyped<Op>({}, { stop: { continue: false }});
    const visited: string[] = [];

    // The pass is rewritten into a stop, so it is the default context of a stop that applies
    guarded.transformNodePreOrder<'unsafe', Op>(pass(stop('inner')), {
      pass: copy => ({ newValue: { ...stop('outer'), input: copy.input }, reTransform: true }),
      stop: (copy) => {
        visited.push(copy.name);
        return { newValue: copy };
      },
    });

    expect(visited).toEqual([ 'outer' ]);
  });

  it('only dispatches on objects that have a type', ({ expect }) => {
    const untyped = { name: 'untyped', input: stop('inner') };
    const visited: string[] = [];

    // The untyped root gets no callback, and no per type default either
    const result = transformer.transformNodePreOrder<'unsafe', typeof untyped>(untyped, {
      stop: (copy) => {
        visited.push(copy.name);
        // Neither does the value we replace it by, which is not even an object
        return { newValue: null };
      },
    });

    expect(visited).toEqual([ 'inner' ]);
    expect(result).toEqual({ name: 'untyped', input: null });
  });

  it('reports the type of the node it could not converge on', ({ expect }) => {
    class ImpatientTransformer extends TransformerTyped<Op> {
      protected override readonly maxNodeRewrites = 2;
    }
    expect(() => new ImpatientTransformer().transformNodePreOrder(stop(), {
      stop: copy => ({ newValue: { ...copy }, reTransform: true }),
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
      box: copy => ({ newValue: { ...copy, label: 'type' }}),
    }, {
      box: { wide: (copy) => {
        labels.push(copy.label);
        return copy.label === 'a' ? { newValue: { ...copy, label: 'subType' }, reTransform: true } : { newValue: copy };
      } },
    });

    expect(labels).toEqual([ 'a', 'subType' ]);
    expect(result.label).toBe('subType');
  });

  it('only dispatches on objects that have both a type and a subType', ({ expect }) => {
    const typeOnly = { type: 'box', label: 'no subType' };
    const tree: Wide = { type: 'box', subType: 'wide', label: 'a', inner: <Box> typeOnly };
    const labels: string[] = [];

    const result = transformer.transformNodeSpecificPreOrder<'unsafe', Wide>(tree, {
      box: (copy) => {
        labels.push(copy.label);
        return { newValue: copy };
      },
    }, {});

    // The node without a subType is not dispatched, it is only copied
    expect(labels).toEqual([ 'a' ]);
    expect(result.inner).toEqual(typeOnly);
    expect(result.inner).not.toBe(typeOnly);
  });

  it('falls back to the type callback', ({ expect }) => {
    const result = transformer.transformNodeSpecificPreOrder<'unsafe', Tall>(tall, {
      box: copy => ({ newValue: { ...copy, label: 'fallback' }}),
    }, {});

    expect(result.label).toBe('fallback');
  });
});
