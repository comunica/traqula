import { describe, it } from 'vitest';
import { isTriple, AlgebraFactory, algebraUtils } from '../lib/index.js';

describe('algebraFactory edge cases', () => {
  const AF = new AlgebraFactory();

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

  describe('algebraFactory flattenMulti with matching subType', () => {
    it('flattens a Multi operation when child has the same type and subType', ({ expect }) => {
      const child = { type: 'alt', subType: 'testSub', input: []};
      const outer = { type: 'alt', subType: 'testSub', input: [ child ]};
      const result = (<any>AF).flattenMulti(outer, true);
      // Child's input should be inlined into outer
      expect(result.input).toHaveLength(0);
    });
  });

  describe('algebraUtils.inScopeVariables with PATTERN graph as Variable', () => {
    it('extracts graph variable from PATTERN with variable graph', ({ expect }) => {
      const s = AF.dataFactory.namedNode('http://s');
      const p = AF.dataFactory.namedNode('http://p');
      const o = AF.dataFactory.namedNode('http://o');
      const g = AF.dataFactory.variable!('g');
      const pattern = AF.createPattern(s, p, o, g);
      const variables = algebraUtils.inScopeVariables(AF.createProject(pattern, [ g ]));
      expect(variables.map(v => v.value)).toContain('g');
    });
  });

  describe('algebraUtils.inScopeVariables with PATTERN graph as Quad', () => {
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
      const pattern = AF.createPattern(s, p, o, inner);
      const variables = algebraUtils.inScopeVariables(pattern);
      expect(variables.map(v => v.value)).toContain('innerObj');
    });

    it('handles PATTERN with nested quad as subject', ({ expect }) => {
      const innerSubjectVar = AF.dataFactory.variable!('subjectVar');
      const innerQuad = AF.dataFactory.quad(
        innerSubjectVar,
        AF.dataFactory.namedNode('http://p'),
        AF.dataFactory.namedNode('http://o'),
        AF.dataFactory.defaultGraph(),
      );
      const p = AF.dataFactory.namedNode('http://p');
      const o = AF.dataFactory.namedNode('http://o');
      const pattern = AF.createPattern(innerQuad, p, o);
      const variables = algebraUtils.inScopeVariables(pattern);
      expect(variables.map(v => v.value)).toContain('subjectVar');
    });

    it('handles PATTERN with nested quad as predicate', ({ expect }) => {
      const innerPredVar = AF.dataFactory.variable!('predVar');
      const innerQuad = AF.dataFactory.quad(
        innerPredVar,
        AF.dataFactory.namedNode('http://p2'),
        AF.dataFactory.namedNode('http://o'),
        AF.dataFactory.defaultGraph(),
      );
      const s = AF.dataFactory.namedNode('http://s');
      const o = AF.dataFactory.namedNode('http://o');
      const pattern = AF.createPattern(s, innerQuad, o);
      const variables = algebraUtils.inScopeVariables(pattern);
      expect(variables.map(v => v.value)).toContain('predVar');
    });

    it('handles PATTERN with nested quad as object', ({ expect }) => {
      const innerObjVar2 = AF.dataFactory.variable!('objVar2');
      const innerQuad = AF.dataFactory.quad(
        innerObjVar2,
        AF.dataFactory.namedNode('http://p'),
        AF.dataFactory.namedNode('http://o2'),
        AF.dataFactory.defaultGraph(),
      );
      const s = AF.dataFactory.namedNode('http://s');
      const p = AF.dataFactory.namedNode('http://p');
      const pattern = AF.createPattern(s, p, innerQuad);
      const variables = algebraUtils.inScopeVariables(pattern);
      expect(variables.map(v => v.value)).toContain('objVar2');
    });
  });

  describe('algebraUtils.inScopeVariables with PATH having quad subject', () => {
    it('handles PATH with nested quad as subject', ({ expect }) => {
      const innerVar = AF.dataFactory.variable!('innerVar');
      const innerQuad = AF.dataFactory.quad(
        innerVar,
        AF.dataFactory.namedNode('http://p'),
        AF.dataFactory.namedNode('http://o'),
        AF.dataFactory.defaultGraph(),
      );
      const path = AF.createPath(
        innerQuad,
        AF.createLink(AF.dataFactory.namedNode('http://link')),
        AF.dataFactory.variable!('o'),
      );
      const variables = algebraUtils.inScopeVariables(path);
      expect(variables.map(v => v.value)).toContain('innerVar');
    });
  });

  describe('algebraUtils.inScopeVariables with PATH having quad object', () => {
    it('handles PATH with nested quad as object', ({ expect }) => {
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
        innerQuad,
      );
      const variables = algebraUtils.inScopeVariables(path);
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
        innerQuad,
      );
      const variables = algebraUtils.inScopeVariables(path);
      expect(variables.map(v => v.value)).toContain('innerGraphVar');
    });
  });
});

describe('algebraUtils utility functions', () => {
  it('resolveIRI returns absolute IRIs unchanged', ({ expect }) => {
    expect(algebraUtils.resolveIRI('http://example.org/foo', 'http://base.org/')).toBe('http://example.org/foo');
    expect(algebraUtils.resolveIRI('urn:example:foo', 'http://base.org/')).toBe('urn:example:foo');
  });

  it('resolveIRI resolves empty relative IRI to base', ({ expect }) => {
    expect(algebraUtils.resolveIRI('', 'http://base.org/')).toBe('http://base.org/');
  });

  it('resolveIRI throws when no base is set and IRI is relative', ({ expect }) => {
    expect(() => algebraUtils.resolveIRI('relative/path', undefined))
      .toThrowError(/Cannot resolve relative IRI/u);
  });

  it('resolveIRI resolves query string relative IRI', ({ expect }) => {
    const result = algebraUtils.resolveIRI('?query=1', 'http://base.org/path');
    expect(result).toBe('http://base.org/path?query=1');
  });

  it('resolveIRI resolves root-relative IRI', ({ expect }) => {
    const result = algebraUtils.resolveIRI('/root/path', 'http://base.org/some/path');
    expect(result).toBe('http://base.org/root/path');
  });

  it('isTriple identifies quad-like objects', ({ expect }) => {
    const triple = { subject: {}, predicate: {}, object: {}};
    expect(isTriple(triple)).toBeTruthy();
    expect(isTriple({ subject: {}})).toBeFalsy();
    expect(isTriple({})).toBeFalsy();
  });
});
