import { describe, it } from 'vitest';
import type { PreOrderMappingReturn, TransformContext } from '../lib/index.js';
import { TransformerTyped, TransformerSubTyped, TransformerObject } from '../lib/index.js';

interface Fruit {
  type: 'fruit';
  [key: string]: any;
}

interface Vegetable {
  type: 'vegetable';
  [key: string]: any;
}

interface SubTypedNode {
  type: 'category';
  subType: 'a' | 'b';
  value: string;
}

describe('transformer', () => {
  const transformer = new TransformerTyped<Fruit | Vegetable>();
  it('makes copies when needed', ({ expect }) => {
    const fruit: Fruit = {
      type: 'fruit',
      clone1: { type: 'vegetable', random: { type: 'fruit', val: 'blep' }},
    };
    const fullCopy = <any> transformer.transformNode(fruit, {});
    expect(fullCopy).not.toBe(fruit);
    expect(fullCopy.clone1).not.toBe(fruit.clone1);
    expect(fullCopy.clone1.random).not.toBe(fruit.clone1.random);

    const sameVegetable = <any> transformer.transformNode(fruit, {
      vegetable: { preVisitor: () => ({ copy: false }) },
      fruit: { transform: (fruit: any) => {
        fruit.test = 'yes';
        return fruit;
      } },
    });
    expect(sameVegetable).not.toBe(fruit);
    expect(sameVegetable.clone1).toBe(fruit.clone1);
    expect(sameVegetable.clone1.random).toMatchObject({ test: 'yes' });
  });

  it('knows shortcut and continue', ({ expect }) => {
    const in2 = { type: 'fruit', val: 'depth3' };
    const in1 = { type: 'vegetable', in: in2, val: 'depth2' };
    const side1 = { type: 'fruit', val: 'side1' };
    const side2 = { type: 'vegetable' };
    const fruit: Fruit = { type: 'fruit', in: in1, val: 'depth1', side: side1, side2 };

    const onlyCopyDepth1 = <any> transformer.transformNode(fruit, {
      fruit: { preVisitor: () => ({ continue: false }) },
    });
    expect(onlyCopyDepth1).not.toBe(fruit);
    expect(onlyCopyDepth1.in).toBe(in1);
    expect(onlyCopyDepth1.in.in).toBe(in2);
    expect(onlyCopyDepth1.side).toBe(side1);

    const doNotCopy = <any> transformer.transformNode(fruit, {
      fruit: { preVisitor: () => ({ continue: false, copy: false }) },
    });
    expect(doNotCopy).toBe(fruit);
    expect(doNotCopy.in).toBe(in1);
    expect(doNotCopy.in.in).toBe(in2);
    expect(doNotCopy.side).toBe(side1);

    const doNotCopyByShortcut = <any> transformer.transformNode(fruit, {
      fruit: { preVisitor: () => ({ shortcut: true }) },
    });
    expect(doNotCopyByShortcut).not.toBe(fruit);
    expect(doNotCopyByShortcut.in).toBe(in1);
    expect(doNotCopyByShortcut.in.in).toBe(in2);
    expect(doNotCopyByShortcut.side).toBe(side1);

    const doNotCopySideWhenShortcut = <any> transformer.transformNode(fruit, {
      vegetable: { preVisitor: () => ({ shortcut: true }) },
    });
    expect(doNotCopySideWhenShortcut).not.toBe(fruit);
    expect(doNotCopySideWhenShortcut.in).toBe(in1);
    expect(doNotCopySideWhenShortcut.in.in).toBe(in2);
    expect(doNotCopySideWhenShortcut.side).toBe(side1);
    expect(doNotCopySideWhenShortcut.side2).not.toBe(side2);
  });

  it('knows shallowKeys and ignoreKeys', ({ expect }) => {
    const in2 = { type: 'fruit', val: 'depth3' };
    const in1 = { type: 'vegetable', in: in2, val: 'depth2' };
    const side1 = { type: 'fruit', val: 'side1' };
    const fruit: Fruit = { type: 'fruit', in: in1, val: 'depth1', side: side1 };

    const noDeepOnShallowKeys = <any> transformer.transformNode(fruit, {
      fruit: { preVisitor: () => ({ shallowKeys: new Set([ 'in' ]) }) },
    });
    expect(noDeepOnShallowKeys).not.toBe(fruit);
    expect(noDeepOnShallowKeys.in).not.toBe(in1);
    expect(noDeepOnShallowKeys.in.in).toBe(in2);
    expect(noDeepOnShallowKeys.side).not.toBe(side1);

    const ignoreKeysAreIgnored = <any> transformer.transformNode(fruit, {
      fruit: { preVisitor: () => ({ ignoreKeys: new Set([ 'in' ]) }) },
    });
    expect(ignoreKeysAreIgnored).not.toBe(fruit);
    expect(ignoreKeysAreIgnored.in).toBe(in1);
    expect(ignoreKeysAreIgnored.in.in).toBe(in2);
    expect(ignoreKeysAreIgnored.side).not.toBe(side1);
  });
});

