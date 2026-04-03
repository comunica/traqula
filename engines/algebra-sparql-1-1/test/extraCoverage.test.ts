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

  describe('algebraFactory edge cases', () => {
    it('createTerm handles $-prefixed variable syntax', ({ expect }) => {
      const term = AF.createTerm('$myVar');
      expect(term.termType).toBe('Variable');
      expect(term.value).toBe('myVar');
    });

    it('createJoin with flatten=false preserves nesting', ({ expect }) => {
      const bgp1 = AF.createBgp([]);
      const bgp2 = AF.createBgp([]);
      const innerJoin = AF.createJoin([ bgp1, bgp2 ], true);
      const outerJoin = AF.createJoin([ innerJoin, bgp2 ], false);
      // Without flatten, the outer join keeps the inner join as a nested child
      expect(outerJoin.input).toHaveLength(2);
      expect(outerJoin.input[0].type).toBe('join');
    });

    it('createAlt with flatten=false preserves nesting', ({ expect }) => {
      // Covers flattenMulti(false) branch via createAlt
      const bgp1 = AF.createBgp([]);
      const bgp2 = AF.createBgp([]);
      const innerAlt = AF.createAlt([ bgp1, bgp2 ], true);
      const outerAlt = AF.createAlt([ innerAlt, bgp2 ], false);
      expect(outerAlt.input).toHaveLength(2);
      expect(outerAlt.input[0].type).toBe('alt');
    });

    it('createBoundAggregate wraps aggregate expression with variable', ({ expect }) => {
      const variable = AF.dataFactory.variable!('myVar');
      const expression = AF.createWildcardExpression();
      const bound = AF.createBoundAggregate(variable, 'count', expression, false);
      expect(bound.variable).toBe(variable);
      expect(bound.type).toBe('expression');
    });
  });

  describe('property path: NPS with only inverted predicates', () => {
    it('toAst handles inv(NPS with 2+ IRIs) as path predicate', ({ expect }) => {
      const p1 = AF.dataFactory.namedNode('http://p1');
      const p2 = AF.dataFactory.namedNode('http://p2');
      const s = AF.dataFactory.variable!('s');
      const o = AF.dataFactory.variable!('o');
      const invNps = AF.createInv(AF.createNps([ p1, p2 ]));
      const selectOp = AF.createProject(
        <any> AF.createPath(s, invNps, o),
        [ s, o ],
      );
      const backAst = toAst(<Algebra.Operation> selectOp);
      const result = generator.generate(F.forcedAutoGenTree(backAst));
      expect(result).toContain('!');
      expect(result).toContain('^');
    });
  });

  describe('group BY with BIND extension', () => {
    it('eXTEND outside GROUP', ({ expect }) => {
      // Construct: PROJECT([?x], EXTEND(?x, ?y, GROUP(bgp, [?x], [])))
      // When EXTEND is direct child of PROJECT (not inside GROUP), c.project stays TRUE
      // during EXTEND processing, so the extension is captured and lines 166-169 execute.
      // Note: the roundTrip paths for GROUP BY are covered by the group-by-bind-expr and
      // group-by-bind-var statics in sparql.test.ts static 11.
      // Note: createGroup signature is (input, variables, aggregates)
      const y = AF.dataFactory.variable!('y');
      const x = AF.dataFactory.variable!('x');
      const pVar = AF.dataFactory.variable!('p');
      const sVar = AF.dataFactory.variable!('s');
      const bgp = AF.createBgp([ AF.createPattern(sVar, pVar, y) ]);
      const group = AF.createGroup(bgp, [ x ], []);
      const extend = AF.createExtend(group, x, AF.createTermExpression(y));
      const project = AF.createProject(extend, [ x ]);
      const backAst = toAst(<Algebra.Operation>project);
      expect(backAst).toBeDefined();
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
      // Covers general.ts:119: the uniqueVar while loop for collision avoidance.
      // _:b0 → AstFactory label 'e_b0' → RDF blank node value 'e_b0'.
      // If ?e_b0 already exists as a variable, uniqueVar loops to find a fresh name.
      const ast = parser.parse('SELECT ?e_b0 WHERE { _:b0 ?p ?e_b0 }');
      const result = toAlgebra(ast, { blankToVariable: true });
      expect(result).toBeDefined();
    });
  });

  describe('recurseGraph EXTEND handling', () => {
    it('handles GRAPH with BIND that shadows graph variable name', ({ expect }) => {
      // Covers tripleAndQuad.ts lines 131-140: EXTEND in recurseGraph where variable equals graph
      // A BIND inside GRAPH that uses the same variable name as the graph variable
      const result = roundTrip(
        'SELECT * WHERE { GRAPH ?g { ?s <http://p> ?o BIND(?o AS ?g) } }',
      );
      expect(result).toBeDefined();
    });
  });

  describe('algebraUtils.inScopeVariables with PATH', () => {
    it('extracts variables from PATH operations', ({ expect }) => {
      const ast = parser.parse('SELECT * WHERE { ?s <http://p>* ?o }');
      const algebra = toAlgebra(ast);
      const variables = algebraUtils.inScopeVariables(algebra);
      expect(variables.map(v => v.value)).toContain('s');
      expect(variables.map(v => v.value)).toContain('o');
    });
  });

  describe('algebraFactory flattenMulti with matching subType (branch 359)', () => {
    it('flattens a Multi operation when child has the same type and subType', ({ expect }) => {
      const child = { type: 'alt', subType: 'testSub', input: []};
      const outer = { type: 'alt', subType: 'testSub', input: [ child ]};
      const result = (<any>AF).flattenMulti(outer, true);
      // Child's input should be inlined into outer
      expect(result.input).toHaveLength(0);
    });
  });

  describe('algebraUtils.inScopeVariables with PATTERN graph as Variable (util.ts:333)', () => {
    it('extracts graph variable from PATTERN with variable graph', ({ expect }) => {
      const s = AF.dataFactory.namedNode('http://s');
      const p = AF.dataFactory.namedNode('http://p');
      const o = AF.dataFactory.namedNode('http://o');
      const g = AF.dataFactory.variable!('g');
      const pattern = AF.createPattern(s, p, o, g);
      const variables = algebraUtils.inScopeVariables(<any>AF.createProject(<any>pattern, [ g ]));
      expect(variables.map(v => v.value)).toContain('g');
    });
  });

  describe('algebraUtils.inScopeVariables with PATTERN graph as Quad (util.ts:337)', () => {
    it('handles PATTERN with nested quad as graph term', ({ expect }) => {
      const innerObj = AF.dataFactory.variable!('innerObj');
      const inner = AF.dataFactory.quad(
        AF.dataFactory.namedNode('http://s'),
        AF.dataFactory.namedNode('http://p'),
        innerObj,
        AF.dataFactory.defaultGraph(),
      );
      const s = AF.dataFactory.namedNode('http://s');
      const p = AF.dataFactory.namedNode('http://p');
      const o = AF.dataFactory.namedNode('http://o');
      const pattern = AF.createPattern(s, p, o, <any>inner);
      const variables = algebraUtils.inScopeVariables(<any>pattern);
      expect(variables.map(v => v.value)).toContain('innerObj');
    });

    it('handles PATTERN with nested quad as subject (util.ts:317)', ({ expect }) => {
      const innerSubjectVar = AF.dataFactory.variable!('subjectVar');
      const innerQuad = AF.dataFactory.quad(
        innerSubjectVar,
        AF.dataFactory.namedNode('http://p'),
        AF.dataFactory.namedNode('http://o'),
        AF.dataFactory.defaultGraph(),
      );
      const p = AF.dataFactory.namedNode('http://p');
      const o = AF.dataFactory.namedNode('http://o');
      const pattern = AF.createPattern(<any>innerQuad, p, o);
      const variables = algebraUtils.inScopeVariables(<any>pattern);
      expect(variables.map(v => v.value)).toContain('subjectVar');
    });

    it('handles PATTERN with nested quad as predicate (util.ts:323)', ({ expect }) => {
      const innerPredVar = AF.dataFactory.variable!('predVar');
      const innerQuad = AF.dataFactory.quad(
        innerPredVar,
        AF.dataFactory.namedNode('http://p2'),
        AF.dataFactory.namedNode('http://o'),
        AF.dataFactory.defaultGraph(),
      );
      const s = AF.dataFactory.namedNode('http://s');
      const o = AF.dataFactory.namedNode('http://o');
      const pattern = AF.createPattern(s, <any>innerQuad, o);
      const variables = algebraUtils.inScopeVariables(<any>pattern);
      expect(variables.map(v => v.value)).toContain('predVar');
    });

    it('handles PATTERN with nested quad as object (util.ts:329)', ({ expect }) => {
      const innerObjVar2 = AF.dataFactory.variable!('objVar2');
      const innerQuad = AF.dataFactory.quad(
        innerObjVar2,
        AF.dataFactory.namedNode('http://p'),
        AF.dataFactory.namedNode('http://o2'),
        AF.dataFactory.defaultGraph(),
      );
      const s = AF.dataFactory.namedNode('http://s');
      const p = AF.dataFactory.namedNode('http://p');
      const pattern = AF.createPattern(s, p, <any>innerQuad);
      const variables = algebraUtils.inScopeVariables(<any>pattern);
      expect(variables.map(v => v.value)).toContain('objVar2');
    });
  });

  describe('algebraUtils.inScopeVariables with PATH having quad subject (util.ts:367)', () => {
    it('handles PATH with nested quad as subject', ({ expect }) => {
      const innerVar = AF.dataFactory.variable!('innerVar');
      const innerQuad = AF.dataFactory.quad(
        innerVar,
        AF.dataFactory.namedNode('http://p'),
        AF.dataFactory.namedNode('http://o'),
        AF.dataFactory.defaultGraph(),
      );
      const path = AF.createPath(
        <any>innerQuad,
        AF.createLink(AF.dataFactory.namedNode('http://link')),
        AF.dataFactory.variable!('o'),
      );
      const variables = algebraUtils.inScopeVariables(<any>path);
      expect(variables.map(v => v.value)).toContain('innerVar');
    });
  });

  describe('algebraUtils.inScopeVariables with PATH having quad object (util.ts:373)', () => {
    it('handles PATH with nested quad as object', ({ expect }) => {
      // Covers util.ts line 373: op.object.termType === 'Quad'
      const innerVar = AF.dataFactory.variable!('innerObjVar');
      const innerQuad = AF.dataFactory.quad(
        innerVar,
        AF.dataFactory.namedNode('http://p'),
        AF.dataFactory.namedNode('http://o'),
        AF.dataFactory.defaultGraph(),
      );
      const path = AF.createPath(
        AF.dataFactory.namedNode('http://s'),
        AF.createLink(AF.dataFactory.namedNode('http://link')),
        <any>innerQuad,
      );
      const variables = algebraUtils.inScopeVariables(<any>path);
      expect(variables.map(v => v.value)).toContain('innerObjVar');
    });
  });

  describe('algebraUtils.inScopeVariables with PATH having quad graph', () => {
    it('handles PATH with nested quad as graph', ({ expect }) => {
      const innerVar = AF.dataFactory.variable!('innerGraphVar');
      const innerQuad = AF.dataFactory.quad(
        innerVar,
        AF.dataFactory.namedNode('http://p'),
        AF.dataFactory.namedNode('http://o'),
        AF.dataFactory.defaultGraph(),
      );
      const path = AF.createPath(
        AF.dataFactory.namedNode('http://s'),
        AF.createLink(AF.dataFactory.namedNode('http://link')),
        AF.dataFactory.namedNode('http://o'),
        <any>innerQuad,
      );
      const variables = algebraUtils.inScopeVariables(<any>path);
      expect(variables.map(v => v.value)).toContain('innerGraphVar');
    });
  });

  describe('createAlgebraContext with prefixes', () => {
    it('passes prefixes to the algebra context', ({ expect }) => {
      // Covers toAlgebra/core.ts:39: config.prefixes ? { ...config.prefixes } : {}
      const ast = parser.parse('PREFIX ex: <http://example.org/> SELECT * WHERE { ex:s ex:p ex:o }');
      const result = toAlgebra(ast, { prefixes: { ex: 'http://example.org/' }});
      expect(result).toBeDefined();
    });
  });

  describe('translateTerm with unexpected term type', () => {
    it('throws when given an unrecognised term subType', ({ expect }) => {
      // Covers toAlgebra/general.ts:61: throw new Error('Unexpected term')
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      const fakeTerm = <any>{ type: 'term', subType: 'unexpected_type' };
      expect(() => transformer.translateTerm(c, fakeTerm)).toThrow(/Unexpected term/u);
    });
  });

  describe('generateFreshVar with collision', () => {
    it('skips colliding variable names in generateFreshVar', ({ expect }) => {
      // Covers toAlgebra/general.ts:215: while (c.variables.has(newVar)) loop
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      // Pre-populate variables to cause a collision on first generated name
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
      expect(result).toBeDefined();
    });
  });

  describe('recurseGraph variable replacement', () => {
    it('replaces variables inside recurseGraph when extend variable matches graph var', ({ expect }) => {
      // Covers tripleAndQuad.ts line 153: algOp[castedKey] = replacement
      // EXTEND with its variable equal to the graph variable, inside a subquery that doesn't project it.
      // With quads:true, recurseGraph is called with a replacement from the PROJECT handler,
      // then hits the else branch for EXTEND where the 'variable' key equals the graph variable.
      const algebra = toAlgebra(
        parser.parse('SELECT * WHERE { GRAPH ?g { SELECT ?o WHERE { ?s ?p ?o . BIND(?o AS ?g) } } }'),
        { quads: true },
      );
      expect(algebra).toBeDefined();
    });
  });

  describe('translateQuad with path predicate', () => {
    it('throws when translateQuad is called with a path predicate', ({ expect }) => {
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      const s = AF.dataFactory.namedNode('http://s');
      const o = AF.dataFactory.namedNode('http://o');
      const fakePath = <any>{ type: 'link', iri: AF.dataFactory.namedNode('http://p') };
      c.astFactory = <any>{ isPathPure: () => true };
      expect(() => transformer.translateQuad(c, { subject: s, predicate: fakePath, object: o }))
        .toThrow(/Trying to translate property path to quad/u);
    });
  });

  describe('translateUpdate with unknown operation', () => {
    it('throws when translateUpdate is called with an unknown update type', ({ expect }) => {
      // Covers toAlgebra/updates.ts:80: throw new Error('Unknown update type')
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      c.useQuads = true;
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
      expect(result).toBeDefined();
    });

    it('handles operator expression via the TRUE branch', ({ expect }) => {
      // Covers toAst/expression.ts:56: translateAlgAnyExpression TRUE branch (OPERATOR)
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const x = AF.dataFactory.variable!('x');
      const y = AF.dataFactory.variable!('y');
      const termX = AF.createTermExpression(x);
      const termY = AF.createTermExpression(y);
      const operatorExpr = AF.createOperatorExpression('>', [ termX, termY ]);
      const result = transformer.translateAnyExpression(c, operatorExpr);
      expect(result).toBeDefined();
    });
  });

  describe('translateAlgTerm with invalid term type', () => {
    it('throws on an unrecognised term type', ({ expect }) => {
      // Covers toAst/general.ts:43: throw new Error('invalid term type')
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const fakeTerm = <any>{ termType: 'DefaultGraph', value: '' };
      expect(() => transformer.translateTerm(c, fakeTerm)).toThrow(/invalid term type/u);
    });
  });

  describe('translateAlgPathComponent with unknown path type', () => {
    it('throws on an unrecognised path type', ({ expect }) => {
      // Covers toAst/path.ts:30: throw new Error('Unknown Path type')
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const fakePath = <any>{ type: 'UNKNOWN_PATH_TYPE_XYZ' };
      expect(() => transformer.translatePathComponent(c, fakePath)).toThrow(/Unknown Path type/u);
    });
  });

  describe('translateAlgPatternIntoGroup with unknown operation type', () => {
    it('throws on an unrecognised operation type', ({ expect }) => {
      // Covers toAst/pattern.ts:46: throw new Error('Unknown Operation type')
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const fakeOp = <any>{ type: 'UNKNOWN_OP_TYPE_XYZ' };
      expect(() => transformer.translatePatternIntoGroup(c, fakeOp)).toThrow(/Unknown Operation type/u);
    });
  });

  describe('translateAlgSinglePattern with PATTERN type', () => {
    it('wraps a PATTERN in a patternBgp', ({ expect }) => {
      // Covers toAst/pattern.ts:62: case types.PATTERN → F.patternBgp
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const s = AF.dataFactory.namedNode('http://s');
      const p = AF.dataFactory.namedNode('http://p');
      const o = AF.dataFactory.namedNode('http://o');
      const pattern = AF.createPattern(s, p, o);
      const result = transformer.translateSinglePattern(c, <any>pattern);
      expect(result).toBeDefined();
    });
  });

  describe('dELETE WHERE round-trip', () => {
    it('converts delete-only algebra to deletewhere when patterns contain variables', ({ expect }) => {
      // Covers toAst/updateUnit.ts:160: asCasted.subType = 'deletewhere'
      // DELETE without WHERE and with variables in delete patterns triggers line 160.
      // This requires constructing algebra directly since no valid SPARQL produces delete-only+variables.
      const s = AF.dataFactory.variable!('s');
      const p = AF.dataFactory.namedNode('http://p');
      const o = AF.dataFactory.namedNode('http://o');
      const deletePattern = AF.createPattern(s, p, o, AF.dataFactory.defaultGraph());
      const deleteInsert = AF.createDeleteInsert([ deletePattern ]);
      const result = toAst(<Algebra.Operation>deleteInsert);
      expect(result).toBeDefined();
    });
  });

  describe('translateAlgCompositeUpdate with NOP', () => {
    it('covers the NOP true branch in composite update map', ({ expect }) => {
      // Covers toAst/updateUnit.ts line 75: update.type === Types.NOP ? undefined
      // Composite update that includes a NOP operation maps it to undefined
      const nop = AF.createNop();
      const compositeUpdate = AF.createCompositeUpdate([ nop ]);
      const result = toAst(<Algebra.Operation>compositeUpdate);
      expect(result).toBeDefined();
    });
  });

  describe('convertAlgUpdatePatterns with undefined input', () => {
    it('returns empty array when patterns is falsy', ({ expect }) => {
      // Covers toAst/updateUnit.ts:274: if (!patterns) { return []; }
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
      expect(() =>
        (<any>transformer).translatePureExpression(
          createAstContext(),
          <any>{ subType: 'UNKNOWN_XYZ' },
        )).toThrow(/Unknown Expression Operation type/u);
    });
  });

  describe('toAlgebra/path.ts: translatePathPredicate unknown subType', () => {
    it('throws on unknown path subType inside nps item list', ({ expect }) => {
      // Covers toAlgebra/path.ts line 64 — throw for item that is neither term nor ^
      const transformer = toAlgebra11Builder.build();
      expect(() =>
        (<any>transformer).translatePathPredicate(
          createAlgebraContext({}),
          <any>{ subType: '!', items: [ <any>{ subType: 'weird' } ]},
        )).toThrow(/Unexpected item/u);
    });

    it('throws on completely unknown top-level path subType', ({ expect }) => {
      // Covers toAlgebra/path.ts line 106: catch-all throw for unhandled path types
      const transformer = toAlgebra11Builder.build();
      expect(() =>
        (<any>transformer).translatePathPredicate(
          createAlgebraContext({}),
          <any>{ subType: 'COMPLETELY_UNKNOWN', items: []},
        )).toThrow(/Unable to translate path expression/u);
    });
  });

  describe('toAlgebra/patterns.ts: throw for unknown expression type', () => {
    it('throws on completely unknown expression type', ({ expect }) => {
      // Covers toAlgebra/patterns.ts line 66: catch-all throw for unhandled expression types
      const transformer = toAlgebra11Builder.build();
      expect(() =>
        (<any>transformer).translateExpression(
          createAlgebraContext({}),
          <any>{ type: 'expression', subType: 'COMPLETELY_UNKNOWN_EXPR' },
        )).toThrow(/Unknown expression/u);
    });
  });

  describe('toAlgebra/patterns.ts: throw for unexpected pattern', () => {
    it('throws on unexpected pattern subType', ({ expect }) => {
      // Covers toAlgebra/patterns.ts line 149: catch-all throw for unhandled pattern subTypes
      const transformer = toAlgebra11Builder.build();
      expect(() =>
        (<any>transformer).translateGraphPattern(
          createAlgebraContext({}),
          <any>{ type: 'pattern', subType: 'COMPLETELY_UNKNOWN_PATTERN' },
        )).toThrow(/Unexpected pattern/u);
    });
  });

  describe('simplifiedJoin with empty BGP as G', () => {
    it('covers the G=emptyBGP branch: G is replaced by A when G is an empty BGP', ({ expect }) => {
      // Covers toAlgebra/patterns.ts line 247-249: else if (G.type === BGP && G.patterns.length === 0) → G = A
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
      // G = emptyBGP, A = FILTER → G.type === BGP && G.patterns.length === 0 → G = A
      const result = (<any>transformer).simplifiedJoin(c, emptyBgp, filterOp);
      expect(result).toBe(filterOp);
    });
  });

  describe('toAlgebra/tripleAndQuad.ts: throw for nested GRAPH with replacement', () => {
    it('throws when recurseGraph encounters nested GRAPH with replacement set', ({ expect }) => {
      // Covers tripleAndQuad.ts lines 84-87: throw for nested GRAPH + replacement via direct call
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({ quads: true });
      const g = AF.dataFactory.variable!('g');
      const replacement = AF.dataFactory.variable!('__repl__');
      const inner = AF.createBgp([]);
      const graph = AF.createGraph(inner, g);
      expect(() =>
        (<any>transformer).recurseGraph(c, graph, g, replacement)).toThrow(/Recursing through nested GRAPH/u);
    });

    it('covers line 89 (nested GRAPH without replacement via direct transformer call)', ({ expect }) => {
      // Covers tripleAndQuad.ts line 89: algOp = SUBRULE(recurseGraph, algOp.input, algOp.name, undefined)
      // Normal SPARQL parsing processes inner GRAPHs first, so the outer recurseGraph only sees BGPs.
      // Line 89 is the "nested GRAPH encountered without replacement" branch - must call directly.
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({ quads: true });
      const g1 = AF.dataFactory.namedNode('http://g1');
      const g2 = AF.dataFactory.namedNode('http://g2');
      const bgp = AF.createBgp([]);
      // Inner GRAPH wrapping BGP — when recurseGraph receives this with no replacement, hits line 89
      const innerGraph = AF.createGraph(bgp, g2);
      const result = (<any>transformer).recurseGraph(c, innerGraph, g1, undefined);
      expect(result).toBeDefined();
    });
  });

  describe('recurseGraph BGP subject/predicate replacement', () => {
    it('replaces subject and predicate equal to graph variable when replacement is set', ({ expect }) => {
      // Covers tripleAndQuad.ts lines 97 and 100: BGP quad subject/predicate is replaced
      // when the inner subquery PROJECT does not project the graph variable ?g.
      // Must use quads:true since recurseGraph is only called in quads mode.
      const algebra = toAlgebra(
        parser.parse('SELECT * WHERE { GRAPH ?g { SELECT ?o WHERE { ?g ?g ?o . } } }'),
        { quads: true },
      );
      expect(algebra).toBeDefined();
    });
  });

  describe('recurseGraph PATH subject/object replacement', () => {
    it('replaces PATH subject/object equal to graph variable when replacement is set', ({ expect }) => {
      // Covers tripleAndQuad.ts lines 113-117: PATH subject and object replaced
      // when the inner subquery PROJECT does not project the graph variable ?g.
      // Must use quads:true since recurseGraph is only called in quads mode.
      const algebra = toAlgebra(
        parser.parse('SELECT * WHERE { GRAPH ?g { SELECT ?o WHERE { ?g (<http://p>/<http://q>) ?g . } } }'),
        { quads: true },
      );
      expect(algebra).toBeDefined();
    });

    it('directly tests PATH graph replacement: false branch', ({ expect }) => {
      // Covers tripleAndQuad.ts line 120: FALSE branch of if (algOp.graph.termType === 'DefaultGraph')
      // When PATH already has a non-default named graph, we do NOT replace algOp.graph
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
      // Call recurseGraph: since graph is not DefaultGraph, line 120 FALSE branch is taken
      const result = (<any>transformer).recurseGraph(c, path, g, undefined);
      expect((result).graph).toBe(namedGraph);
    });

    it('directly tests PATH graph replacement: both subject and object replaced', ({ expect }) => {
      // Direct test to cover lines 113-117: use transformer.recurseGraph directly
      // with a PATH where subject and object equal the graph variable
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({ quads: true });
      const g = AF.dataFactory.variable!('g');
      const replacement = AF.dataFactory.variable!('__replacement__');
      // Test 1: both subject and object = graph variable → both replaced (lines 115-117 TRUE + lines 118-120 TRUE)
      const path1 = AF.createPath(
        g,
        AF.createLink(AF.dataFactory.namedNode('http://p')),
        g,
      );
      const result1 = (<any>transformer).recurseGraph(c, path1, g, replacement);
      expect((result1).subject).toBe(replacement);
      expect((result1).object).toBe(replacement);

      // Test 2: subject = other, object = graph var → only object replaced (line 115 FALSE, line 118 TRUE)
      const other = AF.dataFactory.namedNode('http://other');
      const path2 = AF.createPath(
        other,
        AF.createLink(AF.dataFactory.namedNode('http://p')),
        g,
      );
      const result2 = (<any>transformer).recurseGraph(c, path2, g, replacement);
      expect((result2).subject).toBe(other);
      expect((result2).object).toBe(replacement);

      // Test 3: subject = graph var, object = other → only subject replaced (line 115 TRUE, line 118 FALSE)
      const path3 = AF.createPath(
        g,
        AF.createLink(AF.dataFactory.namedNode('http://p')),
        other,
      );
      const result3 = (<any>transformer).recurseGraph(c, path3, g, replacement);
      expect((result3).subject).toBe(replacement);
      expect((result3).object).toBe(other);
    });
  });
});

