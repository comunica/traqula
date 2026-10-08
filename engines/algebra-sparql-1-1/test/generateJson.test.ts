import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { algebraUtils } from '@traqula/algebra-transformations-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import { AstFactory } from '@traqula/rules-sparql-1-1';
import { type AlgebraTestSuite, sparqlQueries, getStaticFilePath } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { toAlgebra, toAst } from '../lib/index.js';

// WARNING: use this script with caution!
// After running this script, manual inspection of the output is needed to make sure that conversion happened correctly.
const parser = new Parser();
const generator = new Generator();
const rootDir = getStaticFilePath('algebra');
const rootJson = join(rootDir, 'algebra');
const rootJsonBlankToVariable = join(rootDir, 'algebra-blank-to-var');

const canonicalSparqlBase = join(rootDir, 'canonical-sparql', 'base');
const canonicalSparqlBlankToVar = join(rootDir, 'canonical-sparql', 'blank-to-var');
// Not imported from algebra.test.ts: collecting those tests fails while fixtures are still missing.
const suites: AlgebraTestSuite[] = [ 'dawg-syntax', 'sparql11-query', 'sparql-1.1' ];

describe.skip('algebra test generate', () => {
  const astFactory = new AstFactory();
  for (const suite of suites) {
    describe(suite, () => {
      for (const { query, name } of sparqlQueries(suite)) {
        for (const quads of [ false, true ]) {
          for (const blankToVariable of [ false, true ]) {
            const suffix = quads ? '-quads' : '';
            it(`${name}${suffix} - blankToVar: ${blankToVariable}`, ({ expect }) => {
              expect(() => {
                astFactory.resetBlankNodeCounter();
                const ast = parser.parse(query, { astFactory });
                const rawAlgebra = toAlgebra(ast, {
                  quads,
                  blankToVariable,
                });
                const algebra = algebraUtils.objectify(rawAlgebra);
                // Same as the canonical SPARQL tests: generate from the algebra itself, not its JSON form
                const canonicalString = generator.generate(toAst(rawAlgebra));

                const algebraFileName = `${name}${suffix}.json`;
                let newPath = blankToVariable ? rootJsonBlankToVariable : rootJson;
                let newPathCanonical = blankToVariable ? canonicalSparqlBlankToVar : canonicalSparqlBase;
                for (const piece of name.split(sep).slice(0, -1)) {
                  newPath = join(newPath, piece);
                  if (!existsSync(newPath)) {
                    mkdirSync(newPath);
                  }
                }
                for (const piece of name.split(sep).slice(0, -1)) {
                  newPathCanonical = join(newPathCanonical, piece);
                  if (!existsSync(newPathCanonical)) {
                    mkdirSync(newPathCanonical);
                  }
                }

                writeFileSync(
                  join(blankToVariable ? rootJsonBlankToVariable : rootJson, algebraFileName),
                  `${JSON.stringify(algebra, null, 2)}\n`,
                );
                writeFileSync(
                  join(blankToVariable ? canonicalSparqlBlankToVar : canonicalSparqlBase, `${name}${suffix}.sparql`),
                  canonicalString,
                );
              }).not.toThrow();
            });
          }
        }
      }
    });
  }
});
