import { AstFactory, completeGeneratorContext } from '@traqula/rules-sparql-1-2';
import { beforeEach, describe, it } from 'vitest';
import { Generator, sparql12GeneratorBuilder } from '../lib/index.js';

describe('extra generator-sparql-1-2 coverage', () => {
  const F = new AstFactory();
  const generator = new Generator();

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  describe('reifiedTriple gImpl with path predicate (grammar.ts:433)', () => {
    it('generates a reified triple with path predicate via direct AST construction (grammar.ts:433)', ({ expect }) => {
      // Covers grammar.ts:433: F.isPathPure(triple.predicate) is TRUE
      // Construct a reified triple with a path predicate directly since the parser doesn't allow it
      const rawGenerator = sparql12GeneratorBuilder.build();
      const context = completeGeneratorContext({ astFactory: F });
      const s = F.termVariable('s', F.gen());
      const pathPred = F.path('*', [ F.termNamed(F.gen(), 'http://p') ], F.gen());
      const o = F.termVariable('o', F.gen());
      const reifiedTriple = F.tripleCollectionReifiedTriple(F.gen(), s, <any>pathPred, o);
      const result = rawGenerator.reifiedTriple(reifiedTriple, context);
      expect(result).toContain('<<');
      expect(result).toContain('*');
    });
  });

  describe('generateTriplesBlock separator logic (grammar.ts lines 773, 776-777)', () => {
    it('generates comma separator for same subject and predicate (different objects)', ({ expect }) => {
      const bgp = F.patternBgp([
        F.triple(
          F.termVariable('s', F.gen()),
          F.termVariable('p', F.gen()),
          F.termVariable('o1', F.gen()),
          F.gen(),
        ),
        F.triple(
          F.dematerialized(F.termVariable('s', F.gen())),
          F.dematerialized(F.termVariable('p', F.gen())),
          F.termVariable('o2', F.gen()),
          F.gen(),
        ),
      ], F.gen());

      const query = F.querySelect({
        variables: [ F.wildcard(F.gen()) ],
        datasets: F.datasetClauses([], F.sourceLocation()),
        context: [],
        where: F.patternGroup([ bgp ], F.gen()),
        solutionModifiers: {},
      }, F.gen());

      const result = generator.generate(query);
      expect(result).toContain(',');
    });

    it('generates semicolon separator for same subject with different predicates', ({ expect }) => {
      const bgp = F.patternBgp([
        F.triple(
          F.termVariable('s', F.gen()),
          F.termVariable('p1', F.gen()),
          F.termVariable('o1', F.gen()),
          F.gen(),
        ),
        F.triple(
          F.dematerialized(F.termVariable('s', F.gen())),
          F.termVariable('p2', F.gen()),
          F.termVariable('o2', F.gen()),
          F.gen(),
        ),
      ], F.gen());

      const query = F.querySelect({
        variables: [ F.wildcard(F.gen()) ],
        datasets: F.datasetClauses([], F.sourceLocation()),
        context: [],
        where: F.patternGroup([ bgp ], F.gen()),
        solutionModifiers: {},
      }, F.gen());

      const result = generator.generate(query);
      expect(result).toContain(';');
    });
  });
});