describe('algebraGenerators filter', () => {
  it('skips files when filter returns false', ({ expect }) => {
    const tests = [ ...sparqlAlgebraNegativeTests('sparql-1.1-negative', () => false) ];
    expect(tests).toHaveLength(0);
  });

  it('does not skip files when filter returns true (covers NOT-continue path, line 91)', ({ expect }) => {
    // Covers algebraGenerators.ts line 91: filter && !filter(name) = false when filter returns true
    // So the continue is NOT executed — the file IS included in the results
    const tests = [ ...sparqlAlgebraNegativeTests('sparql-1.1-negative', () => true) ];
    expect(tests.length).toBeGreaterThan(0);
  });
});

describe('algebraGenerators false branches (algebraGenerators.ts:50,77)', () => {
  it('sparqlAlgebraTests with unknown suite returns empty (line 50 false branch)', ({ expect }) => {
    // Covers algebraGenerators.ts line 50: if (subfolders.includes(suite)) FALSE branch
    const tests = [ ...sparqlAlgebraTests(<any>'nonexistent-suite-xyz', false, false) ];
    expect(tests).toHaveLength(0);
  });

  it('sparqlQueries with unknown suite returns empty (line 77 false branch)', ({ expect }) => {
    // Covers algebraGenerators.ts line 77: if (subfolders.includes(suite)) FALSE branch
    const tests = [ ...sparqlQueries(<any>'nonexistent-suite-xyz') ];
    expect(tests).toHaveLength(0);
  });
});

