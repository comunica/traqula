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

  describe('stringEscapedLexical escape sequences in rdfLiteral gImpl', () => {
    function roundTrip(sparql: string): string {
      const ast = parser.parse(sparql);
      return generator.generate(F.forcedAutoGenTree(ast));
    }

    it('escapes tab character (\\t)', ({ expect }) => {
      const result = roundTrip('SELECT * WHERE { ?s ?p "\\t" }');
      expect(result).toContain('"\\t"');
    });

    it('escapes carriage return character (\\r)', ({ expect }) => {
      const result = roundTrip('SELECT * WHERE { ?s ?p "\\r" }');
      expect(result).toContain('"\\r"');
    });

    it('escapes backspace character (\\b)', ({ expect }) => {
      const result = roundTrip('SELECT * WHERE { ?s ?p "\\b" }');
      expect(result).toContain('"\\b"');
    });

    it('escapes form feed character (\\f)', ({ expect }) => {
      const result = roundTrip('SELECT * WHERE { ?s ?p "\\f" }');
      expect(result).toContain('"\\f"');
    });
  });

  describe('argList gImpl with DISTINCT', () => {
    it('generates DISTINCT keyword in function call arguments', ({ expect }) => {
      const ast = parser.parse(
        'SELECT * WHERE { FILTER(<http://ex.org/func>(DISTINCT ?x)) }',
        { parseMode: new Set([ 'canParseVars', 'canCreateBlankNodes', 'canParseAggregate' ]) },
      );
      const result = generator.generate(F.forcedAutoGenTree(ast));
      expect(result).toContain('DISTINCT');
      expect(result).toContain('<http://ex.org/func>');
    });
  });

  describe('update gImpl with multiple operations', () => {
    it('generates multiple update operations separated by semicolons', ({ expect }) => {
      const ast = parser.parse(
        'INSERT DATA { <http://s> <http://p> <http://o> } ; DELETE DATA { <http://s2> <http://p2> <http://o2> }',
      );
      const result = generator.generate(F.forcedAutoGenTree(ast));
      expect(result).toContain(';');
      expect(result).toContain('INSERT DATA');
      expect(result).toContain('DELETE DATA');
    });
  });

  describe('groupOrUnionGraphPattern gImpl with non-union pattern (whereClause line 499)', () => {
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
      expect(result).toContain('?s');
      expect(result).toContain('?p');
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
});
