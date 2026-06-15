/* eslint-disable import/no-nodejs-modules */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walk up the directory tree from startDir until a folder named "statics" is found.
 * This is needed because the depth from this file to the package root differs between
 * the compiled output (dist/esm/lib/generators/) and the TypeScript source
 * (lib/generators/) when Vitest runs tests directly against the source.
 */
function resolveStaticsPath(startDir: string): string {
  let dir = startDir;
  while (path.dirname(dir) !== dir) {
    const candidate = path.join(dir, 'statics');
    if (existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  // Only reached if we walk all the way to the filesystem root without finding
  // statics/. That cannot happen in a correctly installed package, so we tell
  // the coverage tool to ignore these lines rather than require a test for it.
  /* v8 ignore start */ // eslint-disable-line capitalized-comments
  throw new Error(`Cannot locate statics/ directory starting from ${startDir}`);
  /* v8 ignore stop */ // eslint-disable-line capitalized-comments
}

// `import.meta.url` is the URL of the current ES module file at runtime.
// TypeScript flags it as an error (TS1343) in CommonJS output mode, so we
// suppress that error here.  The CJS build output is overwritten by
// scripts/write-cjs-utils.cjs, which emits an equivalent file using __dirname.
// eslint-disable-next-line ts/ban-ts-comment, ts/prefer-ts-expect-error
// @ts-ignore TS1343
const staticsPath = resolveStaticsPath(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Resolve a path relative to the test-utils statics directory.
 * @param paths - Path segments to join after the statics root.
 * @returns The absolute path to the static fixture.
 */
export function getStaticFilePath(...paths: string[]): string {
  return path.join(staticsPath, ...paths);
}
