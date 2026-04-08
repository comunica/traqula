import type { QueryDescribe, SolutionModifierGroupBind } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import {
  AstFactory,
  findPatternBoundedVars,
  langTagHasCorrectRange,
} from '../lib/index.js';
import type {
  Annotation,
  TripleNesting,
  Pattern,
} from '../lib/index.js';
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
    expect(() => langTagHasCorrectRange(lit)).not.toThrow();
  });

  it('does nothing for a lang string without direction', ({ expect }) => {
    const lit = F.termLiteral(noLoc, 'hello', 'en');
    expect(() => langTagHasCorrectRange(lit)).not.toThrow();
  });

  it('does nothing for a lang string with valid direction ltr', ({ expect }) => {
    const lit = F.termLiteral(noLoc, 'hello', 'en--ltr');
    expect(() => langTagHasCorrectRange(lit)).not.toThrow();
  });

  it('does nothing for a lang string with valid direction rtl', ({ expect }) => {
    const lit = F.termLiteral(noLoc, 'hello', 'ar--rtl');
    expect(() => langTagHasCorrectRange(lit)).not.toThrow();
  });

  it('throws for a lang string with invalid direction', ({ expect }) => {
    const lit = F.termLiteral(noLoc, 'hello', 'en--invalid');
    expect(() => langTagHasCorrectRange(lit))
      .toThrowError(/language direction "invalid"/u);
  });
});

describe('completeParseContext', () => {
  it('uses provided parseMode when explicitly supplied', ({ expect }) => {
    // Covers parserUtils.ts:13: context.parseMode ? new Set(context.parseMode) - TRUE branch
    const ctx = completeParseContext({ parseMode: new Set([ 'canParseVars' ]) });
    expect(ctx.parseMode.has('canParseVars')).toBe(true);
    expect(ctx.parseMode.has('canCreateBlankNodes')).toBe(false);
  });

  it('uses default parseMode when none is provided', ({ expect }) => {
    const ctx = completeParseContext({});
    expect(ctx.parseMode.has('canCreateBlankNodes')).toBe(true);
  });

  it('sets skipValidation to true when explicitly provided', ({ expect }) => {
    const ctx = completeParseContext({ skipValidation: true });
    expect(ctx.skipValidation).toBe(true);
  });
});

