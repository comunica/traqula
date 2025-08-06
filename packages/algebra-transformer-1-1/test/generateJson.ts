/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Parser } from '@traqula/parser-sparql-1-1';
import translate from '../lib/sparqlAlgebra';
import Util from '../lib/util';

// WARNING: use this script with caution!
// After running this script, manual inspection of the output is needed to make sure that conversion happened correctly.
const parser = new Parser();

function generateJsonFromSparqlInPath(currentPath: string, stack: string[]): void {
  if (fs.lstatSync(currentPath).isDirectory()) {
    const files = fs.readdirSync(currentPath);
    for (const file of files) {
      generateJsonFromSparqlInPath(path.join(currentPath, file), [ ...stack, file ]);
    }
  } else if (currentPath.endsWith('.sparql')) {
    const sparql = fs.readFileSync(currentPath, 'utf8');

    let filename = stack.pop();
    const name = filename!.replace(/\.sparql$/u, '');
    for (const blankToVariable of [ false, true ]) {
      try {
        const ast = parser.parse(sparql);
        const algebra = Util.objectify(translate(ast, {
          quads: name.endsWith('(quads)'),
          blankToVariable,
        }));
        filename = `${name}.json`;
        let newPath = path.join(__dirname, `algebra${blankToVariable ? '-blank-to-var' : ''}`);
        for (const piece of stack) {
          newPath = path.join(newPath, piece);
          if (!fs.existsSync(newPath)) {
            fs.mkdirSync(newPath);
          }
        }

        fs.writeFileSync(path.join(newPath, filename), JSON.stringify(algebra, null, 2));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Error in ${currentPath}`);
        throw error;
      }
    }
  }
}

generateJsonFromSparqlInPath(path.join(__dirname, 'sparql'), []);
