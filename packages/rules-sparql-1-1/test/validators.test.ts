import { describe, it } from 'vitest';
import type {
  Expression,
  Pattern,
  TripleNesting,
} from '../lib/index.js';
import {
  AstFactory,
  checkBlankNodeBGPScope,
  checkNote13,
  findPatternBoundedVars,
  queryProjectionIsGood,
  updateNoReuseBlankNodeLabels,
} from '../lib/index.js';

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

    expect(() => queryProjectionIsGood(<any>query)).toThrow(/GROUP BY not allowed with wildcard/u);
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

    expect(() => queryProjectionIsGood(<any>query)).toThrow(/Variable not allowed in projection/u);
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

    expect(() => checkNote13(<any>[ bgp, bind ])).toThrow(/Variable used to bind is already bound/u);
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
      .toThrow(/Detected reuse blank node across different INSERT DATA clauses/u);
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

describe('checkBlankNodeBGPScope', () => {
  function bnodeTriple(label: string): TripleNesting {
    const blank = F.termBlank(label, noLoc);
    return F.triple(blank, F.termVariable('p', noLoc), F.termVariable('v', noLoc), noLoc);
  }

  it('allows the same blank node reused within a single BGP', ({ expect }) => {
    const bgp = F.patternBgp([ bnodeTriple('a'), bnodeTriple('a') ], noLoc);
    expect(() => checkBlankNodeBGPScope([ bgp ])).not.toThrow();
  });

  it('allows different blank nodes across different BGPs', ({ expect }) => {
    const bgp1 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const bgp2 = F.patternBgp([ bnodeTriple('b') ], noLoc);
    const group = F.patternGroup([ bgp2 ], noLoc);
    expect(() => checkBlankNodeBGPScope([ bgp1, group ])).not.toThrow();
  });

  it('throws when a blank node is reused across a nested group and its parent BGP', ({ expect }) => {
    const outerBgp = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const innerBgp = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const group = F.patternGroup([ innerBgp ], noLoc);
    expect(() => checkBlankNodeBGPScope([ outerBgp, group ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  it('throws when a blank node is reused across UNION branches', ({ expect }) => {
    const branch1 = F.patternGroup([ F.patternBgp([ bnodeTriple('a') ], noLoc) ], noLoc);
    const branch2 = F.patternGroup([ F.patternBgp([ bnodeTriple('a') ], noLoc) ], noLoc);
    const union = F.patternUnion([ branch1, branch2 ], noLoc);
    expect(() => checkBlankNodeBGPScope([ union ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  it('throws when a blank node is reused across an OPTIONAL block', ({ expect }) => {
    const outerBgp = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const optional = F.patternOptional([ F.patternBgp([ bnodeTriple('a') ], noLoc) ], noLoc);
    expect(() => checkBlankNodeBGPScope([ outerBgp, optional ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  it('throws when a blank node is reused across a MINUS block', ({ expect }) => {
    const outerBgp = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const minus = F.patternMinus([ F.patternBgp([ bnodeTriple('a') ], noLoc) ], noLoc);
    expect(() => checkBlankNodeBGPScope([ outerBgp, minus ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  it('throws when a blank node is reused across a GRAPH block', ({ expect }) => {
    const outerBgp = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const graph = F.patternGraph(
      F.termVariable('g', noLoc),
      [ F.patternBgp([ bnodeTriple('a') ], noLoc) ],
      noLoc,
    );
    expect(() => checkBlankNodeBGPScope([ outerBgp, graph ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  it('throws when a blank node is reused across a SERVICE block', ({ expect }) => {
    const outerBgp = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const service = F.patternService(
      F.termVariable('g', noLoc),
      [ F.patternBgp([ bnodeTriple('a') ], noLoc) ],
      false,
      noLoc,
    );
    expect(() => checkBlankNodeBGPScope([ outerBgp, service ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  it('allows a blank node reused across triples split by a BIND', ({ expect }) => {
    const bind = {
      type: 'pattern',
      subType: 'bind',
      variable: F.termVariable('x', noLoc),
      expression: F.termLiteral(noLoc, '1'),
    };
    const bgp1 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const bgp2 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    expect(() => checkBlankNodeBGPScope([ bgp1, <Pattern> bind, bgp2 ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  it('allows a blank node reused across triples split by a VALUES clause', ({ expect }) => {
    const values = F.patternValues([ F.termVariable('x', noLoc) ], [{ x: undefined }], noLoc);
    const bgp1 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const bgp2 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    expect(() => checkBlankNodeBGPScope([ bgp1, values, bgp2 ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  // https://www.w3.org/TR/sparql11-query/#subqueries
  // subqueries are evaluated as independent queries first; only projected
  // variables join back into the outer solution, so blank node scope resets
  it('does not descend into subqueries (they have their own fresh scope)', ({ expect }) => {
    const outerBgp = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const subquery = {
      type: 'query',
      subType: 'select',
      where: F.patternGroup([ F.patternBgp([ bnodeTriple('a') ], noLoc) ], noLoc),
    };
    expect(() => checkBlankNodeBGPScope([ outerBgp, <Pattern> subquery ])).not.toThrow();
  });

  it('ignores non-BGP-bearing patterns such as simple FILTERs and BINDs', ({ expect }) => {
    const filter = F.patternFilter(F.termLiteral(noLoc, 'true'), noLoc);
    const bind = {
      type: 'pattern',
      subType: 'bind',
      variable: F.termVariable('x', noLoc),
      expression: F.termLiteral(noLoc, '1'),
    };
    expect(() => checkBlankNodeBGPScope([ <Pattern> filter, <Pattern> bind ])).not.toThrow();
  });

  it('allows a blank node reused across triples split by a FILTER', ({ expect }) => {
    const filter = F.patternFilter(F.termLiteral(noLoc, 'true'), noLoc);
    const bgp1 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const bgp2 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    expect(() => checkBlankNodeBGPScope([ bgp1, <Pattern> filter, bgp2 ])).not.toThrow();
  });

  it('still throws when a FILTER is followed by a genuinely new BGP-breaking construct', ({ expect }) => {
    const filter = F.patternFilter(F.termLiteral(noLoc, 'true'), noLoc);
    const bgp1 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const optional = F.patternOptional([ F.patternBgp([ bnodeTriple('a') ], noLoc) ], noLoc);
    expect(() => checkBlankNodeBGPScope([ bgp1, <Pattern> filter, optional ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  it('throws when a blank node is reused inside a FILTER (EXISTS) block', ({ expect }) => {
    const outerBgp = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const existsFilter = F.patternFilter(<Expression> {
      type: 'expression',
      subType: 'patternOperation',
      operator: 'exists',
      args: F.patternGroup([ F.patternBgp([ bnodeTriple('a') ], noLoc) ], noLoc),
    }, noLoc);
    expect(() => checkBlankNodeBGPScope([ outerBgp, <Pattern> existsFilter ]))
      .toThrow(/Detected reuse of blank node across two different basic graph patterns \(_:a\)/u);
  });

  it('allows blank node reuse across outer BGPs split by FILTER (EXISTS)', ({ expect }) => {
    const bgp1 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    const existsFilter = F.patternFilter(<Expression> {
      type: 'expression',
      subType: 'patternOperation',
      operator: 'exists',
      args: F.patternGroup([ F.patternBgp([ bnodeTriple('b') ], noLoc) ], noLoc),
    }, noLoc);
    const bgp2 = F.patternBgp([ bnodeTriple('a') ], noLoc);
    expect(() => checkBlankNodeBGPScope([ bgp1, <Pattern> existsFilter, bgp2 ])).not.toThrow();
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
      .toThrow(/Use of ungrouped variable in projection/u);
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
      .toThrow(/Target id of 'AS' \(\?x\) already used in subquery/u);
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
    // Second loop: values adds 'x', then bind sees 'x' already bound -> L214
    expect(() => checkNote13(<any>[ valuesPattern, bind ]))
      .toThrow(/Variable used to bind is already bound/u);
  });
});

describe('findPatternBoundedVars - additional branches', () => {
  it('handles empty PatternValues (values.at(0) ?? {} branch, line 172)', ({ expect }) => {
    // Covers validation/validators.ts line 172: op.values.at(0) ?? {}
    // When values array is empty, at(0) returns undefined, ?? {} gives {}, loop is skipped
    const vars = new Set<string>();
    const emptyValues = F.patternValues([], [], noLoc);
    findPatternBoundedVars(emptyValues, vars);
    expect(vars.size).toBe(0);
  });
});

describe('queryProjectionIsGood - subquery wildcard and PatternBind branches', () => {
  it('handles subquery with wildcard projection (F.isWildcard(v) branch)', ({ expect }) => {
    // Subquery that projects a wildcard (*): sub.variables = [Wildcard]
    const subquery = {
      type: 'query',
      subType: 'select',
      variables: [ F.wildcard(noLoc) ],
    };
    const outerQuery = {
      variables: [ F.termVariable('x', noLoc) ],
      solutionModifiers: {},
      where: {
        type: 'group',
        patterns: [ subquery ],
      },
    };
    expect(() => queryProjectionIsGood(<any>outerQuery)).not.toThrow();
  });

  it('handles subquery with PatternBind projection (v.variable.value branch)', ({ expect }) => {
    // Subquery that projects a PatternBind (?expr AS ?y): v.variable.value is used
    const patternBind = { expression: F.termVariable('x', noLoc), variable: F.termVariable('y', noLoc) };
    const subquery = {
      type: 'query',
      subType: 'select',
      variables: [ patternBind ],
    };
    const outerQuery = {
      variables: [ F.termVariable('x', noLoc) ],
      solutionModifiers: {},
      where: {
        type: 'group',
        patterns: [ subquery ],
      },
    };
    expect(() => queryProjectionIsGood(<any>outerQuery)).not.toThrow();
  });
});

describe('queryProjectionIsGood - line 128 FALSE branch', () => {
  it('does not throw when AS variable does not conflict with subquery (line 128 FALSE)', ({ expect }) => {
    // SubqueryIds.has(selectedVarId) is FALSE when outer AS variable is NOT in subquery projection
    const patternBind = { expression: F.termLiteral(noLoc, '1'), variable: F.termVariable('x', noLoc) };
    const subquery = {
      type: 'query',
      subType: 'select',
      // Projects ?y, NOT ?x
      variables: [ F.termVariable('y', noLoc) ],
    };
    const outerQuery = {
      // (expr AS ?x)
      variables: [ patternBind ],
      solutionModifiers: {},
      where: {
        type: 'group',
        patterns: [ subquery ],
      },
    };
    // SubqueryIds = {'y'}, selectBoundedVars = {'x'}, no conflict -> no throw
    expect(() => queryProjectionIsGood(<any>outerQuery)).not.toThrow();
  });
});
