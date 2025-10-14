import fs from 'node:fs';
import path from 'node:path';
import type { BaseQuad } from '@rdfjs/types';
import { lex } from '@traqula/rules-sparql-1-1';
import { importSparql11NoteTests, negativeTest, positiveTest } from '@traqula/test-utils';
import { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import { Parser, sparql11ParserBuilder } from '../lib/index.js';

describe('a SPARQL 1.1 parser', () => {
  const parser = new Parser();
  const context = { prefixes: { ex: 'http://example.org/' }};

  function _sinkAst(suite: string, test: string, response: object): void {
    const dir = path.join(__dirname, '..', '..', '..', 'packages', 'test-utils', 'lib', 'statics');
    const fileLoc = path.join(dir, suite, `${test}.json`);
    // eslint-disable-next-line no-sync
    fs.writeFileSync(fileLoc, JSON.stringify(response, null, 2));
  }

  it('passes chevrotain validation', () => {
    sparql11ParserBuilder.build({
      tokenVocabulary: lex.sparql11LexerBuilder.tokenVocabulary,
      lexerConfig: {
        skipValidations: false,
        ensureOptimizations: true,
      },
      parserConfig: {
        skipValidations: false,
      },
    });
  });

  describe('positive paths', () => {
    for (const { name, statics } of positiveTest('paths')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast } = await statics();
        const res: unknown = parser.parsePath(query, context);
        // _sinkAst('paths', name, <object> res);
        expect(res).toEqualParsedQuery(ast);
      });
    }
  });

  describe('positive sparql 1.1', () => {
    for (const { name, statics } of positiveTest('sparql-1-1')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast } = await statics();
        const res: unknown = parser.parse(query, context);
        // _sinkAst('sparql-1-1', name, <object> res);
        expect(res).toEqualParsedQuery(ast);
      });
    }
  });

  describe('negative SPARQL 1.1', () => {
    for (const { name, statics } of negativeTest('sparql-1-1-invalid')) {
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
