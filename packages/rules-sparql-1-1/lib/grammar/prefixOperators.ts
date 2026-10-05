// Package-local: not re-exported by `grammar/index.ts`, so it does not become part of the public API.

/**
 * The prefix operators of an expression operation, mapped to the symbol they are generated as.
 */
export const prefixOperators: ReadonlyMap<string, string> = new Map([
  [ '!', '!' ],
  [ 'uplus', '+' ],
  [ 'uminus', '-' ],
]);