describe('transformerObject', () => {
  it('cloneObj handles primitives and null', ({ expect }) => {
    const transformer = new TransformerObject();
    expect(transformer.cloneObj(null)).toBe(null);
    expect(transformer.cloneObj(42)).toBe(42);
    expect(transformer.cloneObj('hello')).toBe('hello');
    expect(transformer.cloneObj(true)).toBe(true);
  });

  it('cloneObj clones plain objects', ({ expect }) => {
    const transformer = new TransformerObject();
    const obj = { a: 1, b: 'test' };
    const cloned = transformer.cloneObj(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned).toEqual(obj);
  });

  it('cloneObj preserves prototype for custom objects', ({ expect }) => {
    class Custom {
      public x = 10;
    }
    const transformer = new TransformerObject();
    const obj = new Custom();
    const cloned = transformer.cloneObj(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned).toBeInstanceOf(Custom);
    expect(cloned.x).toBe(10);
  });

  it('visitObject visits all nested objects depth-first', ({ expect }) => {
    const transformer = new TransformerObject();
    const visited: string[] = [];
    const tree = {
      name: 'root',
      children: [
        { name: 'child1', children: [{ name: 'grandchild' }]},
        { name: 'child2' },
      ],
    };

    transformer.visitObject(tree, (obj) => {
      visited.push((<any>obj).name);
    });

    // Depth-first means deepest first
    expect(visited).toEqual([ 'grandchild', 'child1', 'child2', 'root' ]);
  });

  it('visitObject respects ignoreKeys', ({ expect }) => {
    const transformer = new TransformerObject();
    const visited: string[] = [];
    const tree = {
      name: 'root',
      ignored: { name: 'ignored-child' },
      kept: { name: 'kept-child' },
    };

    transformer.visitObject(
      tree,
      (obj) => {
        visited.push((<any>obj).name);
      },
      () => ({ ignoreKeys: new Set([ 'ignored' ]) }),
    );

    expect(visited).toEqual([ 'kept-child', 'root' ]);
  });

  it('visitObject respects shortcut', ({ expect }) => {
    const transformer = new TransformerObject();
    const visited: string[] = [];
    const tree = {
      name: 'root',
      a: { name: 'a', b: { name: 'b' }},
      c: { name: 'c' },
    };

    transformer.visitObject(
      tree,
      (obj) => {
        visited.push((<any>obj).name);
      },
      obj => ((<any>obj).name === 'a' ? { shortcut: true } : {}),
    );

    expect(visited).toEqual([ 'c', 'a', 'root' ]);
  });

  it('clone creates a new transformer with merged context', ({ expect }) => {
    const original = new TransformerObject({ copy: false });
    const cloned = original.clone();

    const obj = { a: { b: 1 }};
    const result = <any>cloned.transformObject(obj, x => x);
    expect(result).toBe(obj);
    expect(result.a).toBe(obj.a);
  });

  it('transformObject skips non-own inherited properties', ({ expect }) => {
    const transformer = new TransformerObject();
    const proto = { inherited: { test: 'test' }};
    const obj = Object.create(proto);
    obj.type = 'test';
    // TransformObject iterates with for...in; non-own properties should be skipped
    const result = <any> transformer.transformObject(obj, copy =>
      Object.assign(Object.create(Object.getPrototypeOf(copy)), copy, { transformed: true }));
    expect(result).toMatchObject({ type: 'test', transformed: true, inherited: { test: 'test' }});
    expect(result.inherited.transformed).toBeUndefined();
  });

  it('visitObject skips non-own inherited properties', ({ expect }) => {
    const transformer = new TransformerObject();
    const visited: string[] = [];
    const proto = { inherited: { type: 'inherited' }};
    const obj = Object.create(proto);
    obj.type = 'test';
    obj.child = { type: 'child' };
    // VisitObject uses for...in; inherited props skipped
    transformer.visitObject(obj, (o: any) => visited.push(o.type));
    expect(visited).not.toContain('inherited');
    expect(visited).toContain('child');
  });
});

