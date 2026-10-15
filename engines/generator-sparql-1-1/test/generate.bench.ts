import { traqulaIndentation, traqulaNewlineAlternative } from '@traqula/core';
import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, bench } from 'vitest';
import { Generator } from '../lib/index.js';

/**
 * A query with n triple patterns, each followed by nested FILTER NOT EXISTS blocks.
 * See https://github.com/comunica/traqula/issues/236
 */
function largeQuery(n: number): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(`?s${i} <http://ex/p> ?o${i} .`);
    parts.push(`FILTER NOT EXISTS { ?s${i} a <http://ex/C> . FILTER NOT EXISTS { ?s${i} <http://ex/q> <http://ex/v> } }`);
  }
  return `SELECT * WHERE { ${parts.join(' ')} }`;
}

describe('generate large queries', () => {
  const parser = new Parser();
  const generator = new Generator();
  const compact = { [traqulaIndentation]: -1, indentInc: 0, [traqulaNewlineAlternative]: ' ' };

  for (const n of [ 100, 400, 1600 ]) {
    const ast = parser.parse(largeQuery(n));
    describe(`${n} patterns`, () => {
      bench('indented', () => {
        generator.generate(ast);
      });
      bench('compact', () => {
        generator.generate(ast, compact);
      });
    });
  }
});
