import { describe, it } from 'vitest';
import { AstFactory } from '../lib/astFactory.js';
import {
  queryProjectionIsGood,
  checkNote13,
  updateNoReuseBlankNodeLabels,
  findPatternBoundedVars,
} from '../lib/validation/validators.js';

const F = new AstFactory();
const noLoc = F.gen();

describe('queryProjectionIsGood', () => {
  it('allows wildcard select without GROUP BY', ({ expect }) => {
    const query = {
      variables: [ F.wildcard(noLoc) ],
      solutionModifiers: {},
      where: { type: 'group', patterns: []},
    };

    expect(() => queryProjectionIsGood(<any>query)).not.toThrow();
  });

  it('throws on wildcard select with GROUP BY', ({ expect }) => {
    const query = {
      variables: [ F.wildcard(noLoc) ],
      solutionModifiers: { group: { type: 'solutionModifier', subType: 'group', groupings: []}},
      where: { type: 'group', patterns: []},
    };

    expect(() => queryProjectionIsGood(<any>query)).toThrowError(/GROUP BY not allowed with wildcard/u);
  });

  it('throws when projecting ungrouped variable', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const query = {
      variables: [ varX ],
      solutionModifiers: {
        group: {
          type: 'solutionModifier',
          subType: 'group',
          groupings: [ F.termVariable('y', noLoc) ],
        },
      },
      where: { type: 'group', patterns: []},
    };

    expect(() => queryProjectionIsGood(<any>query)).toThrowError(/Variable not allowed in projection/u);
  });

  it('allows grouped variable in projection', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const query = {
      variables: [ varX ],
      solutionModifiers: {
        group: {
          type: 'solutionModifier',
          subType: 'group',
          groupings: [ varX ],
        },
      },
      where: { type: 'group', patterns: []},
    };

    expect(() => queryProjectionIsGood(<any>query)).not.toThrow();
  });
});

describe('checkNote13', () => {
  it('throws when BIND variable already bound in preceding BGP', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const bgp = {
      type: 'pattern',
      subType: 'bgp',
      triples: [
        {
          type: 'triple',
          subject: varX,
          predicate: F.termNamed(noLoc, 'http://p'),
          object: F.termNamed(noLoc, 'http://o'),
        },
      ],
    };
    const bind = {
      type: 'pattern',
      subType: 'bind',
      variable: varX,
      expression: F.termLiteral(noLoc, 'value'),
    };

    expect(() => checkNote13(<any>[ bgp, bind ])).toThrowError(/Variable used to bind is already bound/u);
  });

  it('allows BIND with fresh variable', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const varY = F.termVariable('y', noLoc);
    const bgp = {
      type: 'pattern',
      subType: 'bgp',
      triples: [
        {
          type: 'triple',
          subject: varX,
          predicate: F.termNamed(noLoc, 'http://p'),
          object: F.termNamed(noLoc, 'http://o'),
        },
      ],
    };
    const bind = {
      type: 'pattern',
      subType: 'bind',
      variable: varY,
      expression: F.termLiteral(noLoc, 'value'),
    };

    expect(() => checkNote13(<any>[ bgp, bind ])).not.toThrow();
  });
});

describe('updateNoReuseBlankNodeLabels', () => {
  it('throws when blank node label reused across INSERT DATA clauses', ({ expect }) => {
    const update = {
      type: 'update',
      updates: [
        {
          operation: {
            type: 'updateOperation',
            subType: 'insertdata',
            triples: [{ subject: { type: 'term', subType: 'blankNode', label: 'b1' }}],
          },
        },
        {
          operation: {
            type: 'updateOperation',
            subType: 'insertdata',
            triples: [{ subject: { type: 'term', subType: 'blankNode', label: 'b1' }}],
          },
        },
      ],
    };

    expect(() => updateNoReuseBlankNodeLabels(<any>update))
      .toThrowError(/Detected reuse blank node across different INSERT DATA clauses/u);
  });

  it('allows different blank node labels in separate INSERT DATA clauses', ({ expect }) => {
    const update = {
      type: 'update',
      updates: [
        {
          operation: {
            type: 'updateOperation',
            subType: 'insertdata',
            triples: [{ subject: { type: 'term', subType: 'blankNode', label: 'b1' }}],
          },
        },
        {
          operation: {
            type: 'updateOperation',
            subType: 'insertdata',
            triples: [{ subject: { type: 'term', subType: 'blankNode', label: 'b2' }}],
          },
        },
      ],
    };

    expect(() => updateNoReuseBlankNodeLabels(<any>update)).not.toThrow();
  });

  it('skips updates without operations', ({ expect }) => {
    const update = {
      type: 'update',
      updates: [
        { operation: undefined },
        {
          operation: {
            type: 'updateOperation',
            subType: 'insertdata',
            triples: [{ subject: { type: 'term', subType: 'blankNode', label: 'b1' }}],
          },
        },
      ],
    };

    expect(() => updateNoReuseBlankNodeLabels(<any>update)).not.toThrow();
  });
});

describe('findPatternBoundedVars', () => {
  it('finds variables in simple patterns', ({ expect }) => {
    const vars = new Set<string>();
    const varX = F.termVariable('x', noLoc);
    findPatternBoundedVars(varX, vars);
    expect(vars.has('x')).toBe(true);
  });

  it('handles undefined input', ({ expect }) => {
    const vars = new Set<string>();
    findPatternBoundedVars(undefined, vars);
    expect(vars.size).toBe(0);
  });

  it('handles arrays of patterns', ({ expect }) => {
    const vars = new Set<string>();
    const varX = F.termVariable('x', noLoc);
    const varY = F.termVariable('y', noLoc);
    findPatternBoundedVars([ varX, varY ], vars);
    expect(vars.has('x')).toBe(true);
    expect(vars.has('y')).toBe(true);
  });
});
