import * as fs from 'fs';
import translate from '../lib/sparqlAlgebra';
import Util from '../lib/util';
import * as path from 'path';

// WARNING: use this script with caution!
// After running this script, manual inspection of the output is needed to make sure that conversion happened correctly.

function generateJsonFromSparqlInPath(currentPath: string, stack: string[]) {
    if (fs.lstatSync(currentPath).isDirectory()) {
        let files = fs.readdirSync(currentPath);
        for (let file of files) {
            generateJsonFromSparqlInPath(path.join(currentPath, file), stack.concat([file]));
        }
    } else {
        let sparql = fs.readFileSync(currentPath, 'utf8');

        let filename = stack.pop();
        let name = filename!.replace(/\.sparql$/, '');
        for (const blankToVariable of [ false, true ]) {
            let algebra = Util.objectify(translate(sparql, { quads: name.endsWith('(quads)'), sparqlStar: true, blankToVariable }));
            filename = name + '.json';
            let newPath = path.join(__dirname, 'algebra' + (blankToVariable ? '-blank-to-var' : ''));
            for (let piece of stack) {
                newPath = path.join(newPath, piece);
                if (!fs.existsSync(newPath))
                    fs.mkdirSync(newPath);
            }

            fs.writeFileSync(path.join(newPath, filename), JSON.stringify(algebra, null, 2));
        }
    }
}

generateJsonFromSparqlInPath(path.join(__dirname, 'sparql'), []);
