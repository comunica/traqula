# Task: Fix `getStaticFilePath` to resolve relative to installed package

## Context

`@traqula/test-utils` exports a `getStaticFilePath` helper used by parser tests to
locate fixture files (`.sparql`, `.json`) shipped inside the package under `statics/`.

Currently `packages/test-utils/lib/generators/utils.ts` resolves the path like this:

```ts
const staticsPath = path.resolve('packages/test-utils/statics');
```

`path.resolve` without an absolute base uses `process.cwd()`. This works inside the
Traqula monorepo (where CWD is the repo root), but **breaks for any external consumer**
whose CWD does not contain a `packages/test-utils/statics` directory.

## Goal

Make `getStaticFilePath` resolve the `statics/` directory relative to the **installed
package location**, so it works correctly for any npm consumer regardless of CWD.

## Constraints

The package compiles to **both ESM and CJS** from the same TypeScript source.
- ESM allows `import.meta.url`
- CJS (`module: "CommonJS"`) does **not** — TypeScript errors on `import.meta`

The cleanest solution is:
1. Update the TypeScript source (`utils.ts`) to use `import.meta.url` — this fixes the
   ESM output.
2. Exclude `utils.ts` from the CJS TypeScript build.
3. Add a post-build script that writes the CJS-compatible `utils.js` using `__dirname`.
4. Wire the post-build script into `package.json`'s `build:cjs` step.

---

## Changes required

### 1. `packages/test-utils/lib/generators/utils.ts`

Replace the whole file with:

```ts
/* eslint-disable import/no-nodejs-modules */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Resolve statics relative to this file's location in the published package.
// dist/esm/lib/generators/utils.js → ../../../../statics = <package-root>/statics
const staticsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'statics');

/**
 * Resolve a path relative to the test-utils statics directory.
 * @param paths - Path segments to join after the statics root.
 * @returns The absolute path to the static fixture.
 */
export function getStaticFilePath(...paths: string[]): string {
  return path.join(staticsPath, ...paths);
}
```

### 2. `packages/test-utils/tsconfig.cjs.json`

Add an `exclude` entry so the CJS TypeScript compiler skips `utils.ts` (it cannot
compile `import.meta` in CommonJS mode). The file will be provided by the post-build
script instead.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": false,
    "module": "CommonJS",
    "moduleResolution": "bundler",
    "declaration": false,
    "outDir": "dist/cjs",
    "skipLibCheck": true
  },
  "exclude": ["dist/**", "lib/generators/utils.ts"]
}
```

### 3. New file: `packages/test-utils/scripts/write-cjs-utils.cjs`

Create this directory and file. It runs after the CJS TypeScript build and writes the
`__dirname`-based version of `utils.js` into `dist/cjs/lib/generators/`.

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, '..', 'dist', 'cjs', 'lib', 'generators');
fs.mkdirSync(outDir, { recursive: true });

// CJS equivalent of the ESM utils.ts.
// dist/cjs/lib/generators/utils.js → ../../../../statics = <package-root>/statics
const content = `\
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaticFilePath = getStaticFilePath;
const node_path_1 = __importDefault(require("node:path"));
const staticsPath = node_path_1.default.join(__dirname, '..', '..', '..', '..', 'statics');
function getStaticFilePath(...paths) {
    return node_path_1.default.join(staticsPath, ...paths);
}
`;

fs.writeFileSync(path.join(outDir, 'utils.js'), content, 'utf8');
console.log('Wrote dist/cjs/lib/generators/utils.js');
```

### 4. `packages/test-utils/package.json` — update `build:cjs` script

Change:
```json
"build:cjs": "node \"../../node_modules/typescript/bin/tsc\" -b tsconfig.cjs.json"
```

To:
```json
"build:cjs": "node \"../../node_modules/typescript/bin/tsc\" -b tsconfig.cjs.json && node scripts/write-cjs-utils.cjs"
```

### 5. Bump the version

Increment the patch version in `packages/test-utils/package.json`, e.g. `1.1.3` → `1.1.4`.

---

## Verification

After making the changes and running `yarn build` in `packages/test-utils` (or from the
monorepo root):

1. `dist/esm/lib/generators/utils.js` should contain `fileURLToPath(import.meta.url)` — **not** `path.resolve('packages/test-utils/statics')`.
2. `dist/cjs/lib/generators/utils.js` should contain `__dirname` — **not** `path.resolve('packages/test-utils/statics')`.
3. All existing tests in the Traqula monorepo should still pass (`yarn test`).
4. An external consumer (any package that installs `@traqula/test-utils` from npm and
   calls `getStaticFilePath()`) should receive a valid absolute path to the `statics/`
   directory inside `node_modules/@traqula/test-utils/statics/`, regardless of the
   consumer's CWD.

---

## Background: why this broke an external consumer

[`comunica/comunica-feature-next`](https://github.com/jitsedesmet/comunica-feature-next)
installs `@traqula/test-utils` and its Jest test suite calls `positiveTest('sparql-1-1')`,
which calls `getStaticFilePath`. Because that project's CWD at test time is the
monorepo root (`/IdeaProjects/comunica-feature-next`), `path.resolve('packages/test-utils/statics')`
resolved to a path that did not exist, causing the test suite to crash with:

```
ENOENT: no such file or directory, scandir '.../packages/test-utils/statics/ast/ast-source-tracked/sparql-1-1'
```
