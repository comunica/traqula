/* eslint-disable import/no-nodejs-modules */
import path from 'node:path';

// Path.resolve() returns process.cwd() — the monorepo root when running via vitest.
// This avoids __dirname (CJS-only) and import.meta.url (ESM-only).
const staticsPath = path.resolve('packages/test-utils/statics');

/**
 * Resolve a path relative to the test-utils statics directory.
 * @param paths - Path segments to join after the statics root.
 * @returns The absolute path to the static fixture.
 */
export function getStaticFilePath(...paths: string[]): string {
  return path.join(staticsPath, ...paths);
}