describe('transformerSubTyped', () => {
  type Nodes = SubTypedNode | Fruit | Vegetable;
  const transformer = new TransformerSubTyped<Nodes>();

  it('transformNodeSpecific targets subTypes', ({ expect }) => {
    const node: SubTypedNode = { type: 'category', subType: 'a', value: 'original' };

    const result = <SubTypedNode>transformer.transformNodeSpecific(node, {}, {
      category: {
        a: { transform: (copy: any) => ({ ...copy, value: 'transformed-a' }) },
        b: { transform: (copy: any) => ({ ...copy, value: 'transformed-b' }) },
      },
    });

    expect(result.value).toBe('transformed-a');
  });

  it('visitNodeSpecific visits by subType', ({ expect }) => {
    const visited: string[] = [];
    const tree = {
      type: 'category',
      subType: 'a',
      value: 'root',
      child: { type: 'category', subType: 'b', value: 'child' },
    };

    transformer.visitNodeSpecific(tree, {}, {
      category: {
        a: { visitor: (n: any) => visited.push(`a:${n.value}`) },
        b: { visitor: (n: any) => visited.push(`b:${n.value}`) },
      },
    });

    expect(visited).toEqual([ 'b:child', 'a:root' ]);
  });

  it('clone creates new TransformerSubTyped with merged context', ({ expect }) => {
    const original = new TransformerSubTyped<Nodes>({ copy: false });
    const cloned = original.clone({ continue: false });

    expect(cloned).not.toBe(original);
    expect(cloned).toBeInstanceOf(TransformerSubTyped);
  });

  it('takes the per type defaults of the transformer, just like the typed transformer', ({ expect }) => {
    // The defaults are what prunes the search tree, so they have to reach every dispatch on a subType too
    const pruning = new TransformerSubTyped<Nodes>({}, { category: { ignoreKeys: new Set([ 'child' ]) }});
    const tree = {
      type: 'category',
      subType: 'a',
      value: 'root',
      child: { type: 'category', subType: 'b', value: 'child' },
    };
    const transformed: string[] = [];
    const visited: string[] = [];

    pruning.transformNodeSpecific(tree, {}, {
      category: { b: { transform: (copy: any) => {
        transformed.push(copy.value);
        return copy;
      } }},
    });
    pruning.visitNodeSpecific(tree, {}, {
      category: { b: { visitor: (node: any) => visited.push(node.value) }},
    });

    expect(transformed).toEqual([]);
    expect(visited).toEqual([]);
  });
});

describe('transformerTyped clone', () => {
  type FruitOrVeg = { type: 'fruit'; name?: string } | { type: 'vegetable'; name?: string };
  it('clone creates new TransformerTyped with merged context and nodePreVisitor', ({ expect }) => {
    const original = new TransformerTyped<FruitOrVeg>({ copy: true }, { fruit: { copy: false }});
    const cloned = original.clone({ copy: false }, { vegetable: { copy: true }});
    expect(cloned).not.toBe(original);
    expect(cloned).toBeInstanceOf(TransformerTyped);
  });
});

describe('transformerTyped without-type branches', () => {
  const transformer = new TransformerTyped<{ type: 'fruit' }>();

  it('transformNode ignores objects without a type property', ({ expect }) => {
    const obj = { type: 'fruit', child: { noType: true }};
    const result = <any> transformer.transformNode(obj, {});
    expect(result.child).toMatchObject({ noType: true });
  });

  it('visitNode ignores objects without a type property', ({ expect }) => {
    const visited: string[] = [];
    const obj = { type: 'fruit', child: { noType: true }};
    transformer.visitNode(obj, { fruit: { visitor: () => visited.push('fruit') }});
    expect(visited).toContain('fruit');
  });
});

