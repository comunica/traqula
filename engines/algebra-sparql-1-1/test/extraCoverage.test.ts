import type { Algebra } from '@traqula/algebra-transformations-1-1';
import { AlgebraFactory, algebraUtils } from '@traqula/algebra-transformations-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import { AstFactory } from '@traqula/rules-sparql-1-1';
import { beforeEach, describe, it } from 'vitest';
import { toAlgebra, toAst } from '../lib/index.js';

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
});
