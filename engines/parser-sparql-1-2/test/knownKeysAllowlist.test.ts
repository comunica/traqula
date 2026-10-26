import { AstTransformer, astKnownKeysAllowlist } from '@traqula/rules-sparql-1-2';
import { positiveTest } from '@traqula/test-utils';
import { describe, it, vi } from 'vitest';
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

  it('does not visit unknown keys of the objects without a type it steps through', ({ expect }) => {
    const extension = (): object => ({ type: 'term', subType: 'variable', value: 'extension' });
    const update = <any> new Parser().parse('INSERT DATA { <a> <b> <c> } ; CLEAR ALL');
    update.updates[0].extension = extension();
    const query = <any> new Parser().parse('SELECT * FROM <g> WHERE { ?s ?p ?o } ORDER BY ?s LIMIT 1');
    query.solutionModifiers.extension = extension();
    query.solutionModifiers.order.orderDefs[0].extension = extension();
    query.datasets.clauses[0].extension = extension();
    for (const ast of [ update, query ]) {
      const extensions = (transformer: AstTransformer): object[] =>
        visitedNodes(transformer, ast).filter(node => (<{ value?: string }> node).value === 'extension');
      expect(extensions(unrestricted).length).toBeGreaterThan(0);
      expect(extensions(allowlisted)).toEqual([]);
    }
  });

  it('reaches the nodes within objects without a type when only allowed keys are visited', ({ expect }) => {
    const strict = new AstTransformer({ visitOnlyKeys: new Set() }, astKnownKeysAllowlist);
    for (const ast of [
      new Parser().parse('INSERT DATA { <a> <b> <c> } ; CLEAR ALL'),
      new Parser().parse('SELECT * FROM <g> WHERE { VALUES ?s { <a> } } ORDER BY ?s LIMIT 1'),
    ]) {
      expect(visitedNodes(strict, ast).length).toBe(visitedNodes(unrestricted, ast).length);
    }
  });

  it('validates with the astTransformer of the context', ({ expect }) => {
    const astTransformer = new AstTransformer({}, astKnownKeysAllowlist);
    const visitNodeSpecific = vi.spyOn(astTransformer, 'visitNodeSpecific');
    new Parser({ defaultContext: { astTransformer }}).parse('SELECT * WHERE { ?s ?p _:o }');
    expect(visitNodeSpecific).toHaveBeenCalled();
  });
});
