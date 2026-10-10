import { ParserBuilder } from '@traqula/core';
import type { gram } from '@traqula/rules-sparql-1-1';
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

  describe('comments end at a carriage return', () => {
    it('lexes the text after a CR as query text', ({ expect }) => {
      expect(() => parser.parse('# a\r FILTER junk\nASK {}')).toThrow(/unexpected character: ->j<- at offset: 12/u);
    });

    it('accepts CR, CRLF, and LF line endings after a comment', ({ expect }) => {
      expect(parser.parse('# a\rASK {}')).toMatchObject({ subType: 'ask' });
      expect(parser.parse('# a\r\nASK {}')).toMatchObject({ subType: 'ask' });
      expect(parser.parse('# a\nASK {}')).toMatchObject({ subType: 'ask' });
    });

    it('accepts a CR-terminated comment inside a multi-word update keyword', ({ expect }) => {
      expect(parser.parse('INSERT # a\rDATA { <http://s> <http://p> <http://o> }')).toMatchObject({ type: 'update' });
    });
  });

  describe('prefixed names with colons in the local name', () => {
    it('keeps everything after the first colon as local name', ({ expect }) => {
      const query = <any> parser.parse('PREFIX ex: <http://ex.org/> SELECT * WHERE { ex:a:b:c ?p ?o }');
      const subject = query.where.patterns[0].triples[0].subject;
      expect(subject.prefix).toBe('ex');
      expect(subject.value).toBe('a:b:c');
    });

    it('keeps a local name starting with a colon', ({ expect }) => {
      const query = <any> parser.parse('PREFIX : <http://ex.org/> SELECT * WHERE { ::a ?p ?o }');
      const subject = query.where.patterns[0].triples[0].subject;
      expect(subject.prefix).toBe('');
      expect(subject.value).toBe(':a');
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

  it('accepts a variable named twice in VALUES (only SPARQL 1.2 forbids this)', ({ expect }) => {
    expect(() => parser.parse('SELECT * { VALUES (?x ?x) { (1 2) } }')).not.toThrow();
    expect(() => parser.parse('SELECT * { ?s ?p ?o } VALUES (?x ?x) { (1 2) }')).not.toThrow();
  });

  it('names the reused variable when rejecting a variable bound by an earlier select expression', ({ expect }) => {
    expect(() => parser.parse(
      'SELECT (COUNT(*) AS ?c) (?c + 1 AS ?d) WHERE { ?s ?p ?o }',
      { rejectGroupedSelectAliasReuse: true },
    )).toThrow(/Use of variable bound by an earlier select expression \(\?c\) in a grouped query/u);
  });

  it('reports a forward reference to a later select expression in a grouped query as such', ({ expect }) => {
    expect(() => parser.parse('SELECT (?d + 1 AS ?e) (COUNT(*) AS ?d) WHERE { ?s ?p ?o }'))
      .toThrow(/Target id of 'AS' \(\?d\) is used in an earlier select expression/u);
    expect(() => parser.parse('SELECT (?d + 1 AS ?e) (?s AS ?d) WHERE { ?s ?p ?o } GROUP BY ?s'))
      .toThrow(/Target id of 'AS' \(\?d\) is used in an earlier select expression/u);
    expect(() => parser.parse('SELECT (?o AS ?e) (COUNT(*) AS ?d) WHERE { ?s ?p ?o }'))
      .toThrow(/Use of ungrouped variable in projection of operation \(\?o\)/u);
    expect(() => parser.parse('SELECT (?o + 1 AS ?e) ?o WHERE { ?s ?p ?o } GROUP BY ?s'))
      .toThrow(/Use of ungrouped variable in projection of operation \(\?o\)/u);
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
      )).toThrow(/Target id of 'AS' \(\?y\) is already in scope/u);
    });

    it('does not check subquery projections when skipValidation is true', ({ expect }) => {
      const result = parser.parse(
        'SELECT * WHERE { { SELECT (?o AS ?o) WHERE { ?s ?p ?o } } }',
        { skipValidation: true },
      );
      expect(result).toMatchObject({ subType: 'select' });
    });
  });

  describe('validation rules', () => {
    it('can be patched to change a validation', ({ expect }) => {
      const lenientParser = ParserBuilder.create(sparql11ParserBuilder)
        .patchRule(<typeof gram.validateGroupGraphPatternSub> {
          name: 'validateGroupGraphPatternSub',
          impl: () => () => {},
        })
        .build({ tokenVocabulary: lex.sparql11LexerBuilder.tokenVocabulary });
      const query = 'SELECT * { ?s ?p ?o BIND(1 AS ?x) BIND(2 AS ?x) }';
      expect(() => parser.parse(query)).toThrow(/Variable used to bind is already bound/u);
      expect(lenientParser.queryOrUpdate(query, completeParseContext({ astFactory: F })))
        .toMatchObject({ subType: 'select' });
    });
  });

  describe('expressionFactory isExpressionAggregateDefault', () => {
    it('identifies a default aggregate (non-wildcard single-arg aggregate)', ({ expect }) => {
      const result = parser.parse(
        'SELECT (SUM(?x) AS ?sum) WHERE { ?s ?p ?x }',
      );
      expect(result).toMatchObject({ subType: 'select', variables: [{ expression: { aggregation: 'sum' }}]});
    });
  });

  describe('queryUnit rule (direct invocation via raw parser)', () => {
    const rawParser = sparql11ParserBuilder.build({
      tokenVocabulary: lex.sparql11LexerBuilder.tokenVocabulary,
    });

    it('parses a SELECT query via queryUnit (no VALUES clause) - covers if(values) false branch', ({ expect }) => {
      const context = completeParseContext({ astFactory: F });
      const result = rawParser.queryUnit('SELECT * WHERE { ?s ?p ?o }', context);
      expect(result).toMatchObject({ type: 'query', subType: 'select' });
      expect((<any>result).values).toBeUndefined();
    });

    it('parses a SELECT query via queryUnit with VALUES clause - covers if(values) true branch', ({ expect }) => {
      const context = completeParseContext({ astFactory: F });
      const result = rawParser.queryUnit('SELECT * WHERE { ?s ?p ?o } VALUES ?x { <http://ex> }', context);
      expect(result).toMatchObject({ subType: 'select', values: { type: 'pattern', subType: 'values', values: [{ x: { value: 'http://ex' }}]}});
    });

    it('throws via queryUnit when a SELECT expression binds a variable of the trailing VALUES', ({ expect }) => {
      const context = completeParseContext({ astFactory: F });
      expect(() => rawParser.queryUnit('SELECT (1 AS ?x) WHERE { ?s ?p ?o } VALUES ?x { 1 }', context))
        .toThrow(/Target id of 'AS' \(\?x\) is already in scope/u);
    });

    it('parses an ASK query via queryUnit with VALUES clause', ({ expect }) => {
      const context = completeParseContext({ astFactory: F });
      const result = rawParser.queryUnit('ASK WHERE { ?s ?p ?o } VALUES ?x { 1 }', context);
      expect(result).toMatchObject({ subType: 'ask' });
    });
  });

  describe('prototype-key reserved-name bypass (security fix)', () => {
    // Object.prototype property names like 'constructor', 'toString', '__proto__', etc.
    // must not bypass the "Unknown prefix" guard even though they exist on plain {}.
    const protoKeys = [ 'constructor', 'toString', 'hasOwnProperty', 'valueOf' ];

    for (const key of protoKeys) {
      it(`rejects undeclared prefix named '${key}'`, ({ expect }) => {
        expect(() => parser.parse(`SELECT * WHERE { ?s ${key}:foo ?o }`))
          .toThrow(/Unknown prefix/u);
      });
    }

    it('accepts a declared prefix whose name is a prototype key', ({ expect }) => {
      const result = parser.parse('PREFIX constructor: <http://ex.org/> SELECT * WHERE { ?s constructor:foo ?o }');
      expect(result).toMatchObject({ type: 'query', subType: 'select' });
    });
  });
});
