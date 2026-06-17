import { _initStaticsRoot } from './generators/utils.js';

// Initialise the statics root using __dirname (the directory of this compiled
// CJS file) so that the walk-up in utils.ts lands on the correct package root.
// This side-effect runs before any re-exported functions are called.
_initStaticsRoot(__dirname);

export * from './matchers/toEqualParsedQuery.js';
export * from './matchers/vitest.js';
export * from './generators/generators.js';
export * from './generators/algebraGenerators.js';
export { getStaticFilePath } from './generators/utils.js';
export * from './Sparql11NotesTest.js';
export * from './fileUtils.js';
