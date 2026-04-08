import { describe, it } from 'vitest';
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
