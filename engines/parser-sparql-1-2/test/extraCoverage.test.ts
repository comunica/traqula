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

  it('accepts a triple-term expression whose variables are all grouped', ({ expect }) => {
    expect(parser.parse('SELECT (<<( ?s ?p ?o )>> AS ?t) WHERE { ?s ?p ?o } GROUP BY ?s ?p ?o'))
      .toMatchObject({ subType: 'select' });
  });

  it('throws via queryUnit when a SELECT expression binds a variable of the trailing VALUES', ({ expect }) => {
    expect(() => parser.parse('SELECT (1 AS ?x) WHERE { ?s ?p ?o } VALUES ?x { 1 }'))
      .toThrow(/Target id of 'AS' \(\?x\) is already in scope/u);
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
