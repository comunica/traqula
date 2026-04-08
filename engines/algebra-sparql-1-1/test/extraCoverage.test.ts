import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { AlgebraFactory, algebraUtils, createAstContext, createAlgebraContext }
  from '@traqula/algebra-transformations-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import { AstFactory } from '@traqula/rules-sparql-1-1';
import { sparqlAlgebraNegativeTests, sparqlAlgebraTests, sparqlQueries } from '@traqula/test-utils';
import { beforeEach, describe, it } from 'vitest';
import { toAst11Builder, toAlgebra11Builder, toAlgebra, toAst } from '../lib/index.js';

describe('algebra-sparql-1-1 extra coverage', () => {
  const AF = new AlgebraFactory();
  const F = new AstFactory();
  const parser = new Parser({ defaultContext: { astFactory: F }});
  const generator = new Generator();

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  function roundTrip(sparql: string): string {
    const ast = parser.parse(sparql);
    const algebra = toAlgebra(ast);
    const backAst = toAst(algebra);
    return generator.generate(F.forcedAutoGenTree(backAst));
  }

  function roundTripQuads(sparql: string): string {
    const ast = parser.parse(sparql);
    const algebra = toAlgebra(ast, { quads: true });
    const backAst = toAst(algebra);
    return generator.generate(F.forcedAutoGenTree(backAst));
  }

  describe('property path: NPS with only inverted predicates', () => {
    it('toAst handles inv(NPS with 2+ IRIs) as path predicate', ({ expect }) => {
      const p1 = AF.dataFactory.namedNode('http://p1');
      const p2 = AF.dataFactory.namedNode('http://p2');
      const s = AF.dataFactory.variable!('s');
      const o = AF.dataFactory.variable!('o');
      const invNps = AF.createInv(AF.createNps([ p1, p2 ]));
      const selectOp = AF.createProject(
        AF.createPath(s, invNps, o),
        [ s, o ],
      );
      const backAst = toAst(<Algebra.Operation> selectOp);
      const result = generator.generate(F.forcedAutoGenTree(backAst));
      expect(result).toBe(`SELECT ?s ?o WHERE {
  ?s (!(^<http://p1>|^<http://p2>)) ?o .
}`);
    });
  });

  describe('group BY with BIND extension', () => {
    it('extend outside GROUP', ({ expect }) => {
      const y = AF.dataFactory.variable!('y');
      const x = AF.dataFactory.variable!('x');
      const pVar = AF.dataFactory.variable!('p');
      const sVar = AF.dataFactory.variable!('s');
      const bgp = AF.createBgp([ AF.createPattern(sVar, pVar, y) ]);
      const group = AF.createGroup(bgp, [ x ], []);
      const extend = AF.createExtend(group, x, AF.createTermExpression(y));
      const project = AF.createProject(extend, [ x ]);
      const backAst = toAst(<Algebra.Operation>project);
      const result = generator.generate(F.forcedAutoGenTree(backAst));
      expect(result).toBe(`SELECT ?x WHERE {
  ?s ?p ?y .
}
GROUP BY ( ?y AS ?x )`);
    });
  });

  describe('insert/DELETE without quads option throws', () => {
    it('toAlgebra throws when INSERT DATA is converted without quads option', ({ expect }) => {
      const ast = parser.parse('INSERT DATA { <http://s> <http://p> <http://o> }');
      expect(() => toAlgebra(ast, { quads: false })).toThrowError(
        /INSERT\/DELETE operations are only supported with quads option enabled/u,
      );
    });
  });

  describe('variable collision in blank-to-variable translation', () => {
    it('generates unique vars when blank node name collides with existing variable', ({ expect }) => {
      const ast = parser.parse('SELECT ?e_b0 WHERE { _:b0 ?p ?e_b0 }');
      const result = toAlgebra(ast, { blankToVariable: true });
      expect(result).toMatchObject({
        input: {
          patterns: [
            {
              graph: {
                termType: 'DefaultGraph',
                value: '',
              },
              object: {
                termType: 'Variable',
                value: 'e_b0',
              },
              predicate: {
                termType: 'Variable',
                value: 'p',
              },
              subject: {
                termType: 'Variable',
                value: 'e_b00',
              },
              termType: 'Quad',
              type: 'pattern',
              value: '',
            },
          ],
          type: 'bgp',
        },
        type: 'project',
      });
    });
  });

  describe('recurseGraph EXTEND handling', () => {
    it('handles GRAPH with BIND that shadows graph variable name', ({ expect }) => {
      // TODO: I actually feel like this is wrong. It relates to our graph issues in Comunica
      const result = roundTrip(
        'SELECT * WHERE { GRAPH ?g { ?s <http://p> ?o BIND(?o AS ?g) } }',
      );
      expect(result).toBe(`SELECT ( ?o AS ?g ) ?o ?s WHERE {
  GRAPH ?g {
    ?s <http://p> ?o .
  }
}`);
    });
  });

  describe('algebraUtils.inScopeVariables with PATH', () => {
    it('extracts variables from PATH operations', ({ expect }) => {
      const ast = parser.parse('SELECT * WHERE { ?s <http://p>* ?o }');
      const algebra = toAlgebra(ast);
      const variables = algebraUtils.inScopeVariables(algebra);
      expect(variables.map(v => v.value)).toMatchObject([ 'o', 's' ]);
    });
  });

  describe('createAlgebraContext with prefixes', () => {
    it('passes prefixes to the algebra context', ({ expect }) => {
      const ast = parser.parse('PREFIX ex: <http://example.org/> SELECT * WHERE { ex:s ex:p ex:o }');
      const result = toAlgebra(ast, { prefixes: { ex: 'http://example.org/' }});
      expect(result).toMatchObject({
        input: { patterns: [{ subject: {
          value: 'http://example.org/s',
        }}]},
      });
    });
  });

  describe('translateTerm with unexpected term type', () => {
    it('throws when given an unrecognised term subType', ({ expect }) => {
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      const fakeTerm = <any>{ type: 'term', subType: 'unexpected_type' };
      expect(() => transformer.translateTerm(c, fakeTerm)).toThrow(/Unexpected term/u);
    });
  });

  describe('generateFreshVar with collision', () => {
    it('skips colliding variable names in generateFreshVar', ({ expect }) => {
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      c.variables.add('var0');
      const freshVar = transformer.generateFreshVar(c);
      expect(freshVar.value).toBe('var1');
    });
  });

  describe('mINUS in GRAPH', () => {
    it('round-trips a GRAPH with MINUS inside using quads mode', ({ expect }) => {
      const result = roundTripQuads(
        'SELECT * WHERE { GRAPH ?g { ?s ?p ?o MINUS { ?s ?p ?o } } }',
      );
      expect(result).toBe(`SELECT ?g ?o ?p ?s WHERE {
  GRAPH ?g {
    ?s ?p ?o .
    MINUS {
      ?s ?p ?o .
    }
  }
}`);
    });
  });

  describe('recurseGraph variable replacement', () => {
    it('replaces variables inside recurseGraph when extend variable matches graph var', ({ expect }) => {
      const algebra = toAlgebra(
        parser.parse('SELECT * WHERE { GRAPH ?g { SELECT ?o WHERE { ?s ?p ?o . BIND(?o AS ?g) } } }'),
        { quads: true },
      );
      expect(algebra).toMatchObject({
        input: { input: { input: { patterns: [{ graph: { value: 'g' }}]}}},
      });
    });
  });

  describe('translateQuad with path predicate', () => {
    it('throws when translateQuad is called with a path predicate', ({ expect }) => {
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      const s = AF.dataFactory.namedNode('http://s');
      const o = AF.dataFactory.namedNode('http://o');
      const fakePath = <any> { type: 'link', iri: AF.dataFactory.namedNode('http://p') };
      c.astFactory = <any>{ isPathPure: () => true };
      expect(() => transformer.translateQuad(c, { subject: s, predicate: fakePath, object: o }))
        .toThrow(/Trying to translate property path to quad/u);
    });
  });

  describe('translateUpdate with unknown operation', () => {
    it('throws when translateUpdate is called with an unknown update type', ({ expect }) => {
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      expect(() => transformer.translateSingleUpdate(c, <any>{ type: 'updateOperation', subType: 'UNKNOWN' }))
        .toThrow(/Unknown update type/u);
    });
  });

  describe('translateAlgAnyExpression with non-OPERATOR expression', () => {
    it('handles wildcard expression via the else branch (FALSE branch of OPERATOR check)', ({ expect }) => {
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const wildcardExpr = AF.createWildcardExpression();
      const result = transformer.translateAnyExpression(c, wildcardExpr);
      expect(result).toMatchObject({ type: 'wildcard' });
    });

    it('handles operator expression via the TRUE branch', ({ expect }) => {
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const x = AF.dataFactory.variable!('x');
      const y = AF.dataFactory.variable!('y');
      const termX = AF.createTermExpression(x);
      const termY = AF.createTermExpression(y);
      const operatorExpr = AF.createOperatorExpression('>', [ termX, termY ]);
      const result = transformer.translateAnyExpression(c, operatorExpr);
      expect(result).toMatchObject({ operator: '>' });
    });
  });

  describe('translateAlgTerm with invalid term type', () => {
    it('throws on an unrecognised term type', ({ expect }) => {
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const fakeTerm = <any>{ termType: 'DefaultGraph', value: '' };
      expect(() => transformer.translateTerm(c, fakeTerm)).toThrow(/invalid term type/u);
    });
  });

  describe('translateAlgPathComponent with unknown path type', () => {
    it('throws on an unrecognised path type', ({ expect }) => {
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const fakePath = <any>{ type: 'UNKNOWN_PATH_TYPE_XYZ' };
      expect(() => transformer.translatePathComponent(c, fakePath)).toThrow(/Unknown Path type/u);
    });
  });

  describe('translateAlgPatternIntoGroup with unknown operation type', () => {
    it('throws on an unrecognised operation type', ({ expect }) => {
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const fakeOp = <any>{ type: 'UNKNOWN_OP_TYPE_XYZ' };
      expect(() => transformer.translatePatternIntoGroup(c, fakeOp)).toThrow(/Unknown Operation type/u);
    });
  });

  describe('translateAlgSinglePattern with PATTERN type', () => {
    it('wraps a PATTERN in a patternBgp', ({ expect }) => {
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const s = AF.dataFactory.namedNode('http://s');
      const p = AF.dataFactory.namedNode('http://p');
      const o = AF.dataFactory.namedNode('http://o');
      const pattern = AF.createPattern(s, p, o);
      const result = transformer.translateSinglePattern(c, pattern);
      expect(result).toMatchObject({ subType: 'bgp', triples: [{}]});
    });
  });

  describe('delete WHERE round-trip', () => {
    it('converts delete-only algebra to deletewhere when patterns contain variables', ({ expect }) => {
      const s = AF.dataFactory.variable!('s');
      const p = AF.dataFactory.namedNode('http://p');
      const o = AF.dataFactory.namedNode('http://o');
      const deletePattern = AF.createPattern(s, p, o, AF.dataFactory.defaultGraph());
      const deleteInsert = AF.createDeleteInsert([ deletePattern ]);
      const result = toAst(<Algebra.Operation>deleteInsert);
      expect(result).toMatchObject({ updates: [{ operation: { subType: 'deletewhere' }}]});
    });
  });

  describe('translateAlgCompositeUpdate with NOP', () => {
    it('covers the NOP true branch in composite update map', ({ expect }) => {
      const nop = AF.createNop();
      const compositeUpdate = AF.createCompositeUpdate([ nop ]);
      const result = toAst(<Algebra.Operation>compositeUpdate);
      expect(result).toMatchObject({ updates: [{ operation: undefined }]});
    });
  });

  describe('convertAlgUpdatePatterns with undefined input', () => {
    it('returns empty array when patterns is falsy', ({ expect }) => {
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const result = transformer.convertUpdatePatterns(c, <any>undefined);
      expect(result).toEqual([]);
    });
  });

  describe('toAst/expression.ts: translatePureExpression default branch', () => {
    it('throws on unknown expression subType', ({ expect }) => {
      // Covers toAst/expression.ts — default throw for unrecognised subType
      const transformer = toAst11Builder.build();
      expect(() => transformer.translatePureExpression(
        createAstContext(),
          <any>{ subType: 'UNKNOWN_XYZ' },
      )).toThrow(/Unknown Expression Operation type/u);
    });
  });

  describe('toAlgebra/path.ts: translatePathPredicate unknown subType', () => {
    it('throws on unknown path subType inside nps item list', ({ expect }) => {
      const transformer = toAlgebra11Builder.build();
      expect(() => transformer.translatePathPredicate(
        createAlgebraContext({}),
          <any>{ subType: '!', items: [ <any>{ subType: 'weird' } ]},
      )).toThrow(/Unexpected item/u);
    });

    it('throws on completely unknown top-level path subType', ({ expect }) => {
      // Covers toAlgebra/path.ts line 106: catch-all throw for unhandled path types
      const transformer = toAlgebra11Builder.build();
      expect(() => transformer.translatePathPredicate(
        createAlgebraContext({}),
          <any>{ subType: 'COMPLETELY_UNKNOWN', items: []},
      )).toThrow(/Unable to translate path expression/u);
    });
  });

  describe('toAlgebra/patterns.ts: throw for unknown expression type', () => {
    it('throws on completely unknown expression type', ({ expect }) => {
      // Covers toAlgebra/patterns.ts line 66: catch-all throw for unhandled expression types
      const transformer = toAlgebra11Builder.build();
      expect(() => transformer.translateExpression(
        createAlgebraContext({}),
          <any>{ type: 'expression', subType: 'COMPLETELY_UNKNOWN_EXPR' },
      )).toThrow(/Unknown expression/u);
    });
  });

  describe('toAlgebra/patterns.ts: throw for unexpected pattern', () => {
    it('throws on unexpected pattern subType', ({ expect }) => {
      // Covers toAlgebra/patterns.ts line 149: catch-all throw for unhandled pattern subTypes
      const transformer = toAlgebra11Builder.build();
      expect(() => transformer.translateGraphPattern(
        createAlgebraContext({}),
          <any>{ type: 'pattern', subType: 'COMPLETELY_UNKNOWN_PATTERN' },
      )).toThrow(/Unexpected pattern/u);
    });
  });

  describe('simplifiedJoin with empty BGP as G', () => {
    it('covers the G=emptyBGP branch: G is replaced by A when G is an empty BGP', ({ expect }) => {
      // This requires G to be an empty BGP AND A to be a non-BGP operation
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      const emptyBgp = AF.createBgp([]);
      const filterExpr = AF.createTermExpression(AF.dataFactory.variable!('x'));
      const innerBgp = AF.createBgp([ AF.createPattern(
        AF.dataFactory.variable!('s'),
        AF.dataFactory.variable!('p'),
        AF.dataFactory.variable!('o'),
      ) ]);
      const filterOp = AF.createFilter(innerBgp, filterExpr);
      // G = emptyBGP, A = FILTER -> G.type === BGP && G.patterns.length === 0 -> G = A
      const result = transformer.simplifiedJoin(c, emptyBgp, filterOp);
      expect(result).toBe(filterOp);
    });
  });

  describe('toAlgebra/tripleAndQuad.ts: throw for nested GRAPH with replacement', () => {
    it('throws when recurseGraph encounters nested GRAPH with replacement set', ({ expect }) => {
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({ quads: true });
      const g = AF.dataFactory.variable!('g');
      const replacement = AF.dataFactory.variable!('__repl__');
      const inner = AF.createBgp([]);
      const graph = AF.createGraph(inner, g);
      expect(() => transformer.recurseGraph(c, graph, g, replacement)).toThrow(/Recursing through nested GRAPH/u);
    });

    it('(nested GRAPH without replacement via direct transformer call)', ({ expect }) => {
      // Normal SPARQL parsing processes inner GRAPHs first, so the outer recurseGraph only sees BGPs.
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({ quads: true });
      const g1 = AF.dataFactory.namedNode('http://g1');
      const g2 = AF.dataFactory.namedNode('http://g2');
      const bgp = AF.createBgp([]);
      // Inner GRAPH wrapping BGP — when recurseGraph receives this with no replacement, hits line 89
      const innerGraph = AF.createGraph(bgp, g2);
      const result = transformer.recurseGraph(c, innerGraph, g1, undefined);
      expect(result).toMatchObject({
        patterns: [],
        type: 'bgp',
      });
    });
  });

  describe('recurseGraph BGP subject/predicate replacement', () => {
    it('replaces subject and predicate equal to graph variable when replacement is set', ({ expect }) => {
      // When the inner subquery PROJECT does not project the graph variable ?g.
      // Must use quads:true since recurseGraph is only called in quads mode.
      const algebra = toAlgebra(
        parser.parse('SELECT * WHERE { GRAPH ?g { SELECT ?o WHERE { ?g ?g ?o . } } }'),
        { quads: true },
      );
      expect(algebra).toMatchObject({ input: { input: { patterns: [{ graph: { value: 'g' }}]}}});
    });
  });

  describe('recurseGraph PATH subject/object replacement', () => {
    it('replaces PATH subject/object equal to graph variable when replacement is set', ({ expect }) => {
      // When the inner subquery PROJECT does not project the graph variable ?g.
      // Must use quads:true since recurseGraph is only called in quads mode.
      const algebra = toAlgebra(
        parser.parse('SELECT * WHERE { GRAPH ?g { SELECT ?o WHERE { ?g (<http://p>/<http://q>) ?g . } } }'),
        { quads: true },
      );
      expect(algebra).toMatchObject({ input: { input: { patterns: [
        { graph: { value: 'g' }},
        { graph: { value: 'g' }},
      ]}}});
    });

    it('directly tests PATH graph replacement: false branch', ({ expect }) => {
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({ quads: true });
      const g = AF.dataFactory.variable!('g');
      const namedGraph = AF.dataFactory.namedNode('http://alreadySetGraph');
      // Create PATH with an already-set named graph (non-DefaultGraph)
      const path = AF.createPath(
        AF.dataFactory.namedNode('http://other'),
        AF.createLink(AF.dataFactory.namedNode('http://p')),
        AF.dataFactory.variable!('o'),
        namedGraph,
      );
      const result = <Algebra.Pattern> transformer.recurseGraph(c, path, g, undefined);
      expect(result.graph).toBe(namedGraph);
    });

    it('directly tests PATH graph replacement: both subject and object replaced', ({ expect }) => {
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({ quads: true });
      const g = AF.dataFactory.variable!('g');
      const replacement = AF.dataFactory.variable!('__replacement__');
      // Test 1: both subject and object = graph variable -> both replaced
      const path1 = AF.createPath(g, AF.createLink(AF.dataFactory.namedNode('http://p')), g);
      const result1 = <Algebra.Pattern> transformer.recurseGraph(c, path1, g, replacement);
      expect(result1.subject).toBe(replacement);
      expect(result1.object).toBe(replacement);

      // Test 2: subject = other, object = graph var -> only object replaced
      const other = AF.dataFactory.namedNode('http://other');
      const path2 = AF.createPath(other, AF.createLink(AF.dataFactory.namedNode('http://p')), g);
      const result2 = <Algebra.Pattern> transformer.recurseGraph(c, path2, g, replacement);
      expect(result2.subject).toBe(other);
      expect(result2.object).toBe(replacement);

      // Test 3: subject = graph var, object = other -> only subject replaced
      const path3 = AF.createPath(g, AF.createLink(AF.dataFactory.namedNode('http://p')), other);
      const result3 = <Algebra.Pattern> transformer.recurseGraph(c, path3, g, replacement);
      expect(result3.subject).toBe(replacement);
      expect(result3.object).toBe(other);
    });
  });
});

