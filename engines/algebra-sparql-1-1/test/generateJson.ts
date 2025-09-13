/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { utils } from '@traqula/algebra-transformations-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import { type AlgebraTestSuite, sparqlQueries } from '@traqula/test-utils';
import { toAlgebra } from '../lib';

// WARNING: use this script with caution!
// After running this script, manual inspection of the output is needed to make sure that conversion happened correctly.
const parser = new Parser();
const rootDir = path.join(__dirname, '..', '..', '..', 'test-utils', 'lib', 'statics', 'algebra');
const rootJson = path.join(rootDir, 'algebra');
const rootJsonBlankToVariable = path.join(rootDir, 'algebra-blank-to-var');

const suites: AlgebraTestSuite[] = [ 'dawg-syntax', 'sparql11-query', 'sparql-1.1' ];

for (const { query, name } of sparqlQueries(suites)) {
  for (const blankToVariable of [ false, true ]) {
    try {
      const ast = parser.parse(query);
      const algebra = utils.objectify(toAlgebra(ast, {
        quads: name.endsWith('-quads'),
        blankToVariable,
      }));
      const algebraFileName = `${name}.json`;
      let newPath = blankToVariable ? rootJsonBlankToVariable : rootJson;
      for (const piece of name.split(path.sep).slice(0, -1)) {
        newPath = path.join(newPath, piece);
        if (!fs.existsSync(newPath)) {
          fs.mkdirSync(newPath);
        }
      }

      fs.writeFileSync(
        path.join(blankToVariable ? rootJsonBlankToVariable : rootJson, algebraFileName),
        JSON.stringify(algebra, null, 2),
      );
    } catch {
      // eslint-disable-next-line no-console
      console.error(`Error in ${name}${blankToVariable ? ' - using blank to variables' : ''}.`);
      // Throw error;
    }
  }
}
