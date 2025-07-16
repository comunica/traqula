import type { BaseQuad } from '@rdfjs/types';
import { positiveTest, importSparql11NoteTests } from '@traqula/test-utils';
import { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import { Parser } from '../lib';

describe('a SPARQL 1.1 + adjust parser', () => {
  const parser = new Parser();
  const context = { prefixes: { ex: 'http://example.org/' }};

  describe('positive paths', () => {
    for (const { name, statics } of positiveTest('paths')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast } = await statics();
        const res: unknown = parser.parsePath(query, context);
        expect(res).toEqualParsedQuery(ast);
      });
    }
  });

  describe('positive sparql 1.1', () => {
    for (const { name, statics } of positiveTest('sparql-1-1')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast } = await statics();
        const res: unknown = parser.parse(query, context);
        expect(res).toEqualParsedQuery(ast);
      });
    }
  });

  describe('specific sparql 1.1 tests', () => {
    importSparql11NoteTests(parser, new DataFactory<BaseQuad>());
  });

  it('parses ADJUST function', ({ expect }) => {
    const query = `
SELECT ?s ?p (ADJUST(?o, "-PT10H"^^<http://www.w3.org/2001/XMLSchema#dayTimeDuration>) as ?adjusted) WHERE {
  ?s ?p ?o
}
`;
    const res: unknown = parser.parse(query);
    expect(res).toMatchObject({});
  });
});
