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

  function autoGen(sparql: string): string {
    const ast = parser.parse(sparql);
    return generator.generate(F.forcedAutoGenTree(ast));
  }

  describe('stringEscapedLexical escape sequences in rdfLiteral gImpl', () => {
    it('escapes tab character (\\t)', ({ expect }) => {
      const result = autoGen('SELECT * WHERE { ?s ?p "\\t" }');
      expect(result).toContain('"\\t"');
    });

    it('escapes carriage return character (\\r)', ({ expect }) => {
      const result = autoGen('SELECT * WHERE { ?s ?p "\\r" }');
      expect(result).toContain('"\\r"');
    });

    it('escapes backspace character (\\b)', ({ expect }) => {
      const result = autoGen('SELECT * WHERE { ?s ?p "\\b" }');
      expect(result).toContain('"\\b"');
    });

    it('escapes form feed character (\\f)', ({ expect }) => {
      const result = autoGen('SELECT * WHERE { ?s ?p "\\f" }');
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

  describe('iriOrFunction gImpl with TermNamed (expression.ts line 466)', () => {
    it('generates a bare IRI via iriOrFunction rule directly', ({ expect }) => {
      const rawGenerator = sparql11GeneratorBuilder.build();
      const context = completeGeneratorContext({ astFactory: F });
      const iri = F.termNamed(F.gen(), 'http://example.org/type');
      const result = rawGenerator.iriOrFunction(iri, context);
      expect(result).toContain('http://example.org/type');
    });
  });

  describe('rdfLiteral gImpl with non-materialized type (literals.ts line 79)', () => {
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

  describe('lOAD SILENT gImpl (updateUnit.ts line 184)', () => {
    it('generates LOAD SILENT operation', ({ expect }) => {
      const ast = parser.parse('LOAD SILENT <http://ex.org/>');
      const result = generator.generate(F.forcedAutoGenTree(ast));
      expect(result).toContain('LOAD');
      expect(result).toContain('SILENT');
    });
  });

  describe('aDD SILENT gImpl (updateUnit.ts line 282)', () => {
    it('generates ADD SILENT operation', ({ expect }) => {
      const ast = parser.parse('ADD SILENT <http://g1> TO <http://g2>');
      const result = generator.generate(F.forcedAutoGenTree(ast));
      expect(result).toContain('ADD');
      expect(result).toContain('SILENT');
    });
  });

  describe('prologue gImpl with BASE declaration (general.ts:34)', () => {
    it('generates BASE declaration from prologue', ({ expect }) => {
      // Covers general.ts:34: isContextDefinitionBase in prologue gImpl
      const result = autoGen('BASE <http://base.example.org/> SELECT * WHERE { ?s ?p ?o }');
      expect(result).toContain('BASE');
      expect(result).toContain('http://base.example.org/');
    });
  });

  describe('graphTerm with blank node (general.ts:162)', () => {
    it('generates a blank node in subject position (graphTerm gImpl)', ({ expect }) => {
      // Covers general.ts:162: else if (F.isTermBlank(ast)) in graphTerm gImpl
      const result = autoGen('SELECT * WHERE { _:b1 ?p ?o }');
      expect(result).toContain('_:');
    });
  });

  describe('queryUnit gImpl for ASK queries (queryUnit.ts:73)', () => {
    it('generates an ASK query', ({ expect }) => {
      // Covers queryUnit.ts:73: else if (F.isQueryAsk(ast)) in queryUnit gImpl
      const result = autoGen('ASK { ?s ?p ?o }');
      expect(result).toContain('ASK');
    });
  });

  describe('queryUnit gImpl with values clause (queryUnit.ts:76)', () => {
    it('generates a query with VALUES at the end', ({ expect }) => {
      // Covers queryUnit.ts:76-78: if (ast.values) → SUBRULE(inlineData, ...)
      const result = autoGen('SELECT * WHERE { ?s ?p ?o } VALUES ?x { <http://ex> }');
      expect(result).toContain('VALUES');
    });
  });

  describe('expression gImpl with aggregate (expression.ts:127)', () => {
    it('generates an aggregate expression in SELECT clause', ({ expect }) => {
      // Covers expression.ts:127: isExpressionAggregate branch in expression gImpl (via selectQuery)
      const result = autoGen('SELECT (COUNT(?s) AS ?cnt) WHERE { ?s ?p ?o }');
      expect(result).toContain('COUNT');
    });
  });

  describe('unaryExpression gImpl with UPLUS (expression.ts:398)', () => {
    it('generates unary plus operator', ({ expect }) => {
      // Covers expression.ts:398: operator.image === '+' → 'UPLUS' in gImpl
      const result = autoGen('SELECT * WHERE { FILTER(+?x > 0) }');
      expect(result).toContain('+');
    });
  });

  describe('queryOrUpdate gImpl for update branch (index.ts:79)', () => {
    it('generates an update via the queryOrUpdate gImpl', ({ expect }) => {
      // Covers index.ts:79 else branch: F.isQuery is false → SUBRULE(update, ast)
      const rawGenerator = sparql11GeneratorBuilder.build();
      const context = completeGeneratorContext({ astFactory: F });
      const ast = parser.parse('INSERT DATA { <http://s> <http://p> <http://o> }');
      const result = rawGenerator.queryOrUpdate(<any>ast, context);
      expect(result).toContain('INSERT DATA');
    });
  });

  describe('graphRefAll gImpl with NAMED (updateUnit.ts:564)', () => {
    it('generates DROP NAMED', ({ expect }) => {
      // Covers updateUnit.ts:564: isGraphRefNamed branch in graphRefAll gImpl
      const result = autoGen('DROP NAMED');
      expect(result).toContain('DROP');
      expect(result).toContain('NAMED');
    });
  });

  describe('dELETE WHERE gImpl (updateUnit.ts:367)', () => {
    it('generates DELETE WHERE operation', ({ expect }) => {
      // Covers updateUnit.ts:367: deletewhere subType in insertDeleteDelWhere gImpl
      const result = autoGen('DELETE WHERE { ?s ?p ?o }');
      expect(result).toContain('DELETE WHERE');
    });
  });

  describe('collectionPath gImpl (tripleBlock.ts:341)', () => {
    it('generates a collection path as subject', ({ expect }) => {
      // Covers tripleBlock.ts:341: allowPaths=true branch in collectionImpl gImpl
      const result = autoGen('SELECT * WHERE { (<http://a> <http://b>) <http://p> ?o }');
      expect(result).toContain('(');
      expect(result).toContain(')');
    });
  });

  describe('triplesNodePath gImpl (tripleBlock.ts:363-364)', () => {
    it('generates a blank node property list path', ({ expect }) => {
      // Covers tripleBlock.ts:363-364: triplesNodePath gImpl dispatch
      const result = autoGen('SELECT * WHERE { [ <http://p> ?o ] <http://p2> ?o2 }');
      expect(result).toContain('[');
      expect(result).toContain(']');
    });
  });

  describe('graphQuads gImpl with empty triples template (updateUnit.ts:628)', () => {
    it('generates a GRAPH block with empty triples in INSERT DATA', ({ expect }) => {
      // Covers updateUnit.ts:628: triples ?? patternBgp([]) when empty
      const ast = parser.parse('INSERT DATA { GRAPH <http://g> { } }');
      const result = generator.generate(F.forcedAutoGenTree(ast));
      expect(result).toContain('GRAPH');
      expect(result).toContain('<http://g>');
    });
  });
});

describe('extra generator coverage 2', () => {
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

  describe('iriOrFunction gImpl with TermNamed (expression.ts line 466)', () => {
    it('generates a bare IRI via iriOrFunction rule directly', ({ expect }) => {
      const rawGenerator = sparql11GeneratorBuilder.build();
      const context = completeGeneratorContext({ astFactory: F });
      const iri = F.termNamed(F.gen(), 'http://example.org/type');
      const result = rawGenerator.iriOrFunction(iri, context);
      expect(result).toContain('http://example.org/type');
    });
  });

  describe('rdfLiteral gImpl with non-materialized type (literals.ts line 79)', () => {
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

  describe('lOAD SILENT gImpl (updateUnit.ts line 184)', () => {
    it('generates LOAD SILENT operation', ({ expect }) => {
      const ast = parser.parse('LOAD SILENT <http://ex.org/>');
      const result = generator.generate(F.forcedAutoGenTree(ast));
      expect(result).toContain('LOAD');
      expect(result).toContain('SILENT');
    });
  });

  describe('aDD SILENT gImpl (updateUnit.ts line 282)', () => {
    it('generates ADD SILENT operation', ({ expect }) => {
      const ast = parser.parse('ADD SILENT <http://g1> TO <http://g2>');
      const result = generator.generate(F.forcedAutoGenTree(ast));
      expect(result).toContain('ADD');
      expect(result).toContain('SILENT');
    });
  });
});