describe('algebraGenerators filter', () => {
  it('skips files when filter returns false', ({ expect }) => {
    const tests = [ ...sparqlAlgebraNegativeTests('sparql-1.1-negative', () => false) ];
    expect(tests).toHaveLength(0);
  });

  it('does not skip files when filter returns true (covers NOT-continue path, line 91)', ({ expect }) => {
    // So the continue is NOT executed — the file IS included in the results
    const tests = [ ...sparqlAlgebraNegativeTests('sparql-1.1-negative', () => true) ];
    expect(tests.length).toBeGreaterThan(0);
  });
});

describe('algebraGenerators false branches', () => {
  it('sparqlAlgebraTests with unknown suite returns empty', ({ expect }) => {
    const tests = [ ...sparqlAlgebraTests(<any>'nonexistent-suite-xyz', false, false) ];
    expect(tests).toHaveLength(0);
  });

  it('sparqlQueries with unknown suite returns empty', ({ expect }) => {
    const tests = [ ...sparqlQueries(<any>'nonexistent-suite-xyz') ];
    expect(tests).toHaveLength(0);
  });
});

describe('patterns.ts: simplifiedJoin with empty BGP after non-BGP', () => {
  const F = new AstFactory();
  const parser = new Parser({ defaultContext: { astFactory: F }});

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  it('empty group after MINUS covers simplifiedJoin', ({ expect }) => {
    // For this to trigger, G must be non-BGP (e.g., a Join from MINUS) AND A must be empty BGP.
    // "MINUS { ?x ?y ?z } {}" -> MINUS creates a non-BGP result, then {} creates empty BGP.
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o MINUS { ?x ?y ?z } {} }');
    const algebra = toAlgebra(ast);
    expect(algebra).toMatchObject({ type: 'project', input: {
      type: 'minus',
      input: [{ type: 'bgp' }, { type: 'bgp' }],
    }});
  });
});

