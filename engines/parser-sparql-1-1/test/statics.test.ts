import fs from 'node:fs';
import path from 'node:path';
import type { BaseQuad } from '@rdfjs/types';
import { positiveTest, importSparql11NoteTests } from '@traqula/test-utils';
import { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import { Parser } from '../lib';

describe('a SPARQL 1.1 parser', () => {
  const parser = new Parser();
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
        // SinkAst('paths', name, <object> res);
        expect(res).toEqualParsedQuery(ast);
      });
    }
  });

  describe('positive sparql 1.1', () => {
    for (const { name, statics } of positiveTest('sparql-1-1')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast } = await statics();
        const res: unknown = parser.parse(query, context);
        // SinkAst('sparql-1-1', name, <object> res);
        expect(res).toEqualParsedQuery(ast);
      });
    }
  });

  describe('specific sparql 1.1 tests', () => {
    importSparql11NoteTests(parser, new DataFactory<BaseQuad>());
  });
});
