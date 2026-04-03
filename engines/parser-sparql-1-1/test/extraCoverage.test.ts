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

  it('throws when DISTINCT is used in a non-aggregate function call', ({ expect }) => {
    expect(() => parser.parse('SELECT * WHERE { FILTER(<http://ex.org/func>(DISTINCT ?x)) }'))
      .toThrow(/DISTINCT implies that this function is an aggregated function/u);
  });

  it('throws when aggregate is used in a FILTER', ({ expect }) => {
    expect(() => parser.parse('SELECT * WHERE { FILTER(COUNT(?s) > 0) }'))
      .toThrow(/Aggregates are only allowed in SELECT, HAVING, and ORDER BY clauses/u);
  });

  it('throws when an aggregate contains another aggregate', ({ expect }) => {
    expect(() => parser.parse(
      'SELECT (SUM(COUNT(?s)) AS ?c) WHERE { ?s ?p ?o }',
    )).toThrow(/An aggregate function is not allowed within an aggregate function/u);
  });

  describe('skipValidation in queryOrUpdate', () => {
    it('skips blank node re-use validation when skipValidation is true', ({ expect }) => {
      const result = parser.parse(
        'INSERT DATA { _:b1 <http://p> <http://o> } ; INSERT DATA { _:b1 <http://p2> <http://o2> }',
        { skipValidation: true },
      );
      expect(result).toBeDefined();
      expect(result.type).toBe('update');
    });
  });

  describe('updateUnit skipValidation', () => {
    it('skips validation when parsing an update directly with skipValidation', ({ expect }) => {
      const rawParser = sparql11ParserBuilder.build({
        tokenVocabulary: lex.sparql11LexerBuilder.tokenVocabulary,
      });
      const context = completeParseContext({ skipValidation: true });
      const result = rawParser.updateUnit('INSERT DATA { <http://s> <http://p> <http://o> }', context);
      expect(result).toBeDefined();
    });
  });

  describe('subquery variable collision', () => {
    it('throws when AS target variable conflicts with a subquery variable', ({ expect }) => {
      expect(() => parser.parse(
        'SELECT (?x AS ?y) WHERE { SELECT ?y WHERE { ?y ?p ?o } }',
      )).toThrow(/Target id of 'AS' \(\?y\) already used in subquery/u);
    });
  });

  describe('expressionFactory isExpressionAggregateDefault', () => {
    it('identifies a default aggregate (non-wildcard single-arg aggregate)', ({ expect }) => {
      const result = parser.parse(
        'SELECT (SUM(?x) AS ?s) WHERE { ?s ?p ?x }',
      );
      expect(result).toBeDefined();
      expect((<any>result).variables[0].expression).toBeDefined();
    });
  });

  describe('queryUnit rule (direct invocation via raw parser)', () => {
    const rawParser = sparql11ParserBuilder.build({
      tokenVocabulary: lex.sparql11LexerBuilder.tokenVocabulary,
    });

    it('parses a SELECT query via queryUnit (no VALUES clause) - covers if(values) false branch', ({ expect }) => {
      const context = completeParseContext({ astFactory: F });
      const result = rawParser.queryUnit('SELECT * WHERE { ?s ?p ?o }', context);
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
      expect((<any>result).values).toBeUndefined();
    });

    it('parses a SELECT query via queryUnit with VALUES clause - covers if(values) true branch', ({ expect }) => {
      const context = completeParseContext({ astFactory: F });
      const result = rawParser.queryUnit('SELECT * WHERE { ?s ?p ?o } VALUES ?x { <http://ex> }', context);
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
      expect((<any>result).values).toBeDefined();
    });
  });
});
