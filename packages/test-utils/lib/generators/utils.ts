/* eslint-disable import/no-nodejs-modules */
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Walk up the directory tree from startDir until a directory that contains
 * both a `package.json` and a `statics` folder is found.  Stopping at the
 * package-root boundary avoids the risk of matching an unrelated `statics/`
 * folder higher up the filesystem.
 */
function resolveStaticsPath(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(path.join(dir, 'statics')) && existsSync(path.join(dir, 'package.json'))) {
      return path.join(dir, 'statics');
    }
    const parent = path.dirname(dir);
    // Guard: filesystem root reached before finding a package boundary — unreachable in practice.
    /* v8 ignore next 3 */
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  // Guard: statics not found even after reaching the filesystem root — unreachable in practice.
  /* v8 ignore next */
  throw new Error(`Cannot locate statics/ directory (with co-located package.json) starting from ${startDir}`);
}

// Resolved on demand after the package entry point calls _initStaticsRoot().
let _staticsPath: string | undefined;

/**
 * Initialises the statics root from the directory of the package entry point.
 * Must be called before any test fixture helpers are invoked.
 *
 * The package entry points (index.ts for ESM, index.cts for CJS) call this
 * with their own `path.dirname(fileURLToPath(import.meta.url))` or `__dirname`
 * respectively, so this module contains no module-system-specific syntax and
 * compiles correctly under both `module: NodeNext` and `module: CommonJS`.
 *
 * Design note — eager-init vs lazy resolution:
 * An alternative would be to resolve the statics path lazily inside
 * getStaticFilePath() on first call (eliminating _initStaticsRoot and the
 * entry-point coupling entirely).  Eager-init was chosen instead because lazy
 * resolution cannot safely use import.meta.url in a CommonJS build, and
 * __dirname is not available in an ESM build.  The entry-point side-effect
 * approach lets this module stay free of module-system-specific syntax while
 * still capturing the correct anchor directory at load time.
 * @internal
 */
export function _initStaticsRoot(dir: string): void {
  _staticsPath = resolveStaticsPath(dir);
}

/**
 * Resolve a path relative to the test-utils statics directory.
 * @param paths - Path segments to join after the statics root.
 * @returns The absolute path to the static fixture.
 */
export function getStaticFilePath(...paths: string[]): string {
  // Guard: entry point must call _initStaticsRoot() before this helper is used.
  /* v8 ignore next 3 */
  if (!_staticsPath) {
    throw new Error('getStaticFilePath() called before the package entry point initialised the statics root');
  }
  return path.join(_staticsPath, ...paths);
}
