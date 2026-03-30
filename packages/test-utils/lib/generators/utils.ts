/* eslint-disable import/no-nodejs-modules */
import path from 'node:path';

// path.resolve() returns process.cwd() — the monorepo root when running via vitest.
// This avoids __dirname (CJS-only) and import.meta.url (ESM-only).
const staticsPath = path.resolve('packages/test-utils/statics');

export function getStaticFilePath(...paths: string[]): string {
  return path.join(staticsPath, ...paths);
}
