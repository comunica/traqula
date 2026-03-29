import { TransformerTyped, TransformerSubTyped, TransformerObject } from '@traqula/core';
import { describe, it } from 'vitest';

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
    const proto = { inherited: 'value' };
    const obj = Object.create(proto);
    obj.type = 'test';
    // TransformObject iterates with for...in; non-own properties should be skipped
    const result = <any> transformer.transformObject(obj, copy => ({ ...copy, transformed: true }));
    expect(result.type).toBe('test');
    expect(result.inherited).toBeUndefined();
  });

  it('visitObject skips non-own inherited properties', ({ expect }) => {
    const transformer = new TransformerObject();
    const visited: string[] = [];
    const proto = { inherited: 'value' };
    const obj = Object.create(proto);
    obj.type = 'test';
    obj.child = { type: 'child' };
    // VisitObject uses for...in; inherited props skipped
    transformer.visitObject(obj, (o: any) => visited.push(o.type));
    expect(visited).not.toContain('value');
    expect(visited).toContain('child');
  });
});

describe('transformerTyped additional coverage', () => {
  const transformer = new TransformerTyped<Fruit | Vegetable>();

  it('visitNode visits typed nodes depth-first', ({ expect }) => {
    const visited: string[] = [];
    const tree: Fruit = {
      type: 'fruit',
      name: 'apple',
      inner: { type: 'vegetable', name: 'carrot' },
    };

    transformer.visitNode(tree, {
      fruit: { visitor: f => visited.push(`fruit:${f.name}`) },
      vegetable: { visitor: v => visited.push(`veg:${v.name}`) },
    });

    expect(visited).toEqual([ 'veg:carrot', 'fruit:apple' ]);
  });

  it('transformNode with default context preVisitor', ({ expect }) => {
    const customTransformer = new TransformerTyped<Fruit | Vegetable>({}, {
      fruit: { copy: false },
    });

    const fruit: Fruit = { type: 'fruit', value: 1 };
    const result = <Fruit>customTransformer.transformNode(fruit, {});
    // Default preVisitor sets copy: false, so result should be same object
    expect(result).toBe(fruit);
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
