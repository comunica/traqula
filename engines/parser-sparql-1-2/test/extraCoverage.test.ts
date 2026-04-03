import { AstFactory } from '@traqula/rules-sparql-1-2';
import { beforeEach, describe, it } from 'vitest';
import { Parser } from '../lib/index.js';

describe('extra parser-sparql-1-2 coverage', () => {
  const F = new AstFactory({ tracksSourceLocation: false });
  const parser = new Parser({ defaultContext: { astFactory: F }});

  beforeEach(() => {
    F.resetBlankNodeCounter();
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
});
