import type { BaseQuad } from '@rdfjs/types';
import { positiveTest, importSparql11NoteTests, negativeTest } from '@traqula/test-utils';
import { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import { Parser } from '../lib';

describe('a SPARQL 1.2 parser', () => {
  const parser = new Parser();
  const context = { prefixes: { ex: 'http://example.org/' }};

  describe('positive paths', () => {
    for (const { name, statics } of positiveTest('paths')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, result } = await statics();
        const res: unknown = parser.parsePath(query, context);
        expect(res).toEqualParsedQuery(result);
      });
    }
  });

  describe('positive sparql 1.1', () => {
    for (const { name, statics } of positiveTest('sparql-1-1')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, result } = await statics();
        const res: unknown = parser.parse(query, context);
        expect(res).toEqualParsedQuery(result);
      });
    }
  });

  describe('positive sparql 1.2', () => {
    for (const { name, statics } of positiveTest('sparql-1-2')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, result } = await statics();
        const res: unknown = parser.parse(query, context);
        expect(res).toEqualParsedQuery(result);
      });
    }
  });

  it(`should NOT parse $only thing}`, async({ expect }) => {
    const query = `
    PREFIX : <http://example.com/ns#>

SELECT * WHERE {
   <<( ?s ?p ?o )>> .
}
    `;
    expect(() => parser.parse(query)).toThrow();
  });

  describe('negative sparql 1.2', () => {
    for (const { name, statics } of negativeTest('sparql-1-2-invalid')) {
      it(`should NOT parse ${name}`, async({ expect }) => {
        const { query } = await statics();
        expect(() => parser.parse(query, context)).toThrow();
      });
    }
  });

  describe('specific sparql 1.1 tests', () => {
    importSparql11NoteTests(parser, new DataFactory<BaseQuad>());
  });
});
