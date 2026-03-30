import { describe, it } from 'vitest';
import { AstFactory, findPatternBoundedVars, langTagHasCorrectRange } from '../lib/index.js';

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
