import { Parser } from '@traqula/parser-sparql-1-1';
import { AstFactory, completeGeneratorContext } from '@traqula/rules-sparql-1-1';
import { beforeEach, describe, it } from 'vitest';
import { Generator, sparql11GeneratorBuilder } from '../lib/index.js';

describe('extra generator coverage', () => {
  const generator = new Generator();
  const F = new AstFactory();
  const parser = new Parser({
    lexerConfig: { positionTracking: 'full' },
    defaultContext: { astFactory: F },
  });

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  describe('argList gImpl with DISTINCT', () => {
    it('throws when DISTINCT is used in function call outside aggregate context', ({ expect }) => {
      expect(() =>
        parser.parse(
          'SELECT * WHERE { FILTER(<http://ex.org/func>(DISTINCT ?x)) }',
        )).toThrow(/DISTINCT implies/u);
    });
  });

  describe('groupOrUnionGraphPattern gImpl with non-union pattern', () => {
    it('generates a single group via graphPatternNotTriples rule', ({ expect }) => {
      const rawGenerator = sparql11GeneratorBuilder.build();
      const context = completeGeneratorContext({ astFactory: F });

      const patternGroup = F.patternGroup([
        F.patternBgp([
          F.triple(
            F.termVariable('s', F.gen()),
            F.termVariable('p', F.gen()),
            F.termVariable('o', F.gen()),
          ),
        ], F.gen()),
      ], F.gen());

      const result = rawGenerator.graphPatternNotTriples(patternGroup, context);
      expect(result).toBe(` {
  ?s ?p ?o .
}
`);
    });
  });

  describe('triplesBlock gImpl separator paths', () => {
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

  describe('iriOrFunction gImpl with TermNamed', () => {
    it('generates a bare IRI via iriOrFunction rule directly', ({ expect }) => {
      const rawGenerator = sparql11GeneratorBuilder.build();
      const context = completeGeneratorContext({ astFactory: F });
      const iri = F.termNamed(F.gen(), 'http://example.org/type');
      const result = rawGenerator.iriOrFunction(iri, context);
      expect(result).toContain('http://example.org/type');
    });
  });

  describe('rdfLiteral gImpl with non-materialized type', () => {
    it('generates a typed literal where the type IRI is dematerialized (prints raw value)', ({ expect }) => {
      const rawGenerator = sparql11GeneratorBuilder.build();
      const context = completeGeneratorContext({ astFactory: F });
      const typeIri = F.dematerialized(F.termNamed(F.gen(), 'http://www.w3.org/2001/XMLSchema#integer'));
      const lit = F.termLiteral(F.gen(), '42', typeIri);
      const result = rawGenerator.rdfLiteral(lit, context);
      expect(result).toContain('42');
      expect(result).not.toContain('^^');
    });
  });

  describe('queryOrUpdate gImpl for update branch', () => {
    it('generates an update via the queryOrUpdate gImpl', ({ expect }) => {
      // Covers index.ts:79 else branch: F.isQuery is false → SUBRULE(update, ast)
      const rawGenerator = sparql11GeneratorBuilder.build();
      const context = completeGeneratorContext({ astFactory: F });
      const ast = parser.parse('INSERT DATA { <http://s> <http://p> <http://o> }');
      const result = rawGenerator.queryOrUpdate(<any>ast, context);
      expect(result).toContain('INSERT DATA');
    });
  });
});
