'use strict';

/**
 * This script runs after the CJS TypeScript build and writes
 * dist/cjs/lib/generators/utils.js manually.
 *
 * WHY: TypeScript compiles utils.ts (which uses `import.meta.url`) to CommonJS
 * output that still contains `import.meta.url` literally.  Node.js rejects CJS
 * files that contain `import.meta` at parse time, so that output is unusable.
 * The CJS equivalent uses `__dirname` instead, which TypeScript cannot emit
 * automatically from a source file that also supports ESM.
 */

const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, '..', 'dist', 'cjs', 'lib', 'generators');
fs.mkdirSync(outDir, { recursive: true });

// The generated file is the CommonJS equivalent of utils.ts.
// It uses `__dirname` (the directory of the *compiled* file at runtime) instead
// of `import.meta.url`.  In the CJS dist tree the compiled file lives at
// dist/cjs/lib/generators/utils.js, so __dirname points to that directory and
// the walk-upward loop finds statics/ four levels up at the package root.
const content = `\
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaticFilePath = getStaticFilePath;
const path = require("node:path");
const { existsSync } = require("node:fs");
function resolveStaticsPath(startDir) {
    let dir = startDir;
    while (path.dirname(dir) !== dir) {
        const candidate = path.join(dir, "statics");
        if (existsSync(candidate)) {
            return candidate;
        }
        dir = path.dirname(dir);
    }
    throw new Error(\`Cannot locate statics/ directory starting from \${startDir}\`);
}
const staticsPath = resolveStaticsPath(__dirname);
function getStaticFilePath(...paths) {
    return path.join(staticsPath, ...paths);
}
`;

fs.writeFileSync(path.join(outDir, 'utils.js'), content, 'utf8');
console.log('Wrote dist/cjs/lib/generators/utils.js');

