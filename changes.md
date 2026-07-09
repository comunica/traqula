# TypeScript 7.0 Migration

This document describes the changes made to migrate the Traqula monorepo from
TypeScript 6.0 to the native [TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
compiler (the 10x-faster Go port).

## Summary

TypeScript 7.0 is a native (Go) port of the compiler. It keeps the **same
type-checking semantics** as 6.0 (with `stableTypeOrdering` permanently on), so
the migration is primarily about the **toolchain and configuration**, not the
type-level source code. All builds, linting and the full test suite (8400 tests,
100 % coverage) continue to pass after the migration.

## 1. Dependency setup: running 7.0 side-by-side with the 6.0 API

TypeScript 7.0 ships **no programmatic API** (that is planned for 7.1). Several
dev tools in this repo still import the `typescript` package API and therefore
require the 6.0 API:

- `typescript-eslint` (6.21.0) – parser peer-depends on `typescript`.
- `typedoc` (0.28.18) – peer range only goes up to `6.0.x`.
- `dts-bundle-generator` (9.5.1) – uses the compiler API to bundle `.d.ts`.
- `vitest` type-checking (`typecheck`) – uses the `typescript` API.

Following the official recommendation, we use npm aliases so the compiler and the
API package can coexist (`package.json`):

```
"devDependencies": {
  // Native TS 7.0 compiler – provides the `tsc` binary used for builds
  "@typescript/native": "npm:typescript@^7.0.2",
  // TS 6.0 API package – provides the API consumed by eslint/typedoc/etc.
  "typescript": "npm:@typescript/typescript6@^6.0.2"
}
```

- `node_modules/.bin/tsc` now resolves to the **native 7.0** compiler.
- The 6.0 API remains importable as `typescript` (and also exposes a `tsc6`
  binary), keeping all API-consuming tooling working unchanged.

## 2. Build scripts point at the native compiler

The per-package `build:ts` / `build:cjs` scripts invoked the compiler through an
explicit path (`node ../../node_modules/typescript/bin/tsc`). Since the
`typescript` package is now the API-only 6.0 build (which ships `bin/tsc6`, not
`bin/tsc`), every such script was updated to call the native compiler:

```
- node "../../node_modules/typescript/bin/tsc" -b
+ node "../../node_modules/@typescript/native/bin/tsc" -b
```

Updated in all 8 packages and 7 engines (`packages/*/package.json`,
`engines/*/package.json`). The root `build:ts` / `build:cjs` scripts already use
the hoisted `tsc` binary and needed no change.

## 3. Completing project references (required by 7.0's `tsc -b`)

TypeScript 6.0's solution builder tolerated a couple of workspace imports that
were **not** declared as project `references`. The 7.0 builder is stricter: a
project that imports another composite project in its compiled files (including
`test/**`) must reference it, otherwise a clean `tsc -b` fails with
`TS2307: Cannot find module …`.

Two genuinely missing references were added so a clean build is deterministic:

- `engines/generator-sparql-1-2/tsconfig.json` → `../parser-sparql-1-2`
  (its tests import `@traqula/parser-sparql-1-2`).
- `engines/parser-sparql-1-2/tsconfig.json` → `../../packages/test-utils`
  (its tests import `@traqula/test-utils`).

Both additions were verified to introduce no reference cycles.

## 4. `tsconfig.base.json` modernisation

TypeScript 7.0 adopts the 6.0 defaults and makes some previously-optional flags
mandatory. Redundant options were removed to make the config leaner and match the
new defaults:

```
  "strict": true,
- "strictFunctionTypes": true,          // already implied by `strict`
  "strictPropertyInitialization": false,
  ...
- "sourceMap": true,
- "allowSyntheticDefaultImports": true, // forced-on in 7.0 (cannot be false)
- "esModuleInterop": true               // forced-on in 7.0 (cannot be false)
+ "sourceMap": true
```

- `esModuleInterop` / `allowSyntheticDefaultImports` **cannot be set to `false`**
  in 7.0 and are effectively always on, so the explicit `true` values are
  redundant.
- `strictFunctionTypes` is implied by `strict: true`.
- `strictPropertyInitialization: false` is **kept** – it intentionally disables a
  part of `strict`.
- `types: ["vitest/globals", "node"]` is **kept** – 7.0 changes the `types`
  default to `[]`, so listing the needed ambient packages explicitly is now
  required (the repo already did this).
- `rootDir`, `module`/`moduleResolution: NodeNext`, `target`/`lib: es2022` are
  all still valid and were left unchanged.

## 5. Type-level source code

TypeScript 7.0 preserves 6.0's type-checking semantics (with `stableTypeOrdering`
permanently on), so it introduces **no new type-system syntax/features** to adopt,
and nothing in the existing types newly fails to check. Concretely:

