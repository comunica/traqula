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

  it('does not visit source locations, unless given other ignoreKeys', ({ expect }) => {
    // The orderings and binds without a type have source locations too
    const ast = new Parser().parse('SELECT ?g WHERE { ?s ?p ?o } GROUP BY (?s AS ?g) ORDER BY ?g');
    const visitedLocs = (transformer: AstTransformer): number => {
      let locs = 0;
      transformer.visitObject(ast, (object) => {
        locs += 'sourceLocationType' in object ? 1 : 0;
      });
      return locs;
    };
    expect(visitedLocs(new AstTransformer())).toBe(0);
    expect(visitedLocs(new AstTransformer({ ignoreKeys: new Set() }))).toBeGreaterThan(0);
  });

  it('visits the VALUES of a variable named loc', ({ expect }) => {
    const ast = new Parser().parse('SELECT * WHERE { VALUES ?loc { <a> } }');
    expect(sameNodes(visitedNodes(unrestricted, ast), visitedNodes(allowlisted, ast))).toBe(true);
    expect(visitedNodes(unrestricted, ast)).toContainEqual(expect.objectContaining({ value: 'a' }));
  });

  it('does not visit the inherited keys of a pattern', ({ expect }) => {
    const inherited = { type: 'term', subType: 'variable', value: 'inherited' };
    const pattern = Object.assign(Object.create({ inherited }), { type: 'pattern', subType: 'bgp', triples: []});
    expect(visitedNodes(unrestricted, pattern)).toEqual([ pattern ]);
  });

  it('shallowly copies the source locations it does not visit, when given shallowKeys', ({ expect }) => {
    const ast = new Parser().parse('SELECT * WHERE { ?s ?p ?o }');
    const copy = <typeof ast> new AstTransformer({ shallowKeys: new Set([ 'loc' ]) }).transformNode(ast, {});
    expect(copy.loc).not.toBe(ast.loc);
    expect(copy.loc).toEqual(ast.loc);
  });

  it('does not visit unknown keys of the objects without a type it steps into', ({ expect }) => {
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

  it('only applies the ignoreKeys of a node to its own keys, not to those of the objects it steps into', ({
    expect,
  }) => {
    // The rows of VALUES are keyed by variable names, like 'variable'
    const ast = new Parser().parse('SELECT * WHERE { VALUES ?variable { <a> } }');
    const count = (transformer: AstTransformer): number => {
      let visited = 0;
      transformer.visitNode(ast, {
        pattern: { preVisitor: () => ({ ignoreKeys: new Set([ 'variable' ]) }) },
        term: { visitor: () => {
          visited++;
        } },
      });
      return visited;
    };
    expect(count(allowlisted)).toBe(count(unrestricted));
  });

  it('steps into VALUES rows with a variable named type', ({ expect }) => {
    // A row holding a key named 'type' is still stepped into
    const ast = new Parser().parse('SELECT * WHERE { VALUES (?type ?b) { (<a> <c>) } }');
    expect(sameNodes(visitedNodes(strict, ast), visitedNodes(unrestricted, ast))).toBe(true);
  });

  it('validates with the astTransformer of the context', ({ expect }) => {
    const astTransformer = new AstTransformer({}, astKnownKeysAllowlist);
    const visitNodeSpecific = vi.spyOn(astTransformer, 'visitNodeSpecific');
    new Parser({ defaultContext: { astTransformer }}).parse('SELECT * WHERE { ?s ?p _:o }');
    expect(visitNodeSpecific).toHaveBeenCalled();
  });
});