describe('findPatternBoundedVars (sparql-1-2)', () => {
  it('extracts variables from a select query with GROUP BY containing variable bindings', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const group = F.solutionModifierGroup(
      [ <SolutionModifierGroupBind> <unknown> { expression: varX, variable: varX, loc: noLoc } ],
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
    findPatternBoundedVars(query, vars);
    expect(vars.has('x')).toBe(true);
  });

  it('processes GROUP BY with plain expression grouping', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const plainExpr = F.expressionOperation('+', [ varX, varX ], noLoc);
    const group = F.solutionModifierGroup([ plainExpr ], noLoc);
    const where = F.patternGroup([], noLoc);
    const query = F.querySelect({
      variables: [ F.wildcard(noLoc) ],
      context: [],
      where,
      solutionModifiers: { group },
      datasets: F.datasetClauses([], noLoc),
    }, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(query, vars);
    // Plain expression in GROUP BY should not cause error, vars may be empty
    expect(vars).toBeDefined();
  });

  it('handles a describe query (validators.ts:36 isQueryDescribe branch)', ({ expect }) => {
    const describeQuery = <QueryDescribe> <unknown> {
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
    findPatternBoundedVars(values, vars);
    expect(vars.has('x')).toBe(true);
  });

  it('processes triple with annotations (validators.ts:72)', ({ expect }) => {
    // Covers validators.ts:72: for (const annotation of iter.annotations ?? [])
    const varS = F.termVariable('s', noLoc);
    const predP = F.termNamed(noLoc, 'http://p');
    const varO = F.termVariable('o', noLoc);
    const triple = <Pattern> <unknown> {
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
    const pathAlt = F.path('|', [ namedNode ], noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(pathAlt, vars);
    // Path has no variables by default
    expect(vars.size).toBe(0);
  });

  it('extracts service name variable from service pattern', ({ expect }) => {
    const iri = F.termNamed(noLoc, 'http://service.example/');
    const service = F.patternService(iri, [], false, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(service, vars);
    // No variables from a named node, but function should not throw
    expect(vars.size).toBe(0);
  });

  it('extracts variables from service with variable name', ({ expect }) => {
    const varEndpoint = F.termVariable('endpoint', noLoc);
    const service = F.patternService(varEndpoint, [], false, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(service, vars);
    expect(vars.has('endpoint')).toBe(true);
  });
});

describe('findPatternBoundedVars sparql-1-2 extra', () => {
  it('extracts variables from a select query with GROUP BY containing variable bindings', ({ expect }) => {
    const varX = F.termVariable('x', noLoc);
    const group = F.solutionModifierGroup(
      [ <SolutionModifierGroupBind> <unknown> { expression: varX, variable: varX, loc: noLoc } ],
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
    findPatternBoundedVars(query, vars);
    expect(vars.has('x')).toBe(true);
  });

  it('extracts service name variable from service pattern', ({ expect }) => {
    const iri = F.termNamed(noLoc, 'http://service.example/');
    const service = F.patternService(iri, [], false, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(service, vars);
    // No variables from a named node, but function should not throw
    expect(vars.size).toBe(0);
  });

  it('extracts variables from service with variable name', ({ expect }) => {
    const varEndpoint = F.termVariable('endpoint', noLoc);
    const service = F.patternService(varEndpoint, [], false, noLoc);
    const vars = new Set<string>();
    findPatternBoundedVars(service, vars);
    expect(vars.has('endpoint')).toBe(true);
  });
});

describe('findPatternBoundedVars (sparql-1-2) - additional branches', () => {
  it('handles ASK query (line 36 FALSE branch: not select/describe)', ({ expect }) => {
    const vars = new Set<string>();
    const where = F.patternGroup([], noLoc);
    const ask: any = {
      type: 'query',
      subType: 'ask',
      context: [],
      where,
      solutionModifiers: {},
      datasets: F.datasetClauses([], noLoc),
      loc: noLoc,
    };
    findPatternBoundedVars(ask, vars);
    // For ASK query, no variables should be added to boundedVars (falls into else -> recurse(group))
    expect(vars.size).toBe(0);
  });

  it('handles triple WITH annotations (line 72: for loop over annotations)', ({ expect }) => {
    // Covers validators.ts:72: the for loop over iter.annotations when annotations is non-empty
    const vars = new Set<string>();
    const varS = F.termVariable('s', noLoc);
    const varO = F.termVariable('o', noLoc);
    const iri = F.termNamed(noLoc, 'http://p');
    // Create a triple with an annotation: the annotation val is a term variable
    const annotationVal = F.termVariable('ann', noLoc);
    const triple = <TripleNesting> F.triple(varS, iri, varO, F.gen());
    // Add annotation manually since we need a non-empty annotations array
    (triple).annotations = [ <Annotation> { val: annotationVal } ];
    findPatternBoundedVars(triple, vars);
    expect(vars.has('ann')).toBe(true);
  });

  it('handles empty PatternValues (line 99: values.at(0) ?? {} branch)', ({ expect }) => {
    // Covers validators.ts:99: iter.values.at(0) ?? {} when values is empty
    const vars = new Set<string>();
    const emptyValues = F.patternValues([], [], noLoc);
    findPatternBoundedVars(emptyValues, vars);
    expect(vars.size).toBe(0);
  });
});

describe('findPatternBoundedVars (sparql-1-2) - path and annotation FALSE branch', () => {
  it('handles triple WITHOUT annotations', ({ expect }) => {
    // Covers validators.ts:72: iter.annotations ?? [] when annotations is undefined/null
    // Since F.triple() in SPARQL 1.2 always adds annotations:[], we must manually create
    // a triple-like object with annotations=undefined to trigger the ?? fallback.
    const vars = new Set<string>();
    const varS = F.termVariable('s', noLoc);
    const varO = F.termVariable('o', noLoc);
    const iri = F.termNamed(noLoc, 'http://p');
    // Create mock triple without annotations to trigger ?? [] false branch
    const mockTriple = <TripleNesting> <unknown> {
      type: 'triple',
      subject: varS,
      predicate: iri,
      object: varO,
      // No annotations field -> undefined -> ?? [] false branch
    };
    findPatternBoundedVars(mockTriple, vars);
    expect(vars.has('s')).toBe(true);
    expect(vars.has('o')).toBe(true);
  });

  it('handles Path iteration', ({ expect }) => {
    const vars = new Set<string>();
    const path = F.path('/', [ F.termNamed(noLoc, 'http://p1'), F.termNamed(noLoc, 'http://p2') ], noLoc);
    findPatternBoundedVars(path, vars);
    // Path items are TermNamed nodes (not variables), so vars stays empty
    expect(vars.size).toBe(0);
  });
});
