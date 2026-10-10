import { ParserBuilder } from '@traqula/core';
import { AstFactory, completeParseContext, gram, lex } from '@traqula/rules-sparql-1-2';
import { beforeEach, describe, it } from 'vitest';
import { Parser, sparql12ParserBuilder } from '../lib/index.js';

describe('extra parser-sparql-1-2 coverage', () => {
  const F = new AstFactory({ tracksSourceLocation: false });
  const parser = new Parser({ defaultContext: { astFactory: F }});

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  // TODO(major): remove together with the deprecated S12.selectQuery
  describe('deprecated selectQuery', () => {
    const deprecatedParser = ParserBuilder.create(sparql12ParserBuilder)
      .patchRule(gram.selectQuery)
      .build({ tokenVocabulary: lex.sparql12LexerBuilder.tokenVocabulary });

    it('parses and validates like the SPARQL 1.1 selectQuery', ({ expect }) => {
      const context = completeParseContext({ astFactory: F });
      expect(deprecatedParser.queryOrUpdate('SELECT ?s { ?s ?p ?o }', context))
        .toMatchObject({ subType: 'select' });
      expect(() => deprecatedParser.queryOrUpdate('SELECT (1 AS ?s) { ?s ?p ?o }', context))
        .toThrow(/Target id of 'AS' \(\?s\) is already in scope/u);
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

  describe('reifier without canCreateBlankNodes', () => {
    it('throws when bare ~ reifier is used without canCreateBlankNodes in parse mode', ({ expect }) => {
      expect(() =>
        parser.parse(
          'SELECT * WHERE { ?s ?p ?o . << <http://s> <http://p> <http://o> ~>> <http://p2> <http://o2> }',
          { parseMode: new Set([ 'canParseVars' ]) },
        )).toThrow(/Cannot create blanknodes in current parse mode/u);
    });
  });

  describe('reifiedTriple without canCreateBlankNodes', () => {
    it('throws when reified triple has no reifier and canCreateBlankNodes is absent', ({ expect }) => {
      expect(() =>
        parser.parse(
          'SELECT * WHERE { << <http://s> <http://p> <http://o> >> <http://p2> <http://o2> }',
          { parseMode: new Set([ 'canParseVars' ]) },
        )).toThrow(/Cannot create blanknodes in current parse mode/u);
    });
  });

  describe('tripleTermData with a shortcut predicate', () => {
    it('parses triple term data with a as predicate in VALUES clause', ({ expect }) => {
      const result = parser.parse(
        'SELECT * WHERE {} VALUES ?x { <<( <http://s> a <http://o> )>> }',
      );
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('parsePath returning iri', () => {
    it('parsePath returns iri directly for named node input', ({ expect }) => {
      const result = parser.parsePath('<http://example.org/pred>');
      expect(result).toBeDefined();
      expect((<any>result).type).toBe('term');
    });
  });

  describe('skipValidation in SPARQL 1.2 update', () => {
    it('skips validation when skipValidation is explicitly true', ({ expect }) => {
      const result = parser.parse(
        'INSERT DATA { <http://s> <http://p> <http://o> }',
        { skipValidation: true },
      );
      expect(result).toBeDefined();
      expect(result.type).toBe('update');
    });
  });

  it('throws when a SELECT expression binds a variable of the trailing VALUES', ({ expect }) => {
    expect(() => parser.parse('SELECT (1 AS ?x) WHERE { ?s ?p ?o } VALUES ?x { 1 }'))
      .toThrow(/Target id of 'AS' \(\?x\) is already in scope/u);
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

  it('keeps no variable in scope for a triple term group key', ({ expect }) => {
    expect(parser.parse('SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o } GROUP BY (<<( ?s ?p ?o )>>)'))
      .toMatchObject({ subType: 'select' });
    expect(parser.parse('DESCRIBE ?s WHERE { ?s ?p ?o } GROUP BY ?s (<<( ?s ?p ?o )>>)'))
      .toMatchObject({ subType: 'describe' });
    expect(() => parser.parse('SELECT ?s WHERE { ?s ?p ?o } GROUP BY (<<( ?s ?p ?o )>>)'))
      .toThrow(/Variable not allowed in projection/u);
  });

  describe('skipValidation in SPARQL 1.2 subquery', () => {
    it('does not check subquery projections when skipValidation is true', ({ expect }) => {
      const result = parser.parse(
        'SELECT * WHERE { { SELECT (?o AS ?o) WHERE { ?s ?p ?o } } }',
        { skipValidation: true },
      );
      expect(result).toMatchObject({ subType: 'select' });
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