describe('transformerSubTyped without-specific-preVisitor fallback', () => {
  interface Cat {
    type: 'cat';
    subType: 'small' | 'big';
    size: number;
  }
  const transformer = new TransformerSubTyped<Cat>();

  it('visitNodeSpecific falls back to nodeCallBacks preVisitor when specific has no preVisitor', ({ expect }) => {
    const visited: string[] = [];
    const root: Cat = { type: 'cat', subType: 'small', size: 1 };
    transformer.visitNodeSpecific(
      root,
      { cat: { preVisitor: () => ({ continue: false }) }},
      { cat: { big: { visitor: () => visited.push('big') }}},
    );
    expect(visited).toEqual([]);
  });

  it('transformNodeSpecific falls back to nodeCallBacks preVisitor when specific lacks preVisitor', ({ expect }) => {
    const root: Cat = { type: 'cat', subType: 'small', size: 1 };
    const result = <Cat> transformer.transformNodeSpecific(
      root,
      { cat: { preVisitor: () => ({ copy: false }) }},
      {},
    );
    expect(result).toBe(root);
  });

  it('transformNodeSpecific uses specific preVisitor when present', ({ expect }) => {
    const root: Cat = { type: 'cat', subType: 'small', size: 1 };
    const result = <Cat> transformer.transformNodeSpecific(
      root,
      {},
      { cat: { small: { preVisitor: () => ({ copy: false }) }}},
    );
    // PreVisitor returns copy:false so result should be same object
    expect(result).toBe(root);
  });

  it('visitNodeSpecific uses specific preVisitor when present', ({ expect }) => {
    const visited: string[] = [];
    const root: Cat = { type: 'cat', subType: 'small', size: 1 };
    transformer.visitNodeSpecific(
      root,
      {},
      { cat: { small: { preVisitor: () => ({ continue: false }), visitor: () => visited.push('small') }}},
    );
    // PreVisitor stops recursion into children; visitor is still called
    expect(visited.length).toBe(1);
  });
});

describe('transformerObject null/primitive array elements', () => {
  it('transformObject handles array with null/primitive elements', ({ expect }) => {
    const transformer = new TransformerObject();
    const obj = { items: [ null, 1, 'hello', { type: 'leaf' }]};
    const result = transformer.transformObject(obj, x => x);
    expect(result).toMatchObject(obj);
  });

  it('visitObject handles array with null/primitive elements', ({ expect }) => {
    const transformer = new TransformerObject();
    const visited: object[] = [];
    const obj = { items: [ null, 42, 'text', { type: 'leaf' }]};
    transformer.visitObject(obj, o => visited.push(o));
    expect(visited.length).toBeGreaterThan(0);
  });

  it('visitObject handles didShortCut=true with remaining stack items', ({ expect }) => {
    const transformer = new TransformerObject();
    const visited: string[] = [];
    const tree = {
      a: { name: 'a' },
      b: { name: 'b', flag: true },
      c: { name: 'c' },
    };
    transformer.visitObject(
      tree,
      o => visited.push((<any>o).name ?? 'root'),
      o => ((<any>o).flag ? { shortcut: true } : {}),
    );
    expect(visited).toBeDefined();
  });
});

describe('transformerObject stack overflow', () => {
  class TinyTransformer extends TransformerObject {
    protected override readonly maxStackSize = 1;
  }

  it('transformObject throws when stack overflows', ({ expect }) => {
    const tiny = new TinyTransformer();
    const nested = { a: { b: 'deep' }};
    expect(() => tiny.transformObject(nested, x => x)).toThrow(/Transform object stack overflowed/u);
  });

  it('visitObject throws when stack overflows', ({ expect }) => {
    const tiny = new TinyTransformer();
    const nested = { a: { b: 'deep' }};
    expect(() => tiny.visitObject(nested, () => {})).toThrow(/Transform object stack overflowed/u);
  });
});

