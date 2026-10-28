import { AstTransformer, astKnownKeysAllowlist } from '@traqula/rules-sparql-1-2';
import { positiveTest } from '@traqula/test-utils';
import { describe, it, vi } from 'vitest';
import { Parser } from '../lib/index.js';

describe('astKnownKeysAllowlist', () => {
  const unrestricted = new AstTransformer();
  const allowlisted = new AstTransformer({}, astKnownKeysAllowlist);
  // Only visits what the allowlist allows, so the objects without a type are only reached by stepping into them
  const strict = new AstTransformer({ visitChildren: () => {} }, astKnownKeysAllowlist);

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

  for (const suite of <const> [ 'sparql-1-1', 'sparql-1-2', 'paths' ]) {
    it(`visits all nodes of the ${suite} ASTs, also when only visiting what it allows`, async({ expect }) => {
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

  it('validates with the astTransformer of the context', ({ expect }) => {
    const astTransformer = new AstTransformer({}, astKnownKeysAllowlist);
    const visitNodeSpecific = vi.spyOn(astTransformer, 'visitNodeSpecific');
    new Parser({ defaultContext: { astTransformer }}).parse('SELECT * WHERE { ?s ?p _:o }');
    expect(visitNodeSpecific).toHaveBeenCalled();
  });
});
