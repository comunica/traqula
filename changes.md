# API Changes on `perf/optimize-for-v8-bis`

## Reverted Breaking Changes

### `sourceLocationType` string-to-number conversion
The branch originally changed `sourceLocationType` from string literals (`'source'`, `'inlinedSource'`, `'noMaterialize'`, `'stringReplace'`, `'nodeReplace'`, `'autoGenerate'`) to integer constants (`0`–`5`). This was reverted because it breaks downstream code that compares `sourceLocationType` against string values.

## Non-Breaking API Additions

### New public fields on `AstCoreFactory`
- `cachedAutoGen: SourceLocationNodeAutoGenerate` — cached singleton for `{ sourceLocationType: 'autoGenerate' }`.
- `cachedNoMat: SourceLocationNoMaterialize` — cached singleton for `{ sourceLocationType: 'noMaterialize' }`.

These are `public readonly` properties. Callers of `gen()` and `sourceLocationNoMaterialize()` now receive the same cached instance rather than a fresh object each time.

### New export: `EMPTY_VISIT_CONTEXT`
A frozen empty object (`Object.freeze({})`) exported from `TransformerObject` and re-exported from `@traqula/core`. Used internally as a default return value for `preVisitor` callbacks to avoid allocating a new `{}` on every node.
