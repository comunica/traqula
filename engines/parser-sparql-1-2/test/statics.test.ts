import fs from 'node:fs';
import path from 'node:path';
import type { BaseQuad } from '@rdfjs/types';
import { Factory } from '@traqula/rules-sparql-1-2';
import { positiveTest, importSparql11NoteTests, negativeTest } from '@traqula/test-utils';
import { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import { Parser } from '../lib';

describe('a SPARQL 1.2 parser', () => {
  const parser = new Parser();
  const F = new Factory();
  const context = { prefixes: { ex: 'http://example.org/' }};

  function _sinkAst(suite: string, test: string, response: object): void {
    const dir = '/home/jitsedesmet/Documents/PhD/code/traqula/packages/test-utils/lib/statics/';
    const fileLoc = path.join(dir, suite, `${test}.json`);
    // eslint-disable-next-line no-sync
    fs.writeFileSync(fileLoc, JSON.stringify(response, null, 2));
  }

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
        expect(res).toEqualParsedQueryIgnoring(obj => F.isTriple(obj), [ 'annotations' ], ast);
      });
    }
  });

  describe('positive sparql 1.2', () => {
    for (const { name, statics } of positiveTest('sparql-1-2')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast } = await statics();
        const res: unknown = parser.parse(query, context);
        // SinkAst('sparql-1-2', name, <object> res);
        expect(res).toEqualParsedQuery(ast);
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
    const skip = new Set([
      'sparql-1-2-syntax-basic-tripleterm-subject',
      'sparql-1-2-syntax-compound-tripleterm-subject',
      'sparql-1-2-syntax-subject-tripleterm',
    ]);
    for (const { name, statics } of negativeTest('sparql-1-2-invalid', name => !skip.has(name))) {
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
