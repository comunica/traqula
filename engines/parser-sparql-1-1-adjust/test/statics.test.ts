import type { BaseQuad } from '@rdfjs/types';
import { AstFactory } from '@traqula/rules-sparql-1-1';
import { positiveTest, importSparql11NoteTests, negativeTest } from '@traqula/test-utils';
import { DataFactory } from 'rdf-data-factory';
import { beforeEach, describe, it } from 'vitest';
import { adjustParserBuilder, adjustLexerBuilder, Parser } from '../lib/index.js';

describe('a SPARQL 1.1 + adjust parser', () => {
  const astFactory = new AstFactory({ tracksSourceLocation: false });
  const sourceTrackingAstFactory = new AstFactory();
  const sourceTrackingParser = new Parser({
    defaultContext: { astFactory: sourceTrackingAstFactory },
    lexerConfig: { positionTracking: 'full' },
  });
  const _noSourceTrackingParser = new Parser();
  const context = { prefixes: { ex: 'http://example.org/' }};

  beforeEach(() => {
    astFactory.resetBlankNodeCounter();
    sourceTrackingAstFactory.resetBlankNodeCounter();
  });

  it('passes chevrotain validation', () => {
    adjustParserBuilder.build({
      tokenVocabulary: adjustLexerBuilder.tokenVocabulary,
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
        const { query, astWithSource } = await statics();
        const res: unknown = sourceTrackingParser.parsePath(query, context);
        expect(res).toEqualParsedQuery(astWithSource);
      });
    }
  });

  describe('positive sparql 1.1', () => {
    for (const { name, statics } of positiveTest('sparql-1-1')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, astWithSource } = await statics();
        const res: unknown = sourceTrackingParser.parse(query, context);
        expect(res).toEqualParsedQuery(astWithSource);
      });
    }
  });

  describe('negative SPARQL 1.1', () => {
    for (const { name, statics } of negativeTest('sparql-1-1-invalid')) {
      it(`should NOT parse ${name}`, async({ expect }) => {
        const { query } = await statics();
        expect(() => sourceTrackingParser.parse(query, context)).toThrow();
      });
    }
  });

  describe('specific sparql 1.1 tests', () => {
    importSparql11NoteTests(sourceTrackingParser, new DataFactory<BaseQuad>());
  });

  it('parses ADJUST function', ({ expect }) => {
    const query = `
SELECT ?s ?p (ADJUST(?o, "-PT10H"^^<http://www.w3.org/2001/XMLSchema#dayTimeDuration>) as ?adjusted) WHERE {
  ?s ?p ?o
}
`;
    const res: unknown = sourceTrackingParser.parse(query);
    expect(res).toMatchObject({});
  });
});
