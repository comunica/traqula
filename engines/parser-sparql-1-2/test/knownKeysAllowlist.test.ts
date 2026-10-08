import { AstTransformer, astKnownKeysAllowlist } from '@traqula/rules-sparql-1-2';
import { positiveTest } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { Parser } from '../lib/index.js';

describe('astKnownKeysAllowlist', () => {
  const unrestricted = new AstTransformer();
  const allowlisted = new AstTransformer({}, astKnownKeysAllowlist);

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
    it(`visits all nodes of the ${suite} ASTs`, async({ expect }) => {
      for (const { name, statics } of positiveTest(suite)) {
        const { astWithSource } = await statics();
        const allNodes = visitedNodes(unrestricted, <object> astWithSource);
        const allowedNodes = visitedNodes(allowlisted, <object> astWithSource);
        expect(allowedNodes.length, name).toBe(allNodes.length);
        expect(allowedNodes.every((node, index) => node === allNodes[index]), name).toBe(true);
      }
    });
  }

  it('does not visit unknown keys of known nodes', ({ expect }) => {
    const extension = { type: 'term', subType: 'variable', value: 'extension' };
    const ast = { ...new Parser().parse('SELECT * WHERE { ?s ?p ?o }'), extension };
    expect(visitedNodes(unrestricted, ast)).toContain(extension);
    expect(visitedNodes(allowlisted, ast)).not.toContain(extension);
  });
});
