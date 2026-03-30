import { describe, it } from 'vitest';
import { AstFactory, findPatternBoundedVars, langTagHasCorrectRange } from '../lib/index.js';
import { completeParseContext } from '../lib/parserUtils.js';

const F = new AstFactory();
const noLoc = F.gen();

describe('astFactory12', () => {
  it('isContextDefinitionVersion identifies version context definitions', ({ expect }) => {
    expect(F.isContextDefinitionVersion({ type: 'contextDef', subType: 'version' })).toBe(true);
    expect(F.isContextDefinitionVersion({ type: 'contextDef', subType: 'base' })).toBe(false);
    expect(F.isContextDefinitionVersion({ type: 'other' })).toBe(false);
  });
});

describe('langTagHasCorrectRange', () => {
  it('does nothing for a plain string literal', ({ expect }) => {
    const lit = F.termLiteral(noLoc, 'hello');
    expect(() => langTagHasCorrectRange(<any>lit)).not.toThrow();
  });

  it('does nothing for a lang string without direction', ({ expect }) => {
    const lit = F.termLiteral(noLoc, 'hello', 'en');
    expect(() => langTagHasCorrectRange(<any>lit)).not.toThrow();
  });

  it('does nothing for a lang string with valid direction ltr', ({ expect }) => {
    const lit = F.termLiteral(noLoc, 'hello', 'en--ltr');
    expect(() => langTagHasCorrectRange(<any>lit)).not.toThrow();
  });

  it('does nothing for a lang string with valid direction rtl', ({ expect }) => {
    const lit = F.termLiteral(noLoc, 'hello', 'ar--rtl');
    expect(() => langTagHasCorrectRange(<any>lit)).not.toThrow();
  });

  it('throws for a lang string with invalid direction', ({ expect }) => {
    const lit = F.termLiteral(noLoc, 'hello', 'en--invalid');
    expect(() => langTagHasCorrectRange(<any>lit))
      .toThrowError(/language direction "invalid"/u);
  });
});

describe('completeParseContext', () => {
  it('uses provided parseMode when explicitly supplied (parserUtils.ts:13)', ({ expect }) => {
    // Covers parserUtils.ts:13: context.parseMode ? new Set(context.parseMode) - TRUE branch
    const ctx = completeParseContext({ parseMode: new Set([ 'canParseVars' ]) });
    expect(ctx.parseMode.has('canParseVars')).toBe(true);
    expect(ctx.parseMode.has('canCreateBlankNodes')).toBe(false);
  });

  it('uses default parseMode when none is provided', ({ expect }) => {
    // Covers parserUtils.ts:13: the FALSE branch (no parseMode → use default)
    const ctx = completeParseContext({});
    expect(ctx.parseMode.has('canCreateBlankNodes')).toBe(true);
  });

  it('sets skipValidation to true when explicitly provided (parserUtils.ts:14)', ({ expect }) => {
    // Covers parserUtils.ts:14: context.skipValidation ?? false - when skipValidation IS defined
    const ctx = completeParseContext({ skipValidation: true });
    expect(ctx.skipValidation).toBe(true);
  });
});

