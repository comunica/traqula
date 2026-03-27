import { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import { AlgebraFactory, Algebra, algebraUtils } from '@traqula/algebra-transformations-1-1';

const { resolveIRI, objectify, inScopeVariables, mapOperation, visitOperation } = algebraUtils;

describe('algebraUtils', () => {
  const factory = new AlgebraFactory();
  const df = new DataFactory();

  describe('resolveIRI', () => {
    it('returns absolute IRIs as-is', ({ expect }) => {
      expect(resolveIRI('http://example.org/test', 'http://base.org/')).toBe('http://example.org/test');
      expect(resolveIRI('urn:isbn:12345', 'http://base.org/')).toBe('urn:isbn:12345');
    });

    it('resolves fragment IRIs against base', ({ expect }) => {
      expect(resolveIRI('#section1', 'http://example.org/page')).toBe('http://example.org/page#section1');
    });

    it('resolves query string IRIs by replacing query string', ({ expect }) => {
      expect(resolveIRI('?q=new', 'http://example.org/page?q=old')).toBe('http://example.org/page?q=new');
      expect(resolveIRI('?q=new', 'http://example.org/page')).toBe('http://example.org/page?q=new');
    });

    it('resolves root-relative IRIs from root of base', ({ expect }) => {
      expect(resolveIRI('/path/to/resource', 'http://example.org/other/path')).toBe('http://example.org/path/to/resource');
    });

    it('resolves empty IRI as base IRI', ({ expect }) => {
      expect(resolveIRI('', 'http://example.org/page')).toBe('http://example.org/page');
    });

    it('resolves relative IRIs against base path', ({ expect }) => {
      expect(resolveIRI('relative', 'http://example.org/path/')).toBe('http://example.org/path/relative');
      expect(resolveIRI('resource', 'http://example.org/path/file')).toBe('http://example.org/path/resource');
    });

    it('throws when no base is given for relative IRIs', ({ expect }) => {
      expect(() => resolveIRI('relative', undefined)).toThrow('Cannot resolve relative IRI');
    });
  });

  describe('objectify', () => {
    it('converts a named node term', ({ expect }) => {
      const term = df.namedNode('http://example.org/');
      const result = objectify(term);
      expect(result).toMatchObject({ termType: 'NamedNode', value: 'http://example.org/' });
    });

    it('converts a literal with language tag', ({ expect }) => {
      const term = df.literal('hello', 'en');
      const result = objectify(term);
      expect(result).toMatchObject({ termType: 'Literal', value: 'hello', language: 'en' });
    });

    it('converts a literal with datatype', ({ expect }) => {
      const term = df.literal('42', df.namedNode('http://www.w3.org/2001/XMLSchema#integer'));
      const result = objectify(term);
      expect(result).toMatchObject({ termType: 'Literal', value: '42' });
      expect(result.datatype).toMatchObject({ termType: 'NamedNode', value: 'http://www.w3.org/2001/XMLSchema#integer' });
    });

    it('converts a variable', ({ expect }) => {
      const term = df.variable('x');
      const result = objectify(term);
      expect(result).toMatchObject({ termType: 'Variable', value: 'x' });
    });

    it('converts arrays recursively', ({ expect }) => {
      const terms = [ df.namedNode('http://a'), df.namedNode('http://b') ];
      const result = objectify(terms);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ termType: 'NamedNode', value: 'http://a' });
    });

    it('converts plain objects recursively', ({ expect }) => {
      const obj = { foo: df.namedNode('http://foo'), bar: 'plain' };
      const result = objectify(obj);
      expect(result.foo).toMatchObject({ termType: 'NamedNode' });
      expect(result.bar).toBe('plain');
    });

    it('converts a quad (pattern)', ({ expect }) => {
      const s = df.namedNode('http://s');
      const p = df.namedNode('http://p');
      const o = df.namedNode('http://o');
      const g = df.namedNode('http://g');
      const pattern = factory.createPattern(s, p, o, g);
      const result = objectify(pattern);
      expect(result.subject).toMatchObject({ termType: 'NamedNode', value: 'http://s' });
      expect(result.predicate).toMatchObject({ termType: 'NamedNode', value: 'http://p' });
      expect(result.object).toMatchObject({ termType: 'NamedNode', value: 'http://o' });
      expect(result.graph).toMatchObject({ termType: 'NamedNode', value: 'http://g' });
    });

    it('returns primitives as-is', ({ expect }) => {
      expect(objectify(42)).toBe(42);
      expect(objectify('hello')).toBe('hello');
      expect(objectify(true)).toBe(true);
    });
  });

  describe('mapOperation', () => {
    it('transforms an operation by type', ({ expect }) => {
      const nop1 = factory.createNop();
      const nop2 = factory.createNop();
      const join = factory.createJoin([ nop1, nop2 ], false);
      const project = factory.createProject(join, [ df.variable('x') ]);
      const distinct = factory.createDistinct(project);

      const result = mapOperation(distinct, {
        [Algebra.Types.PROJECT]: {
          transform: (proj) => factory.createReduced(proj),
        },
      });
      expect(result).toMatchObject({ type: Algebra.Types.DISTINCT });
      expect((result as Algebra.Distinct).input).toMatchObject({ type: Algebra.Types.REDUCED });
    });

    it('respects preVisitor continue:false to stop recursion', ({ expect }) => {
      const inner = factory.createNop();
      const project = factory.createProject(inner, [ df.variable('x') ]);
      const distinct = factory.createDistinct(project);

      const visited: string[] = [];
      mapOperation(distinct, {
        [Algebra.Types.PROJECT]: {
          preVisitor: () => ({ continue: false }),
          transform: (proj) => {
            visited.push('project');
            return proj;
          },
        },
        [Algebra.Types.NOP]: {
          transform: (nop) => {
            visited.push('nop');
            return nop;
          },
        },
      });
      // NOP should not be visited because we stopped at PROJECT
      expect(visited).not.toContain('nop');
      expect(visited).toContain('project');
    });
  });

  describe('visitOperation', () => {
    it('visits operations in reverse depth-first order', ({ expect }) => {
      const nop = factory.createNop();
      const project = factory.createProject(nop, [ df.variable('x') ]);
      const distinct = factory.createDistinct(project);

      const visited: string[] = [];
      visitOperation(distinct, {
        [Algebra.Types.NOP]: { visitor: () => { visited.push('nop'); } },
        [Algebra.Types.PROJECT]: { visitor: () => { visited.push('project'); } },
        [Algebra.Types.DISTINCT]: { visitor: () => { visited.push('distinct'); } },
      });
      // Visitor goes deepest-first
      expect(visited).toEqual([ 'nop', 'project', 'distinct' ]);
    });

    it('stops visiting when preVisitor sets continue:false', ({ expect }) => {
      const nop = factory.createNop();
      const project = factory.createProject(nop, [ df.variable('x') ]);
      const distinct = factory.createDistinct(project);

      const visited: string[] = [];
      visitOperation(distinct, {
        [Algebra.Types.PROJECT]: {
          preVisitor: () => ({ continue: false }),
          visitor: () => { visited.push('project'); },
        },
        [Algebra.Types.NOP]: { visitor: () => { visited.push('nop'); } },
      });
      expect(visited).not.toContain('nop');
    });
  });

  describe('inScopeVariables', () => {
    it('collects variables from a project operation', ({ expect }) => {
      const x = df.variable('x');
      const y = df.variable('y');
      const nop = factory.createNop();
      const project = factory.createProject(nop, [ x, y ]);

      const vars = inScopeVariables(project);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('x');
      expect(varNames).toContain('y');
    });

    it('collects variables from patterns (BGP)', ({ expect }) => {
      const s = df.variable('s');
      const p = df.namedNode('http://p');
      const o = df.variable('o');
      const pattern = factory.createPattern(s, p, o);
      const bgp = factory.createBgp([ pattern ]);

      const vars = inScopeVariables(bgp);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('s');
      expect(varNames).toContain('o');
    });

    it('collects variables from extend', ({ expect }) => {
      const x = df.variable('x');
      const nop = factory.createNop();
      const expr = factory.createTermExpression(df.literal('1'));
      const extend = factory.createExtend(nop, x, expr);

      const vars = inScopeVariables(extend);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('x');
    });

    it('collects variables from graph when name is variable', ({ expect }) => {
      const g = df.variable('g');
      const nop = factory.createNop();
      const graph = factory.createGraph(nop, g);

      const vars = inScopeVariables(graph);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('g');
    });

    it('does not collect graph name when it is a named node', ({ expect }) => {
      const nop = factory.createNop();
      const graph = factory.createGraph(nop, df.namedNode('http://g'));

      const vars = inScopeVariables(graph);
      // No variables from graph name
      expect(vars).toHaveLength(0);
    });

    it('collects variables from group operation', ({ expect }) => {
      const x = df.variable('x');
      const nop = factory.createNop();
      const group = factory.createGroup(nop, [ x ], []);

      const vars = inScopeVariables(group);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('x');
    });

    it('collects variables from values', ({ expect }) => {
      const x = df.variable('x');
      const values = factory.createValues([ x ], [{ '?x': df.literal('1') }]);

      const vars = inScopeVariables(values);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('x');
    });

    it('collects variables from service when name is variable', ({ expect }) => {
      const serviceVar = df.variable('endpoint');
      const nop = factory.createNop();
      const service = factory.createService(nop, serviceVar);

      const vars = inScopeVariables(service);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('endpoint');
    });

    it('only scopes left side of minus', ({ expect }) => {
      const leftVar = df.variable('leftVar');
      const rightVar = df.variable('rightVar');
      const leftPattern = factory.createPattern(leftVar, df.namedNode('http://p'), df.namedNode('http://o'));
      const rightPattern = factory.createPattern(rightVar, df.namedNode('http://p'), df.namedNode('http://o'));
      const leftBgp = factory.createBgp([ leftPattern ]);
      const rightBgp = factory.createBgp([ rightPattern ]);
      const minus = factory.createMinus(leftBgp, rightBgp);

      const vars = inScopeVariables(minus);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('leftVar');
      expect(varNames).not.toContain('rightVar');
    });

    it('collects variables from path operations', ({ expect }) => {
      const s = df.variable('s');
      const o = df.variable('o');
      const link = factory.createLink(df.namedNode('http://p'));
      const path = factory.createPath(s, link, o);

      const vars = inScopeVariables(path);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('s');
      expect(varNames).toContain('o');
    });

    it('collects aggregate variable from bound aggregate expression', ({ expect }) => {
      const aggVar = df.variable('total');
      const termExpr = factory.createTermExpression(df.variable('x'));
      const boundAgg = factory.createBoundAggregate(aggVar, 'sum', termExpr, false);
      const nop = factory.createNop();
      const group = factory.createGroup(nop, [], [ boundAgg ]);

      const vars = inScopeVariables(group);
      const varNames = vars.map(v => v.value);
      expect(varNames).toContain('total');
    });
  });
});
