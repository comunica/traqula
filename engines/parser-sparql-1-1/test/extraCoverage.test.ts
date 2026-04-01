import { AstFactory, completeParseContext, lex } from '@traqula/rules-sparql-1-1';
import { beforeEach, describe, it } from 'vitest';
import { Parser, sparql11ParserBuilder } from '../lib/index.js';

describe('extra parser coverage', () => {
  const F = new AstFactory();
  const parser = new Parser({ defaultContext: { astFactory: F }});

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  describe('updateUnit rule (direct invocation)', () => {
    const rawParser = sparql11ParserBuilder.build({
      tokenVocabulary: lex.sparql11LexerBuilder.tokenVocabulary,
    });

    it('parses a single update operation via updateUnit rule', ({ expect }) => {
      const context = completeParseContext({ astFactory: F, parseMode: new Set([ 'canCreateBlankNodes' ]) });
      const result = rawParser.updateUnit('INSERT DATA { <http://s> <http://p> <http://o> }', context);
      expect(result).toBeDefined();
      expect(result.type).toBe('update');
    });

    it('parses multiple update operations via updateUnit rule', ({ expect }) => {
      const context = completeParseContext({ astFactory: F, parseMode: new Set([ 'canCreateBlankNodes' ]) });
      const result = rawParser.updateUnit(
        'INSERT DATA { <http://s> <http://p> <http://o> } ; DELETE DATA { <http://s2> <http://p2> <http://o2> }',
        context,
      );
      expect(result.type).toBe('update');
      expect(result.updates.length).toBe(2);
    });
  });

  describe('argList NIL case (empty function arguments)', () => {
    it('parses a function call with no arguments (NIL argList)', ({ expect }) => {
      const result = parser.parse('SELECT * WHERE { FILTER(<http://ex.org/func>()) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('duplicate SELECT clause variables', () => {
    it('throws when the same variable appears twice in SELECT', ({ expect }) => {
      expect(() => parser.parse('SELECT ?s ?s WHERE { ?s ?p ?o }')).toThrow(
        /Variable s used more than once in SELECT clause/u,
      );
    });

    it('throws when the same variable is bound twice via AS in SELECT', ({ expect }) => {
      expect(() => parser.parse('SELECT (?p AS ?s) (?o AS ?s) WHERE { ?s ?p ?o }')).toThrow(
        /Variable s used more than once in SELECT clause/u,
      );
    });
  });

  describe('distinct in non-aggregate function call', () => {
    it('throws when DISTINCT is used in a non-aggregate function call', ({ expect }) => {
      expect(() => parser.parse('SELECT * WHERE { FILTER(<http://ex.org/func>(DISTINCT ?x)) }'))
        .toThrow(/DISTINCT implies that this function is an aggregated function/u);
    });
  });

  describe('funcExprOrNil1 nil case (expressionHelpers.ts line 109)', () => {
    it('parses BNODE() with no arguments (NIL token)', ({ expect }) => {
      const result = parser.parse('SELECT * WHERE { FILTER(BNODE() = ?x) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('funcExpr3or4 four-arg case (expressionHelpers.ts line 199)', () => {
    it('parses REPLACE with four arguments', ({ expect }) => {
      const result = parser.parse('SELECT * WHERE { FILTER(REPLACE(?s, "x", "y", "i") = ?s) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('funcExpr3or4 three-arg case (expressionHelpers.ts line 201 else branch)', () => {
    it('parses REPLACE with three arguments', ({ expect }) => {
      // Covers expressionHelpers.ts:201 else branch: arg4 is undefined → 3-arg case
      const result = parser.parse('SELECT * WHERE { FILTER(REPLACE(?s, "x", "y") = ?s) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('additive expression with negative literal (expression.ts line 336)', () => {
    it('parses FILTER with a negative integer multiplicative expression', ({ expect }) => {
      const result = parser.parse('SELECT * WHERE { ?s ?p ?o FILTER(-3 * ?x > 0) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });

    it('parses FILTER with numericLiteralPositive followed by multiply (expression.ts fn85/fn86)', ({ expect }) => {
      // Covers expression.ts line 336: the ACTION callback and inner arrow function in MANY2
      // MUST use "?x +2 * 3" (no preceding opPlus, +2 as integerPositive token adjacent to 2)
      // so MANY1 takes Alt 2, and then MANY2 fires for "* 3"
      const result = parser.parse('SELECT * WHERE { ?s ?p ?o FILTER(?x +2 * 3 > 0) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });

    it(
      'parses FILTER with numericLiteralPositive followed by divide (expression.ts fn85/fn86 via slash)',
      ({ expect }) => {
        // Also covers expression.ts line 336 via / operator
        // "?x +4 / 2" — +4 is integerPositive (adjacent), triggers Alt 2 of MANY1
        const result = parser.parse('SELECT * WHERE { ?s ?p ?o FILTER(?x +4 / 2 > 0) }');
        expect(result).toBeDefined();
        expect(result.type).toBe('query');
      },
    );
  });

  describe('unaryExpression UPLUS (expression.ts line 398)', () => {
    it('parses FILTER with unary plus on a variable', ({ expect }) => {
      // Covers expression.ts:398: operator.image === '+' → 'UPLUS'
      const result = parser.parse('SELECT * WHERE { FILTER(+?x > 0) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('prefixedName with empty local part (literals.ts lines 281-283)', () => {
    it('parses a prefix-only IRI like ex:', ({ expect }) => {
      const result = parser.parse(
        'PREFIX ex: <http://example.org/> SELECT * WHERE { ex: ?p ?o }',
      );
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('quads with triples after GRAPH block (updateUnit.ts line 597)', () => {
    it('parses INSERT DATA with triples after a GRAPH block', ({ expect }) => {
      const result = parser.parse(
        'INSERT DATA { GRAPH <http://g> { <http://s> <http://p> <http://o> } <http://s2> <http://p2> <http://o2> }',
      );
      expect(result).toBeDefined();
      expect(result.type).toBe('update');
    });
  });

  describe('queryUnit valuesClause branch (queryUnit.ts:57)', () => {
    it('parses a query with a VALUES clause at the end', ({ expect }) => {
      // Covers queryUnit.ts:57: ...(values && { values }) TRUE branch
      const result = parser.parse('SELECT * WHERE { ?s ?p ?o } VALUES ?x { <http://ex> }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
      expect((<any>result).values).toBeDefined();
    });
  });

  describe('constructTemplate empty case (queryUnit.ts:460)', () => {
    it('parses CONSTRUCT with empty template', ({ expect }) => {
      // Covers queryUnit.ts:460: triples ?? patternBgp([]) - when triples is undefined
      const result = parser.parse('CONSTRUCT {} WHERE { ?s ?p ?o }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('aggregate outside SELECT context (builtIn.ts:280)', () => {
    it('throws when aggregate is used in a FILTER', ({ expect }) => {
      // Covers builtIn.ts:280: !canParseAggregate → throw
      expect(() => parser.parse('SELECT * WHERE { FILTER(COUNT(?s) > 0) }'))
        .toThrow(/Aggregates are only allowed in SELECT, HAVING, and ORDER BY clauses/u);
    });
  });

  describe('aggregate inside an aggregate (builtIn.ts:283)', () => {
    it('throws when an aggregate contains another aggregate', ({ expect }) => {
      // Covers builtIn.ts:283: inAggregate → throw
      expect(() => parser.parse(
        'SELECT (SUM(COUNT(?s)) AS ?c) WHERE { ?s ?p ?o }',
        { parseMode: new Set([ 'canParseVars', 'canCreateBlankNodes', 'canParseAggregate' ]) },
      )).toThrow(/An aggregate function is not allowed within an aggregate function/u);
    });
  });

  describe('skipValidation in queryOrUpdate (index.ts:79)', () => {
    it('skips blank node re-use validation when skipValidation is true', ({ expect }) => {
      // Covers index.ts:79: if (!C.skipValidation) → false branch when skipValidation=true
      const result = parser.parse(
        'INSERT DATA { _:b1 <http://p> <http://o> } ; INSERT DATA { _:b1 <http://p2> <http://o2> }',
        { skipValidation: true },
      );
      expect(result).toBeDefined();
      expect(result.type).toBe('update');
    });
  });

  describe('updateUnit skipValidation (updateUnit.ts:76)', () => {
    it('skips validation when parsing an update directly with skipValidation', ({ expect }) => {
      // Covers updateUnit.ts:76: if (!C.skipValidation) → false branch
      const rawParser = sparql11ParserBuilder.build({
        tokenVocabulary: lex.sparql11LexerBuilder.tokenVocabulary,
      });
      const context = completeParseContext({
        astFactory: F,
        parseMode: new Set([ 'canCreateBlankNodes' ]),
        skipValidation: true,
      });
      const result = rawParser.updateUnit('INSERT DATA { <http://s> <http://p> <http://o> }', context);
      expect(result).toBeDefined();
    });
  });

  describe('subquery variable collision (validators.ts:125-128)', () => {
    it('throws when AS target variable conflicts with a subquery variable', ({ expect }) => {
      // Covers validators.ts lines 125-128: subquery variable collision check
      expect(() => parser.parse(
        'SELECT (?x AS ?y) WHERE { SELECT ?y WHERE { ?y ?p ?o } }',
      )).toThrow(/Target id of 'AS' \(\?y\) already used in subquery/u);
    });
  });

  describe('patternValues in findPatternBoundedVars (validators.ts:172)', () => {
    it('parses a query with VALUES inside the WHERE clause (inline data)', ({ expect }) => {
      // Covers validators.ts:172: isPatternValues branch in findPatternBoundedVars
      // A SELECT with GROUP BY that forces findPatternBoundedVars to process a VALUES pattern
      const result = parser.parse(
        'SELECT ?x WHERE { VALUES ?x { <http://ex> } } GROUP BY ?x',
      );
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('expressionFactory isExpressionAggregateDefault (factoryMixins:158)', () => {
    it('identifies a default aggregate (non-wildcard single-arg aggregate)', ({ expect }) => {
      // Covers ExpressionFactory.ts:158: isExpressionAggregateDefault check
      const result = parser.parse(
        'SELECT (SUM(?x) AS ?s) WHERE { ?s ?p ?x }',
        { parseMode: new Set([ 'canParseVars', 'canCreateBlankNodes', 'canParseAggregate' ]) },
      );
      expect(result).toBeDefined();
      expect((<any>result).variables[0].expression).toBeDefined();
    });
  });

  describe('pathFactory createPath with negated element (factoryMixins:63)', () => {
    it('parses a negated inverse path !(^<p>)', ({ expect }) => {
      // Covers PathFactory.ts:63: the PathNegatedElt branch
      // !(^<p>) creates a PathNegatedElt
      const result = parser.parse('SELECT * WHERE { ?s !(^<http://p>) ?o }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('updateOperationFactory createModify with undefined insert/delete (factoryMixins:264-265)', () => {
    it('parses DELETE ... WHERE with no INSERT clause', ({ expect }) => {
      // Covers UpdateOperationFactory.ts:264-265: insert ?? [] and delete ?? []
      const result = parser.parse('DELETE { ?s ?p ?o } WHERE { ?s ?p ?o }');
      expect(result).toBeDefined();
      expect(result.type).toBe('update');
    });
  });

  describe('additiveExpression MANY2 loop closure (expression.ts:337)', () => {
    it('parses FILTER with numericLiteralPositive followed by * operator', ({ expect }) => {
      // Covers expression.ts:337: the (leftInner) => ACTION(() => expressionOperation(...)) lambda
      // inside the MANY2 loop of additiveExpression.
      // The MANY2 path is triggered when a numericLiteralPositive (+N, adjacent to digits) is
      // followed by * or / (multiplicative operator).
      // "?x +2 * 3" — '+2' is integerPositive (no space between + and 2, AND appears without
      // a preceding opPlus, so MANY1's Alt 2 is selected, then MANY2 fires for "* 3")
      const result = parser.parse('SELECT * WHERE { FILTER(?x +2 * 3 > 0) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });

    it('parses FILTER with numericLiteralNegative followed by / operator', ({ expect }) => {
      // Covers expression.ts:337: same closure via numericLiteralNegative and /
      // '-3' is integerNegative (no space between - and 3), MANY1 Alt 2
      const result = parser.parse('SELECT * WHERE { FILTER(?x -3 / ?y > 0) }');
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });
});
