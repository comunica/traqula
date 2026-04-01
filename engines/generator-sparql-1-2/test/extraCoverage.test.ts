import { Parser } from '@traqula/parser-sparql-1-2';
import { AstFactory, completeGeneratorContext } from '@traqula/rules-sparql-1-2';
import { beforeEach, describe, it } from 'vitest';
import { Generator, sparql12GeneratorBuilder } from '../lib/index.js';

describe('extra generator-sparql-1-2 coverage', () => {
  const F = new AstFactory();
  const generator = new Generator();
  const parser = new Parser({
    lexerConfig: { positionTracking: 'full' },
    defaultContext: { astFactory: F },
  });

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  function roundTrip(sparql: string): string {
    const ast = parser.parse(sparql);
    return generator.generate(F.forcedAutoGenTree(ast));
  }

  describe('versionDecl gImpl (grammar.ts lines 44-46)', () => {
    it('generates VERSION declaration', ({ expect }) => {
      const result = roundTrip('VERSION "1.2" SELECT * WHERE { ?s ?p ?o }');
      expect(result).toContain('VERSION');
      expect(result).toContain('1.2');
    });
  });

  describe('prologue gImpl version branch (grammar.ts lines 88-89)', () => {
    it('generates prologue with VERSION context definition', ({ expect }) => {
      const result = roundTrip('VERSION "1.1" PREFIX ex: <http://example.org/> SELECT * WHERE { ?s ?p ?o }');
      expect(result).toContain('VERSION');
      expect(result).toContain('PREFIX');
    });
  });

  describe('reifiedTriple gImpl (grammar.ts line 433)', () => {
    it('generates a reified triple with explicit reifier', ({ expect }) => {
      const result = roundTrip('SELECT * WHERE { << ?s ?p ?o ~?id >> ?pred ?obj }');
      expect(result).toContain('<<');
      expect(result).toContain('>>');
      expect(result).toContain('~');
    });

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

  describe('unaryExpression UPLUS and UMINUS (grammar.ts line 719)', () => {
    it('parses FILTER with unary plus operator', ({ expect }) => {
      const result = parser.parse('SELECT * WHERE { FILTER(+?x > 0) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });

    it('parses FILTER with unary minus on a variable', ({ expect }) => {
      const result = parser.parse('SELECT * WHERE { FILTER(-?x < 0) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
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

describe('extra generator-sparql-1-2 coverage (part 2)', () => {
  const F = new AstFactory();
  const generator = new Generator();
  const parser = new Parser({
    lexerConfig: { positionTracking: 'full' },
    defaultContext: { astFactory: F },
  });

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  function roundTrip(sparql: string): string {
    const ast = parser.parse(sparql);
    return generator.generate(F.forcedAutoGenTree(ast));
  }

  describe('reifiedTriple without explicit reifier (grammar.ts:145 - reifier ?? termBlank)', () => {
    it('generates reified triple where reifier is auto-generated blank node', ({ expect }) => {
      // Covers grammar.ts:145: reifier ?? C.astFactory.termBlank(...) when reifier is undefined
      // A reified triple annotation with no explicit ~id uses a blank node
      const result = roundTrip('SELECT * WHERE { << ?s ?p ?o >> ?pred ?obj }');
      expect(result).toContain('<<');
      expect(result).toContain('>>');
    });
  });

  describe('unaryExpression gImpl with UPLUS in SPARQL 1.2 (grammar.ts:720)', () => {
    it('generates unary plus operator in SPARQL 1.2', ({ expect }) => {
      // Covers grammar.ts:720: operator.image === '+' → 'UPLUS' in gImpl (TRUE branch)
      const result = roundTrip('SELECT * WHERE { FILTER(+?x > 0) }');
      expect(result).toContain('+');
    });

    it('generates unary minus operator in SPARQL 1.2 (grammar.ts:720 FALSE branch)', ({ expect }) => {
      // Covers grammar.ts:720: operator.image !== '+' → 'UMINUS' (FALSE branch)
      const result = roundTrip('SELECT * WHERE { FILTER(-?x < 0) }');
      expect(result).toContain('-');
    });
  });
});

describe('extra generator-sparql-1-2 coverage (reifier without id)', () => {
  const F = new AstFactory();
  const parser = new Parser({
    lexerConfig: { positionTracking: 'full' },
    defaultContext: { astFactory: F },
  });

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  describe('reifier impl with no id (grammar.ts:145 ?? branch)', () => {
    it('parses reified triple with tilde but no explicit reifier id', ({ expect }) => {
      // Covers grammar.ts:145: reifier ?? termBlank(...) when reifier is undefined
      // Syntax: << subject predicate object ~ >> means tilde present but no explicit id
      const ast = parser.parse('SELECT * WHERE { << ?s <http://p> ?o ~ >> <http://pred> ?obj }');
      expect(ast).toBeDefined();
      expect(ast.type).toBe('query');
    });
  });
});