describe('transformerObject array with null/primitive elements', () => {
  const transformer = new TransformerObject();

  it('transformObject skips null/primitive values in arrays', ({ expect }) => {
    const visited: string[] = [];
    const obj = { arr: [ null, 42, 'hello', { name: 'real' }]};
    transformer.transformObject(obj, (copy) => {
      if ((<any>copy).name) {
        visited.push((<any>copy).name);
      }
      return copy;
    });
    expect(visited).toContain('real');
  });

  it('visitObject skips null/primitive values in arrays', ({ expect }) => {
    const visited: any[] = [];
    const obj = { arr: [ null, 42, 'hello', { name: 'real' }]};
    transformer.visitObject(obj, (item) => {
      visited.push(item);
    });
    const visitedNames = visited.filter((x: any) => x?.name).map((x: any) => x.name);
    expect(visitedNames).toContain('real');
  });

  it('visitObject visits remaining stack items after a shortcut', ({ expect }) => {
    const visited: string[] = [];
    const tree = { a: { name: 'a' }, b: { name: 'b', c: { name: 'c' }}};
    transformer.visitObject(
      tree,
      (obj) => {
        if ((<any>obj).name) {
          visited.push((<any>obj).name);
        }
      },
      obj => ((<any>obj).name === 'b' ? { shortcut: true } : {}),
    );
    // 'b' is shortcutted so 'c' is NOT visited
    expect(visited).not.toContain('c');
    // 'b' itself IS visited
    expect(visited).toContain('b');
  });
});

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

    // The mapper is not called on the array itself, it is called on the elements of that array
    const result = <{ child: Chain[] }> plain.transformObjectPreOrder(tree, (copy) => {
      const node = <Chain> copy;
      visited.push(node.name);
      return { newValue: node.name === 'child' ? [{ ...node, name: 'wrapped' }, { name: 'extra' }] : node };
    });

    expect(visited).toEqual([ 'root', 'child', 'wrapped', 'grand', 'extra' ]);
    expect(result.child.map(node => node.name)).toEqual([ 'wrapped', 'extra' ]);
  });

  it('maps the result of a rewrite once, unless it asks to be remapped', ({ expect }) => {
    let calls = 0;
    const rewriteAlways = (copy: object): PreOrderMappingReturn => {
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

  it('only iterates into the descendants of a remapping object once it stabilized', ({ expect }) => {
    const mapped: string[] = [];

    plain.transformObjectPreOrder({ name: 'a', child: { name: 'child' }}, (copy) => {
      const node = <Chain> copy;
      mapped.push(node.name);
      return node.name === 'a' ? { newValue: { ...node, name: 'stable' }, reTransform: true } : { newValue: node };
    });

    // The child is only reached after the rewrite of its parent settled
    expect(mapped).toEqual([ 'a', 'stable', 'child' ]);
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

  it('respects continue, shortcut, ignoreKeys and shallowKeys', ({ expect }) => {
    const shared = { name: 'shared', deep: { name: 'deep' }};
    const tree = { name: 'root', a: shared, b: { name: 'b' }};
    const asIs = (context: TransformContext) =>
      (copy: object): PreOrderMappingReturn => ({ ...context, newValue: copy });

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

  it('takes the defaults of the transformer when the mapping is silent about them', ({ expect }) => {
    const shared = { name: 'shared', deep: { name: 'deep' }};
    const tree = { name: 'root', a: shared, b: { name: 'b' }, c: { name: 'c' }};
    const asIs = (copy: object): PreOrderMappingReturn => ({ newValue: copy });

    const defaulted = new TransformerObject({ ignoreKeys: new Set([ 'a' ]), shallowKeys: new Set([ 'b' ]) });
    const result = <typeof tree> defaulted.transformObjectPreOrder(tree, asIs);
    expect(result.a).toBe(shared);
    expect(result.b).not.toBe(tree.b);
    expect(result.c).not.toBe(tree.c);

    expect(new TransformerObject({ continue: false }).transformObjectPreOrder(tree, asIs))
      .toMatchObject({ a: shared });
    expect(new TransformerObject({ shortcut: true }).transformObjectPreOrder(tree, asIs))
      .toMatchObject({ a: shared });
  });

  it('does not copy the object it maps when the defaults ask not to copy', ({ expect }) => {
    const uncopying = new TransformerObject({ copy: false });
    const tree: Chain = { name: 'root', child: { name: 'child' }};
    const originals: boolean[] = [];

    const result = <Chain> uncopying.transformObjectPreOrder(tree, (copy, orig) => {
      originals.push(copy === orig);
      return { newValue: copy };
    });

    expect(originals).toEqual([ true, true ]);
    expect(result).toBe(tree);
  });

  it('remaps until it stabilizes when the defaults ask to reTransform', ({ expect }) => {
    const remapping = new TransformerObject({ reTransform: true });

    const result = <Chain> remapping.transformObjectPreOrder({ name: 'a' }, (copy) => {
      const node = <Chain> copy;
      return node.name.length < 3 ?
          { newValue: { name: `${node.name}!` }} :
          { newValue: node, reTransform: false };
    });

    expect(result.name).toBe('a!!');
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
      .toThrow(/Pre order transform did not converge: rewrote the same position 3 times\.$/u);
  });

  it('throws when a rule keeps wrapping its argument in an array', ({ expect }) => {
    class ImpatientTransformer extends TransformerObject {
      protected override readonly maxNodeRewrites = 3;
    }

    // The elements of a returned array are mapped again, so a rule wrapping its argument never stabilizes.
    // The stack does not grow while this happens, so only the hand-back bound catches it.
    expect(() => new ImpatientTransformer().transformObjectPreOrder({ name: 'root' }, copy =>
      ({ newValue: [ copy ]}))).toThrow(/did not converge: rewrote the same position 3 times\.$/u);
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
    const rename = { stop: (copy: Stop): PreOrderMappingReturn => ({ newValue: { ...copy, name: 'reached' }}) };

    expect(transformer.transformNodePreOrder<'unsafe', Op>(tree, rename))
      .toEqual(mark(0, stop('reached')));
    // The mark asked not to be iterated into, so the stop below it is never reached
    expect(transformer.transformNodePreOrder<'unsafe', Op>(tree, {
      ...rename,
      mark: copy => ({ newValue: copy, continue: false }),
    })).toEqual(tree);
  });

  it('takes the per type defaults of the node it maps', ({ expect }) => {
    const guarded = new TransformerTyped<Op>({}, { pass: { continue: false }});
    const visited: string[] = [];
    const visitAll = {
      pass: (copy: Pass): PreOrderMappingReturn => ({ newValue: copy }),
      stop: (copy: Stop): PreOrderMappingReturn => {
        visited.push(copy.name);
        return { newValue: copy };
      },
    };

    // A pass is not iterated into by default, so the stop below it is out of reach
    guarded.transformNodePreOrder<'unsafe', Op>(pass(stop('inner')), visitAll);
    expect(visited).toEqual([]);

    // A callback overrules the default it completes
    guarded.transformNodePreOrder<'unsafe', Op>(pass(stop('inner')), {
      ...visitAll,
      pass: copy => ({ newValue: copy, continue: true }),
    });
    expect(visited).toEqual([ 'inner' ]);
  });

  it('applies the per type defaults to a node it has no callback for', ({ expect }) => {
    const guarded = new TransformerTyped<Op>({}, { pass: { continue: false }});
    const visited: string[] = [];

    guarded.transformNodePreOrder<'unsafe', Op>(pass(stop('inner')), {
      stop: (copy) => {
        visited.push(copy.name);
        return { newValue: copy };
      },
    });

    expect(visited).toEqual([]);
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
    // The tall box below it has no subType callback, so it falls back to the type callback
    expect(result.inner!.label).toBe('type');
  });

  it('only dispatches on objects that have both a type and a subType', ({ expect }) => {
    const typeOnly = { type: 'box', label: 'no subType' };
    const untyped = { label: 'no type' };
    const tree: Wide = { type: 'box', subType: 'wide', label: 'a', inner: <Box> typeOnly };
    const labels: string[] = [];

    const result = transformer.transformNodeSpecificPreOrder<'unsafe', Wide & { untyped: object }>({
      ...tree,
      untyped,
    }, {
      box: (copy) => {
        labels.push(copy.label);
        return { newValue: copy };
      },
    }, {});

    // The nodes without a subType are not dispatched, they are only copied
    expect(labels).toEqual([ 'a' ]);
    expect(result.inner).toEqual(typeOnly);
    expect(result.inner).not.toBe(typeOnly);
    expect(result.untyped).toEqual(untyped);
    expect(result.untyped).not.toBe(untyped);
  });

  it('falls back to the type callback', ({ expect }) => {
    const result = transformer.transformNodeSpecificPreOrder<'unsafe', Tall>(tall, {
      box: copy => ({ newValue: { ...copy, label: 'fallback' }}),
    }, { box: { wide: copy => ({ newValue: copy }) }});

    expect(result.label).toBe('fallback');
  });

  it('takes the per type defaults of the transformer', ({ expect }) => {
    const pruning = new TransformerSubTyped<Box>({}, { box: { ignoreKeys: new Set([ 'inner' ]) }});
    const tree: Wide = { type: 'box', subType: 'wide', label: 'a', inner: tall };
    const labels: string[] = [];

    const result = pruning.transformNodeSpecificPreOrder<'unsafe', Wide>(tree, {
      box: (copy) => {
        labels.push(copy.label);
        return { newValue: copy };
      },
    }, {});

    // The inner box is pruned by the default context of a box
    expect(labels).toEqual([ 'a' ]);
    expect(result.inner).toBe(tall);
  });
});