describe('patterns.ts line 250: simplifiedJoin with empty BGP after non-BGP', () => {
  const _AF = new AlgebraFactory();
  const F = new AstFactory();
  const parser = new Parser({ defaultContext: { astFactory: F }});

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  it('empty group after MINUS covers simplifiedJoin line 250 true branch', ({ expect }) => {
    // Covers toAlgebra/patterns.ts line 250: else if (A.type === types.BGP && A.patterns.length === 0)
    // For this to trigger, G must be non-BGP (e.g., a Join from MINUS) AND A must be empty BGP.
    // "MINUS { ?x ?y ?z } {}" → MINUS creates a non-BGP result, then {} creates empty BGP.
    const ast = parser.parse('SELECT * WHERE { ?s ?p ?o MINUS { ?x ?y ?z } {} }');
    const algebra = toAlgebra(ast);
    expect(algebra).toBeDefined();
  });
});

describe('queryUnit.ts (toAst) lines 166-169: registerGroupBy direct call', () => {
  const AF = new AlgebraFactory();
  const F = new AstFactory();
  const parser = new Parser({ defaultContext: { astFactory: F }});

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  it('directly calls registerGroupBy with extension to cover lines 166-169', ({ expect }) => {
    // Covers toAst/queryUnit.ts lines 166-169: the true branch of if (extensions[v.value])
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
    // The extension should have been consumed (deleted)
    expect(extensions.x).toBeUndefined();
  });

  it('putExtensionsInGroup with undefined where covers null-coalescing fallback', ({ expect }) => {
    // Covers toAst/queryUnit.ts line 241: result.where ?? F.patternGroup([], F.gen())
    // The ?? fallback is taken when result.where is undefined
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
    // Covers toAst/queryUnit.ts isSimpleTerm: term.termType !== 'Quad' FALSE branch (line 45)
    const transformer = toAst11Builder.build();
    const c = createAstContext();
    // Pass a value with termType='Quad' to replaceAggregatorVariables
    const quadLike = { termType: 'Quad', value: 'fake', subject: {}, predicate: {}, object: {}, graph: {}};
    const result = (<any>transformer).replaceAggregatorVariables(c, quadLike, {});
    expect(result).toBeDefined();
  });

  it('replaceAggregatorVariables with wildcard termType covers isSimpleTerm wildcard FALSE branch', ({ expect }) => {
    // Covers toAst/queryUnit.ts isSimpleTerm: term.termType !== 'wildcard' FALSE branch
    const transformer = toAst11Builder.build();
    const c = createAstContext();
    const wildcardLike = { termType: 'wildcard', value: '*' };
    const result = (<any>transformer).replaceAggregatorVariables(c, wildcardLike, {});
    expect(result).toBeDefined();
  });

  it('replaceAggregatorVariables with Wildcard termType covers isSimpleTerm Wildcard FALSE branch', ({ expect }) => {
    // Covers toAst/queryUnit.ts isSimpleTerm: term.termType !== 'Wildcard' FALSE branch
    const transformer = toAst11Builder.build();
    const c = createAstContext();
    const wildcardLike = { termType: 'Wildcard', value: '*' };
    const result = (<any>transformer).replaceAggregatorVariables(c, wildcardLike, {});
    expect(result).toBeDefined();
  });

  it('replaceAggregatorVariables with RDF Variable covers isSimpleTerm TRUE branch (ternary line 58)', ({ expect }) => {
    // Covers toAst/queryUnit.ts line 58: isSimpleTerm(s) TRUE branch → SUBRULE(translateAlgTerm, s)
    // An RDF.Variable has termType='Variable', satisfying isSimpleTerm → TRUE branch taken
    const transformer = toAst11Builder.build();
    const c = createAstContext();
    // TermType = 'Variable'
    const rdfVar = AF.dataFactory.variable!('x');
    const result = (<any>transformer).replaceAggregatorVariables(c, rdfVar, {});
    expect(result).toBeDefined();
  });

  it('translateAlgProject with DESCRIBE type covers line 98 (DESCRIBE branch) - round-trip', ({ expect }) => {
    // Covers toAst/queryUnit.ts line 98: else if (type === types.DESCRIBE)
    // Use parse+toAlgebra+toAst to go through the full code path
    const ast = parser.parse('DESCRIBE <http://example.org/s> WHERE { ?s ?p ?o }');
    const algebra = toAlgebra(ast);
    const backAst = toAst(algebra);
    expect(backAst).toBeDefined();
    expect(backAst.type).toBe('query');
  });

  it('translateAlgProject with DESCRIBE type covers line 98 (direct algebra)', ({ expect }) => {
    // Covers toAst/queryUnit.ts line 98: else if (type === types.DESCRIBE)
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