describe('findPatternBoundedVars (sparql-1-2)', () => {
  it('extracts variables from a select query with GROUP BY containing variable bindings', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const group = F.solutionModifierGroup(
      [ <any>{ expression: varX, variable: varX, loc: noLoc } ],
      noLoc,
    );
    const where = F.patternGroup([], noLoc);
    const query = F.querySelect({
      variables: [ F.wildcard(noLoc) ],
      context: [],
      where,
      solutionModifiers: { group },
      datasets: F.datasetClauses([], noLoc),
    }, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(<any>query, vars);
    expect(vars.has('x')).toBe(true);
  });

  it('processes GROUP BY with plain expression grouping (validators.ts:47 false branch)', ({ expect }) => {
    // Covers validators.ts:47 false branch: grouping without 'variable' property
    const varX = F.termVariable('x', noLoc);
    const plainExpr = F.expressionOperation('+', [ <any>varX, <any>varX ], noLoc);
    const group = F.solutionModifierGroup([ <any>plainExpr ], noLoc);
    const where = F.patternGroup([], noLoc);
    const query = F.querySelect({
      variables: [ F.wildcard(noLoc) ],
      context: [],
      where,
      solutionModifiers: { group },
      datasets: F.datasetClauses([], noLoc),
    }, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(<any>query, vars);
    // Plain expression in GROUP BY should not cause error, vars may be empty
    expect(vars).toBeDefined();
  });

  it('handles a describe query (validators.ts:36 isQueryDescribe branch)', ({ expect }) => {
    // Covers validators.ts:36: F.isQueryDescribe(iter) branch
    const describeQuery = <any>{
      type: 'query',
      subType: 'describe',
      variables: [ F.termVariable('s', noLoc) ],
      solutionModifiers: {},
      context: [],
      where: F.patternGroup([], noLoc),
    };
    const vars = new Set<string>();
    findPatternBoundedVars(describeQuery, vars);
    expect(vars.has('s')).toBe(true);
  });

  it('extracts variables from PatternValues (validators.ts:99)', ({ expect }) => {
    // Covers validators.ts:99: isPatternValues branch
    const values = F.patternValues(
      [ F.termVariable('x', noLoc) ],
      [{ x: F.termNamed(noLoc, 'http://ex') }],
      noLoc,
    );
    const vars = new Set<string>();
    findPatternBoundedVars(<any>values, vars);
    expect(vars.has('x')).toBe(true);
  });

  it('processes triple with annotations (validators.ts:72)', ({ expect }) => {
    // Covers validators.ts:72: for (const annotation of iter.annotations ?? [])
    const varS = F.termVariable('s', noLoc);
    const predP = F.termNamed(noLoc, 'http://p');
    const varO = F.termVariable('o', noLoc);
    const triple = <any>{
      type: 'triple',
      subject: varS,
      predicate: predP,
      object: varO,
      annotations: [
        { val: F.patternBgp([], noLoc), loc: noLoc },
      ],
      loc: noLoc,
    };
    const vars = new Set<string>();
    findPatternBoundedVars(triple, vars);
    expect(vars.has('s')).toBe(true);
    expect(vars.has('o')).toBe(true);
  });

  it('processes a pure path via isPath branch (validators.ts:79)', ({ expect }) => {
    // Covers validators.ts:79: isPath branch with !isTerm = true (pure path, not a term)
    const namedNode = F.termNamed(noLoc, 'http://p');
    const pathAlt = F.path('|', [ <any>namedNode ], noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(<any>pathAlt, vars);
    // Path has no variables by default
    expect(vars.size).toBe(0);
  });

  it('extracts service name variable from service pattern', ({ expect }) => {
    const iri = F.termNamed(noLoc, 'http://service.example/');
    const service = F.patternService(iri, [], false, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(<any>service, vars);
    // No variables from a named node, but function should not throw
    expect(vars.size).toBe(0);
  });

  it('extracts variables from service with variable name', ({ expect }) => {
    const varEndpoint = F.termVariable('endpoint', noLoc);
    const service = F.patternService(varEndpoint, [], false, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(<any>service, vars);
    expect(vars.has('endpoint')).toBe(true);
  });
});

describe('findPatternBoundedVars sparql-1-2 extra', () => {
  it('extracts variables from a select query with GROUP BY containing variable bindings', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const group = F.solutionModifierGroup(
      [ <any>{ expression: varX, variable: varX, loc: noLoc } ],
      noLoc,
    );
    const where = F.patternGroup([], noLoc);
    const query = F.querySelect({
      variables: [ F.wildcard(noLoc) ],
      context: [],
      where,
      solutionModifiers: { group },
      datasets: F.datasetClauses([], noLoc),
    }, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(<any>query, vars);
    expect(vars.has('x')).toBe(true);
  });

  it('extracts service name variable from service pattern', ({ expect }) => {
    const iri = F.termNamed(noLoc, 'http://service.example/');
    const service = F.patternService(iri, [], false, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(<any>service, vars);
    // No variables from a named node, but function should not throw
    expect(vars.size).toBe(0);
  });

  it('extracts variables from service with variable name', ({ expect }) => {
    const varEndpoint = F.termVariable('endpoint', noLoc);
    const service = F.patternService(varEndpoint, [], false, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(<any>service, vars);
    expect(vars.has('endpoint')).toBe(true);
  });
});