describe('queryUnit.ts (toAst): registerGroupBy direct call', () => {
  const AF = new AlgebraFactory();
  const F = new AstFactory();
  const parser = new Parser({ defaultContext: { astFactory: F }});

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  it('directly calls registerGroupBy with extension to cover', ({ expect }) => {
    const transformer = toAst11Builder.build();
    const c = createAstContext();
    const x = AF.dataFactory.variable!('x');
    c.group = [ x ];

    const result: any = {
      type: 'query',
      solutionModifiers: {},
      loc: F.gen(),
      datasets: F.datasetClauses([], F.gen()),
      context: [],
      where: F.patternGroup([], F.gen()),
    };

    // Create a truthy expression to put in extensions for key 'x'
    const yExpr = F.termVariable('y', F.gen());
    const extensions: Record<string, any> = { x: yExpr };

    transformer.registerGroupBy(c, result, extensions);
    expect(result.solutionModifiers.group).toBeDefined();
    expect(result.solutionModifiers.group.groupings[0]).toHaveProperty('variable');
    // The extension is consumed (deleted)
    expect(extensions.x).toBeUndefined();
  });

  it('putExtensionsInGroup with undefined where covers null-coalescing fallback', ({ expect }) => {
    const transformer = toAst11Builder.build();
    const c = createAstContext();
    const result: any = {
      type: 'query',
      solutionModifiers: {},
      loc: F.gen(),
      // Where is intentionally undefined to trigger the ?? fallback
    };
    const yExpr = F.termVariable('y', F.gen());
    const extensions: Record<string, any> = { y: yExpr };
    transformer.putExtensionsInGroup(c, result, extensions);
    expect(result.where).toBeDefined();
    expect(result.where.patterns).toHaveLength(1);
  });

  it('replaceAggregatorVariables with Quad termType covers isSimpleTerm Quad FALSE branch', ({ expect }) => {
    const transformer = toAst11Builder.build();
    const c = createAstContext();
    // Pass a value with termType='Quad' to replaceAggregatorVariables
    const quadLike = { termType: 'Quad', value: 'fake', subject: {}, predicate: {}, object: {}, graph: {}};
    const result = transformer.replaceAggregatorVariables(c, quadLike, {});
    expect(result).toMatchObject(quadLike);
  });

  it('replaceAggregatorVariables with wildcard termType covers isSimpleTerm wildcard FALSE branch', ({ expect }) => {
    const transformer = toAst11Builder.build();
    const c = createAstContext();
    const wildcardLike = { termType: 'wildcard', value: '*' };
    const result = transformer.replaceAggregatorVariables(c, wildcardLike, {});
    expect(result).toMatchObject(wildcardLike);
  });

  it('replaceAggregatorVariables with RDF Variable covers isSimpleTerm TRUE branch', ({ expect }) => {
    // An RDF.Variable has termType='Variable', satisfying isSimpleTerm -> TRUE branch taken
    const transformer = toAst11Builder.build();
    const c = createAstContext();
    // TermType = 'Variable'
    const rdfVar = AF.dataFactory.variable!('x');
    const result = (transformer).replaceAggregatorVariables(c, rdfVar, {});
    expect(result).toMatchObject(rdfVar);
  });

  it('translateAlgProject with DESCRIBE type (DESCRIBE branch) - round-trip', ({ expect }) => {
    // Use parse+toAlgebra+toAst to go through the full code path
    const ast = parser.parse('DESCRIBE <http://example.org/s> WHERE { ?s ?p ?o }');
    const algebra = toAlgebra(ast);
    const backAst = toAst(algebra);
    expect(backAst).toMatchObject(F.forcedAutoGenTree(ast));
  });

  it('translateAlgProject with DESCRIBE type (direct algebra)', ({ expect }) => {
    // Create a DESCRIBE algebra and call toAst on it
    const s = AF.dataFactory.namedNode('http://s');
    const p = AF.dataFactory.namedNode('http://p');
    const o = AF.dataFactory.variable!('o');
    const bgp = AF.createBgp([ AF.createPattern(s, p, o) ]);
    const describe = AF.createDescribe(bgp, [ s ]);
    const result = toAst(<Algebra.Operation>describe);
    expect(result).toBeDefined();
  });
});
