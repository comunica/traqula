/* eslint-disable no-sync */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Parser } from '@traqula/parser-sparql-1-1';
import { translate } from '../lib';
import Util from '../lib/util';

// WARNING: use this script with caution!
// After running this script, manual inspection of the output is needed to make sure that conversion happened correctly.
const parser = new Parser();
const rootSparql = path.join(__dirname, 'sparql');
const rootJson = path.join(__dirname, 'algebra');
const rootJsonBlankToVariable = path.join(__dirname, 'algebra-blank-to-var');

/**
 * @param currentPath
 * @param dirStack breadcrumbs of dirs from the sparqlRoot
 */
function generateJsonFromSparqlInPath(currentPath: string, dirStack: string[]): void {
  if (fs.lstatSync(currentPath).isDirectory()) {
    const files = fs.readdirSync(currentPath);
    for (const file of files) {
      generateJsonFromSparqlInPath(path.join(currentPath, file), [ ...dirStack, file ]);
    }
  } else if (currentPath.endsWith('.sparql')) {
    const sparql = fs.readFileSync(currentPath, 'utf8');

    // Get the file name, aka top of dirStack.
    const filename = dirStack.pop()!;
    const name = filename.replace(/\.sparql$/u, '');
    for (const blankToVariable of [ false, true ]) {
      try {
        const ast = parser.parse(sparql);
        const algebra = Util.objectify(translate(ast, {
          quads: name.endsWith('-quads'),
          blankToVariable,
        }));
        const algebraFileName = `${name}.json`;
        let newPath = blankToVariable ? rootJsonBlankToVariable : rootJson;
        for (const piece of dirStack) {
          newPath = path.join(newPath, piece);
          if (!fs.existsSync(newPath)) {
            fs.mkdirSync(newPath);
          }
        }

        fs.writeFileSync(path.join(newPath, algebraFileName), JSON.stringify(algebra, null, 2));
      } catch {
        // eslint-disable-next-line no-console
        console.error(`Error in ${currentPath}`);
        // Throw error;
      }
    }
  }
}

generateJsonFromSparqlInPath(rootSparql, []);
