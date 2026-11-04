import { Parser } from '@traqula/parser-sparql-1-2';
import { AstFactory, completeGeneratorContext } from '@traqula/rules-sparql-1-2';
import { beforeEach, describe, it } from 'vitest';
import { Generator, sparql12GeneratorBuilder } from '../lib/index.js';

describe('extra generator-sparql-1-2 coverage', () => {
  const F = new AstFactory();
  const generator = new Generator();

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  describe('reifiedTriple gImpl with path predicate', () => {
    it('generates a reified triple with path predicate via direct AST construction', ({ expect }) => {
      const rawGenerator = sparql12GeneratorBuilder.build();
      const context = completeGeneratorContext({ astFactory: F });
      const s = F.termVariable('s', F.gen());
      const pathPred = F.path('*', [ F.termNamed(F.gen(), 'http://p') ], F.gen());
      const o = F.termVariable('o', F.gen());
      const reifiedTriple = F.tripleCollectionReifiedTriple(F.gen(), s, <any>pathPred, o);
      const result = rawGenerator.reifiedTriple(reifiedTriple, context);
      expect(result).toBe(` << ?s (<http://p>*) ?o >> `);
    });
  });

  describe('generateTriplesBlock separator logic', () => {
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

  describe('expression gImpl with more than two operands', () => {
    const rawGenerator = sparql12GeneratorBuilder.build();
    const parser = new Parser();
    const generateOperation = (operator: string): string => rawGenerator.expression(
      F.expressionOperation(operator, [ 'a', 'b', 'c' ].map(name => F.termVariable(name, F.gen())), F.gen()),
      completeGeneratorContext({ astFactory: F }),
    );

    it.for([ '||', '&&', '+', '=' ])('nests %s left-deep into valid SPARQL', (operator, { expect }) => {
      const result = generateOperation(operator);
      expect(result).toBe(` ( ( ?a ${operator} ?b ) ${operator} ?c ) `);
      expect(() => parser.parse(`SELECT * WHERE { FILTER(${result}) }`)).not.toThrow();
    });

    it('keeps the argument list of IN', ({ expect }) => {
      expect(generateOperation('in')).toBe(' ( ?a IN ( ?b , ?c ) ) ');
    });
  });
});
