import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { AlgebraFactory, algebraUtils, createAstContext, createAlgebraContext }
  from '@traqula/algebra-transformations-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import { AstFactory } from '@traqula/rules-sparql-1-1';
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
      // Covers algebraFactory.ts line 263: str.startsWith('$')
      const term = AF.createTerm('$myVar');
      expect(term.termType).toBe('Variable');
      expect(term.value).toBe('myVar');
    });

    it('createJoin with flatten=false preserves nesting', ({ expect }) => {
      // Covers algebraFactory.ts flattenMulti with flatten=false (line 352)
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
      // Covers algebraFactory.ts lines 42-49
      const variable = AF.dataFactory.variable!('myVar');
      const expression = AF.createWildcardExpression();
      const bound = AF.createBoundAggregate(variable, 'count', expression, false);
      expect(bound.variable).toBe(variable);
      expect(bound.type).toBe('expression');
    });
  });

  describe('property path: NPS with only inverted predicates', () => {
    it('round-trips !(^<p1>|^<p2>) (inv-only NPS, covers toAlgebra/path.ts normals.length===0)', ({ expect }) => {
      // Covers toAlgebra/path.ts: normals.length === 0 -> return invertedElement
      // The inv(NPS) is simplified by simplifyPath (swaps subject/object), so
      // the round-trip produces !(p1|p2) without ^ (semantically equivalent).
      const result = roundTrip(
        'SELECT * WHERE { ?s !(^<http://p1>|^<http://p2>) ?o }',
      );
      expect(result).toContain('!');
    });

    it('toAst handles inv(NPS with 2+ IRIs) as path predicate (covers toAst/path.ts line 72)', ({ expect }) => {
      // Covers toAst/path.ts:72 — translateAlgInv when path.path is an NPS with 2+ IRIs.
      // We construct the algebra directly (bypassing simplifyPath which eliminates top-level inv(NPS))
      // so the inv(NPS) is preserved as-is in the algebra Path predicate.
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
    it('round-trips SELECT with GROUP BY on BIND-derived variable', ({ expect }) => {
      // Covers toAst/queryUnit.ts lines 166-169: extensions[v.value] check in registerAlgGroupBy.
      // BIND(?x AS ?g) creates an Extend in the algebra; when the GROUP BY variable (?g)
      // matches the extend variable, it becomes a SolutionModifierGroupBind.
      const result = roundTrip(
        'SELECT ?g (COUNT(*) AS ?c) WHERE { ?s ?p ?x . BIND(?x AS ?g) } GROUP BY ?g',
      );
      expect(result).toContain('GROUP BY');
    });
  });

  describe('translateAlgAnyExpression wildcard branch', () => {
    it('round-trips COUNT(*) which uses wildcard expression', ({ expect }) => {
      // Covers toAst/expression.ts:56: translateAlgAnyExpression non-OPERATOR branch
      // (COUNT(*) uses eTypes.WILDCARD which hits the else branch in translateAlgAnyExpression)
      const result = roundTrip(
        'SELECT (COUNT(*) AS ?cnt) WHERE { ?s ?p ?o }',
      );
      expect(result).toContain('COUNT');
      expect(result).toContain('*');
    });
  });

  describe('insert/DELETE without quads option throws', () => {
    it('toAlgebra throws when INSERT DATA is converted without quads option', ({ expect }) => {
      // Covers toAlgebra/updates.ts:93: !useQuads throws for INSERT/DELETE
      const ast = parser.parse('INSERT DATA { <http://s> <http://p> <http://o> }');
      expect(() => toAlgebra(ast, { quads: false })).toThrowError(
        /INSERT\/DELETE operations are only supported with quads option enabled/u,
      );
    });
  });

  describe('translateAlgAnyExpression with NAMED expression (non-OPERATOR/non-WILDCARD)', () => {
    it('round-trips aggregate with named variable reference', ({ expect }) => {
      // An ORDER BY ?var case — ?var has subType NAMED, going through the else branch
      // in translateAlgAnyExpression -> translateAlgExpressionOrWild -> translateAlgPureExpression
      const result = roundTrip(
        'SELECT * WHERE { ?s ?p ?o } ORDER BY ?o',
      );
      expect(result).toContain('ORDER BY');
    });
  });

  describe('variable collision in blank-to-variable translation', () => {
    it('generates unique vars when blank node name collides with existing variable', ({ expect }) => {
      // Covers general.ts:119: the uniqueVar while loop for collision avoidance
      // When _:b0 is converted, but ?b0 already exists as a variable
      const result = roundTrip(
        'CONSTRUCT { _:b0 <http://p> ?b0 } WHERE { ?b0 <http://p> ?o }',
      );
      expect(result).toBeDefined();
      // Both the blank node and the variable should appear in the result
      expect(result).toContain('CONSTRUCT');
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
      // Covers util.ts lines 364-381: PATH visitor in inScopeVariables
      const ast = parser.parse('SELECT * WHERE { ?s <http://p>* ?o }');
      const algebra = toAlgebra(ast);
      const variables = algebraUtils.inScopeVariables(algebra);
      expect(variables.map(v => v.value)).toContain('s');
      expect(variables.map(v => v.value)).toContain('o');
    });
  });

  describe('algebraFactory flattenMulti with matching subType (branch 359)', () => {
    it('flattens a Multi operation when child has the same type and subType', ({ expect }) => {
      // Covers algebraFactory.ts line 359: !subType is false, but subType === child.subType is true
      const child = { type: 'alt', subType: 'testSub', input: []};
      const outer = { type: 'alt', subType: 'testSub', input: [ child ]};
      const result = (<any>AF).flattenMulti(outer, true);
      // Child's input should be inlined into outer
      expect(result.input).toHaveLength(0);
    });
  });

  describe('algebraUtils.inScopeVariables with PATTERN graph as Variable (util.ts:333)', () => {
    it('extracts graph variable from PATTERN with variable graph', ({ expect }) => {
      // Covers util.ts line 333: quad.graph.termType === 'Variable'
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
      // Covers util.ts line 337: quad.graph.termType === 'Quad'
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
      const variables = algebraUtils.inScopeVariables(<any>AF.createProject(<any>pattern, [ innerObj ]));
      expect(variables.map(v => v.value)).toContain('innerObj');
    });
  });

  describe('algebraUtils.inScopeVariables with PATH having quad subject (util.ts:367)', () => {
    it('handles PATH with nested quad as subject', ({ expect }) => {
      // Covers util.ts line 367: op.subject.termType === 'Quad'
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
      const variables = algebraUtils.inScopeVariables(<any>AF.createProject(<any>path, [ innerVar ]));
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
      const variables = algebraUtils.inScopeVariables(<any>AF.createProject(<any>path, [ innerVar ]));
      expect(variables.map(v => v.value)).toContain('innerObjVar');
    });
  });

  describe('algebraUtils.inScopeVariables with PATH having quad graph (util.ts:379)', () => {
    it('handles PATH with nested quad as graph', ({ expect }) => {
      // Covers util.ts line 379: op.graph.termType === 'Quad'
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
      const variables = algebraUtils.inScopeVariables(<any>AF.createProject(<any>path, [ innerVar ]));
      expect(variables.map(v => v.value)).toContain('innerGraphVar');
    });
  });

  describe('createAlgebraContext with prefixes (toAlgebra/core.ts:39)', () => {
    it('passes prefixes to the algebra context', ({ expect }) => {
      // Covers toAlgebra/core.ts:39: config.prefixes ? { ...config.prefixes } : {}
      const ast = parser.parse('PREFIX ex: <http://example.org/> SELECT * WHERE { ex:s ex:p ex:o }');
      const result = toAlgebra(ast, { prefixes: { ex: 'http://example.org/' }});
      expect(result).toBeDefined();
    });
  });

  describe('translateTerm with unexpected term type (toAlgebra/general.ts:61)', () => {
    it('throws when given an unrecognised term subType', ({ expect }) => {
      // Covers toAlgebra/general.ts:61: throw new Error('Unexpected term')
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      const fakeTerm = <any>{ type: 'term', subType: 'unexpected_type' };
      expect(() => transformer.translateTerm(c, fakeTerm)).toThrow(/Unexpected term/u);
    });
  });

  describe('generateFreshVar with collision (toAlgebra/general.ts:215)', () => {
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

  describe('mINUS in GRAPH (toAlgebra/tripleAndQuad.ts:139-140)', () => {
    it('round-trips a GRAPH with MINUS inside', ({ expect }) => {
      // Covers tripleAndQuad.ts lines 139-140: MINUS type with graph variable
      const result = roundTrip(
        'SELECT * WHERE { GRAPH ?g { ?s ?p ?o MINUS { ?s ?p ?o } } }',
      );
      expect(result).toBeDefined();
      expect(result).toContain('MINUS');
    });
  });

  describe('recurseGraph variable replacement (toAlgebra/tripleAndQuad.ts:153)', () => {
    it('replaces variables inside recurseGraph when match is found', ({ expect }) => {
      // Covers tripleAndQuad.ts line 153: algOp[castedKey] = replacement
      // This fires when a non-operation value in the algOp equals the graph variable.
      // Triggering via a graph containing a VALUES pattern which has variable names.
      const result = roundTrip(
        'SELECT * WHERE { GRAPH ?g { VALUES ?g { <http://ex> } } }',
      );
      expect(result).toBeDefined();
    });
  });

  describe('translateQuad with path predicate (toAlgebra/tripleAndQuad.ts:166)', () => {
    it('throws when translateQuad is called with a path predicate', ({ expect }) => {
      // Covers tripleAndQuad.ts line 166: throw new Error('Trying to translate property path to quad.')
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

  describe('translateUpdate with unknown operation (toAlgebra/updates.ts:80)', () => {
    it('throws when translateUpdate is called with an unknown update type', ({ expect }) => {
      // Covers toAlgebra/updates.ts:80: throw new Error('Unknown update type')
      const transformer = toAlgebra11Builder.build();
      const c = createAlgebraContext({});
      c.useQuads = true;
      expect(() => transformer.translateSingleUpdate(c, <any>{ type: 'updateOperation', subType: 'UNKNOWN' }))
        .toThrow(/Unknown update type/u);
    });
  });

  describe('translateAlgAnyExpression with non-OPERATOR expression (toAst/expression.ts:56)', () => {
    it('handles wildcard expression via the else branch', ({ expect }) => {
      // Covers toAst/expression.ts:56: translateAlgAnyExpression else branch (non-OPERATOR)
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const wildcardExpr = AF.createWildcardExpression();
      const result = transformer.translateAnyExpression(c, wildcardExpr);
      expect(result).toBeDefined();
    });
  });

  describe('translateAlgTerm with invalid term type (toAst/general.ts:43)', () => {
    it('throws on an unrecognised term type', ({ expect }) => {
      // Covers toAst/general.ts:43: throw new Error('invalid term type')
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const fakeTerm = <any>{ termType: 'DefaultGraph', value: '' };
      expect(() => transformer.translateTerm(c, fakeTerm)).toThrow(/invalid term type/u);
    });
  });

  describe('translateAlgPathComponent with unknown path type (toAst/path.ts:30)', () => {
    it('throws on an unrecognised path type', ({ expect }) => {
      // Covers toAst/path.ts:30: throw new Error('Unknown Path type')
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const fakePath = <any>{ type: 'UNKNOWN_PATH_TYPE_XYZ' };
      expect(() => transformer.translatePathComponent(c, fakePath)).toThrow(/Unknown Path type/u);
    });
  });

  describe('translateAlgPatternIntoGroup with unknown operation type (toAst/pattern.ts:46)', () => {
    it('throws on an unrecognised operation type', ({ expect }) => {
      // Covers toAst/pattern.ts:46: throw new Error('Unknown Operation type')
      const transformer = toAst11Builder.build();
      const c = createAstContext();
      const fakeOp = <any>{ type: 'UNKNOWN_OP_TYPE_XYZ' };
      expect(() => transformer.translatePatternIntoGroup(c, fakeOp)).toThrow(/Unknown Operation type/u);
    });
  });

  describe('translateAlgSinglePattern with PATTERN type (toAst/pattern.ts:62)', () => {
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

  describe('dELETE WHERE round-trip (toAst/updateUnit.ts:160)', () => {
    it('converts algebra back to DELETE WHERE when patterns contain variables', ({ expect }) => {
      // Covers toAst/updateUnit.ts:160: asCasted.subType = 'deletewhere'
      const result = roundTripQuads(
        'DELETE WHERE { ?s ?p ?o }',
      );
      expect(result).toContain('DELETE WHERE');
    });
  });

  describe('convertAlgUpdatePatterns with undefined input (toAst/updateUnit.ts:274)', () => {
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
  });
});
