import * as path from 'node:path';
import { Parser } from '@traqula/parser-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import { positiveTest, readFile } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { Generator } from '../lib';

describe('a SPARQL 1.1 generator', () => {
  const generator = new Generator();
  const parser = new Parser();
  const context: Partial<T11.SparqlContext> = {
    prefixes: {
      ex: 'http://example.org/',
    },
  };

  it ('should generate a simple query', ({ expect }) => {
    const query = 'SELECT * WHERE { ?s ?p ?o }';
    const ast = <T11.Query> parser.parse(query);
    const result = generator.generate(ast);
    expect(result.replaceAll(/\s+/gu, ' ')).toBe(query);
  });

  describe('positive paths', () => {
    for (const { name, statics } of positiveTest('paths')) {
      it(`can regenerate ${name}`, async({ expect }) => {
        const regenMatch = await readFile(
          path.join(__dirname, 'statics', 'paths', `${name}.sparql`),
          'utf-8',
        );
        const { query } = await statics();

        const ast = parser.parsePath(query, context);
        const regenQuery = generator.generatePath(ast);
        // Await fsp.writeFile(path.join(__dirname, 'statics', 'paths', `${name}.sparql`), regenQuery, 'utf-8');
        expect(regenQuery).toEqual(regenMatch);
        expect(() => parser.parsePath(regenQuery, context)).not.toThrow();
      });
    }
  });

  describe('positive sparql', () => {
    for (const { name, statics } of positiveTest('sparql-1-1')) {
      it(`can regenerate ${name}`, async({ expect, onTestFailed }) => {
        const regenMatch = await readFile(
          path.join(__dirname, 'statics', 'sparql-1-1', `${name}.sparql`),
          'utf-8',
        );
        const { query } = await statics();

        // eslint-disable-next-line no-console
        onTestFailed(() => console.error('---- INPUT ----\n', query.replaceAll(/(^|(\n))/gu, '$1|')));
        const ast = parser.parse(query, context);
        const regenQuery = generator.generate(ast);
        // eslint-disable-next-line no-console
        onTestFailed(() => console.error('---- GENERATED ----\n', regenQuery.replaceAll(/(^|(\n))/gu, '$1|')));

        // Await fsp.writeFile(path.join(__dirname, 'statics', 'sparql-1-1', `${name}.sparql`), regenQuery, 'utf-8');
        expect(regenQuery).toEqual(regenMatch);
        expect(() => parser.parse(regenQuery, context)).not.toThrow();
      });
    }
  });
});
