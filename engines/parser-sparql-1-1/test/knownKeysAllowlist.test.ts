import { AstTransformer, astKnownKeysAllowlist } from '@traqula/rules-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
import { describe, it, vi } from 'vitest';
import { Parser } from '../lib/index.js';

describe('astKnownKeysAllowlist', () => {
  const unrestricted = new AstTransformer();
  const allowlisted = new AstTransformer({}, astKnownKeysAllowlist);
  // Only visits the keys the allowlist allows, so the objects without a type are only reached by stepping into them
  const strict = new AstTransformer({ visitOnlyKeys: new Set() }, astKnownKeysAllowlist);

  // The allowlist visits the children in its own order
  function sameNodes(nodes: object[], expectedNodes: object[]): boolean {
    const expected = new Set(expectedNodes);
    return nodes.length === expectedNodes.length && new Set(nodes).size === nodes.length &&
      nodes.every(node => expected.has(node));
  }

  function visitedNodes(transformer: AstTransformer, ast: object): object[] {
    const visited: object[] = [];
    const visitor = (node: object): void => {
      visited.push(node);
    };
    transformer.visitNode(
      ast,
      Object.fromEntries(Object.keys(astKnownKeysAllowlist).map(type => [ type, { visitor }])),
    );
    return visited;
  }

  for (const suite of <const> [ 'sparql-1-1', 'paths' ]) {
    it(`visits all nodes of the ${suite} ASTs, also when only visiting allowed keys`, async({ expect }) => {
      for (const { name, statics } of positiveTest(suite)) {
        const { astWithSource } = await statics();
        const allNodes = visitedNodes(unrestricted, <object> astWithSource);
        for (const transformer of [ allowlisted, strict ]) {
          const allowedNodes = visitedNodes(transformer, <object> astWithSource);
          expect(sameNodes(allowedNodes, allNodes), name).toBe(true);
        }
      }
    });
  }

  it('does not visit unknown keys of known nodes', ({ expect }) => {
    const extension = { type: 'term', subType: 'variable', value: 'extension' };
    const ast = { ...new Parser().parse('SELECT * WHERE { ?s ?p ?o }'), extension };
    expect(visitedNodes(unrestricted, ast)).toContain(extension);
    expect(visitedNodes(allowlisted, ast)).not.toContain(extension);
  });

  it('does not visit the source locations of nodes, unless given its own visitChildren', ({ expect }) => {
    const ast = new Parser().parse('SELECT * WHERE { ?s ?p ?o }');
    const visitedLocs = (transformer: AstTransformer): number => {
      let locs = 0;
      transformer.visitObject(ast, (object) => {
        locs += 'sourceLocationType' in object ? 1 : 0;
      });
      return locs;
    };
    expect(visitedLocs(new AstTransformer())).toBe(0);
    expect(visitedLocs(new AstTransformer({ ignoreKeys: new Set([ 'other' ]) }))).toBe(0);
    expect(visitedLocs(new AstTransformer({ visitChildren: undefined }))).toBeGreaterThan(0);
  });

  it('visits the VALUES of a variable named loc', ({ expect }) => {
    const ast = new Parser().parse('SELECT * WHERE { VALUES ?loc { <a> } }');
    expect(sameNodes(visitedNodes(unrestricted, ast), visitedNodes(allowlisted, ast))).toBe(true);
    expect(visitedNodes(unrestricted, ast)).toContainEqual(expect.objectContaining({ value: 'a' }));
  });

  it('shallowly copies the source locations it does not visit, when given shallowKeys', ({ expect }) => {
    const ast = new Parser().parse('SELECT * WHERE { ?s ?p ?o }');
    const copy = <typeof ast> new AstTransformer({ shallowKeys: new Set([ 'loc' ]) }).transformNode(ast, {});
    expect(copy.loc).not.toBe(ast.loc);
    expect(copy.loc).toEqual(ast.loc);
  });

  it('validates with the astTransformer of the context', ({ expect }) => {
    const astTransformer = new AstTransformer({}, astKnownKeysAllowlist);
    const visitNodeSpecific = vi.spyOn(astTransformer, 'visitNodeSpecific');
    new Parser({ defaultContext: { astTransformer }}).parse('SELECT * WHERE { ?s ?p _:o }');
    expect(visitNodeSpecific).toHaveBeenCalled();
  });
});
