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
});
