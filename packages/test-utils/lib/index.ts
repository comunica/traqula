/* eslint-disable import/no-nodejs-modules */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _initStaticsRoot } from './generators/utils.js';

// Initialise the statics root using this file's own location so that the
// walk-up in utils.ts lands on the correct package root regardless of the
// install depth.  This side-effect runs before any of the re-exported
// functions are called by consuming tests.
_initStaticsRoot(path.dirname(fileURLToPath(import.meta.url)));

export * from './matchers/toEqualParsedQuery.js';
export * from './matchers/vitest.js';
export * from './generators/generators.js';
export * from './generators/algebraGenerators.js';
export { getStaticFilePath } from './generators/utils.js';
export * from './Sparql11NotesTest.js';
export * from './fileUtils.js';
