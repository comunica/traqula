import {
  AstFactory,
  checkNote13,
  findPatternBoundedVars,
  queryProjectionIsGood,
  updateNoReuseBlankNodeLabels,
} from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';

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

  it('finds variables in a select query with group and values', ({ expect }) => {
    const vars = new Set<string>();
    const varX = F.termVariable('x', noLoc);
    const varY = F.termVariable('y', noLoc);
    const group = F.solutionModifierGroup([ varX ], noLoc);
    const where = F.patternGroup([], noLoc);
    const values = F.patternValues([ varX ], [{ x: undefined }], noLoc);
    const query = F.querySelect({
      variables: [ varY ],
      context: [],
      where,
      solutionModifiers: { group },
      datasets: F.datasetClauses([], noLoc),
      values,
    }, noLoc);
    findPatternBoundedVars(query, vars);
    expect(vars.has('x')).toBe(true);
  });

  it('finds variables in a construct query (non-select/describe)', ({ expect }) => {
    const vars = new Set<string>();
    const varX = F.termVariable('x', noLoc);
    const group = F.solutionModifierGroup([ varX ], noLoc);
    const bgp = F.patternBgp([], noLoc);
    const where = F.patternGroup([], noLoc);
    const construct = F.queryConstruct(
      noLoc,
      [],
      bgp,
      where,
      { group },
      F.datasetClauses([], noLoc),
    );
    findPatternBoundedVars(construct, vars);
    expect(vars.has('x')).toBe(false);
  });

  it('finds variables in solutionModifier nodes', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const expr = F.expressionOperation('+', [ varX ], noLoc);

    const groupVars = new Set<string>();
    // Use a SolutionModifierGroupBind (has .variable property) to cover the x => x.variable map lambda
    const groupBind = <any>{ expression: varX, variable: varX, loc: noLoc };
    const group = F.solutionModifierGroup([ groupBind ], noLoc);
    findPatternBoundedVars(group, groupVars);
    expect(groupVars.has('x')).toBe(true);

    const havingVars = new Set<string>();
    const having = F.solutionModifierHaving([ expr ], noLoc);
    findPatternBoundedVars(having, havingVars);

    const orderVars = new Set<string>();
    const order = F.solutionModifierOrder([{ expression: varX, descending: false, loc: noLoc }], noLoc);
    findPatternBoundedVars(order, orderVars);
    expect(orderVars.has('x')).toBe(true);
  });
});

describe('queryProjectionIsGood - additional cases', () => {
  it('returns id for aggregate with variable expression', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const agg = F.aggregate('count', false, varX, undefined, noLoc);
    // Build a GROUP BY with the aggregate as grouping
    const query = {
      variables: [ varX ],
      solutionModifiers: {
        group: {
          type: 'solutionModifier',
          subType: 'group',
          groupings: [ agg ],
        },
      },
      where: { type: 'group', patterns: []},
    };
    // This exercises getExpressionId with aggregate case
    expect(() => queryProjectionIsGood(<any>query)).not.toThrow();
  });

  it('throws on ungrouped variable in expression binding', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const varY = F.termVariable('y', noLoc);
    // SelectVar is an AS binding: (expr AS ?result) where expr uses ?y
    const expr = F.expressionOperation('+', [ varY ], noLoc);
    const binding = { expression: expr, variable: F.termVariable('result', noLoc) };
    const query = {
      variables: [ binding ],
      solutionModifiers: {
        group: {
          type: 'solutionModifier',
          subType: 'group',
          groupings: [ varX ],
        },
      },
      where: { type: 'group', patterns: []},
    };
    expect(() => queryProjectionIsGood(<any>query))
      .toThrowError(/Use of ungrouped variable in projection/u);
  });

  it('exercises getVariablesFromExpression with nested operator', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const varY = F.termVariable('y', noLoc);
    // Nested operator: +(+(varX, varY))
    const inner = F.expressionOperation('+', [ varX, varY ], noLoc);
    const outer = F.expressionOperation('*', [ inner ], noLoc);
    const binding = { expression: outer, variable: F.termVariable('result', noLoc) };
    const query = {
      variables: [ binding ],
      solutionModifiers: {
        group: {
          type: 'solutionModifier',
          subType: 'group',
          groupings: [ varX, varY ],
        },
      },
      where: { type: 'group', patterns: []},
    };
    // Should not throw since all used vars are in GROUP BY
    expect(() => queryProjectionIsGood(<any>query)).not.toThrow();
  });

  it('throws when AS variable already used in subquery', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const binding = { expression: F.termLiteral(noLoc, '1'), variable: varX };
    // Create a mock subquery that projects ?x
    const subquery = {
      type: 'query',
      subType: 'select',
      variables: [ varX ],
    };
    const query = {
      variables: [ binding ],
      solutionModifiers: {},
      where: {
        type: 'group',
        patterns: [ subquery ],
      },
    };
    expect(() => queryProjectionIsGood(<any>query))
      .toThrowError(/Target id of 'AS' \(\?x\) already used in subquery/u);
  });
});

describe('checkNote13 - second bounded vars check', () => {
  it('throws when variable is already bound by a preceding non-BGP pattern', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    // A VALUES pattern that adds ?x to boundedVars (non-BGP, so first loop won't fire)
    const valuesPattern = F.patternValues([ varX ], [{ x: undefined }], noLoc);
    const bind = {
      type: 'pattern',
      subType: 'bind',
      variable: varX,
      expression: F.termLiteral(noLoc, '2'),
    };
    // Second loop: values adds 'x', then bind sees 'x' already bound → L214
    expect(() => checkNote13(<any>[ valuesPattern, bind ]))
      .toThrowError(/Variable used to bind is already bound/u);
  });
});