- The one type-inference behaviour change – template-literal types now pulling a
  full Unicode code point for empty placeholders – does not affect this codebase
  (a scan found no `` `${infer …}` `` template-literal type patterns).
- No removed/deprecated compiler options (`baseUrl`, `es5` target,
  `downlevelIteration`, `moduleResolution: node/classic`, `module: amd/umd/…`,
  etc.) were in use anywhere.

## 6. `isolatedDeclarations` for `@traqula/core`

The one genuinely 7.0-relevant lever for a **project-reference library monorepo**
is `isolatedDeclarations`. When enabled, `.d.ts` files can be emitted purely
syntactically (per file, without cross-file type inference), which lets the 7.0
builder emit declarations **in parallel** and removes declaration emit from the
project-reference critical path (the release post explicitly calls this out as
the exception to the project-graph bottleneck).

`@traqula/core` is the root dependency of the whole graph, so making its
declaration emit isolatable has the most leverage. It turned out to need a single
explicit annotation to satisfy the flag:

```
// packages/core/lib/generator-builder/dynamicGenerator.ts
- protected readonly factory = new AstCoreFactory();
+ protected readonly factory: AstCoreFactory = new AstCoreFactory();
```

Changes:

- `packages/core/tsconfig.json` – added `"isolatedDeclarations": true`.
- `packages/core/tsconfig.cjs.json` – added `"isolatedDeclarations": false`
  (the CJS project sets `declaration: false` / `composite: false`, and
  `isolatedDeclarations` requires declaration emit, so it must be disabled there).
- `dynamicGenerator.ts` – the one explicit type annotation above.

This is also a small **correctness/readability** win: every exported declaration
in `core` now has a compiler-verified, explicit public type.

### Not extended repo-wide (yet)

Turning `isolatedDeclarations` on for the whole monorepo would currently require
~400 additional explicit annotations, overwhelmingly in `@traqula/rules-sparql-1-1`
(lexer/grammar tables). That is a valuable but separate, larger refactor and is
left as future work; it can be rolled out package-by-package the same way `core`
was done here.

## 7. Future work

- **Collapse the dual TypeScript setup.** The `@typescript/native` +
  `@typescript/typescript6` alias pair (section 1) exists only because 7.0 ships
  no API. Once `typescript-eslint`, `typedoc`, `dts-bundle-generator` and
  `vitest` publish releases built against the upcoming 7.1 API, revert to a single
  `"typescript": "npm:typescript@^7.x"` dependency, drop the `@typescript/native`
  alias, and restore the per-package build scripts to call plain `tsc`. Note the
  trigger is *tooling support for the new API*, not merely the 7.1 tag.
- **Extend `isolatedDeclarations` to the remaining packages** (see section 6).

## Verification

- `yarn build` – clean build with the native 7.0 compiler (ESM + CJS): ✅
- `yarn lint` – ESLint (via `typescript-eslint` on the 6.0 API): ✅
- `yarn test` – 8400 passed, 100 % line/branch/function/statement coverage: ✅
