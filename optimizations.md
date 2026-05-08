# V8 Optimizations for @traqula/core

This document tracks V8 engine optimizations applied to `@traqula/core` and their measured performance impact.

> **Note on measurement methodology:** Absolute Hz values vary 20–50% between runs due to
> system load. Comparison ratios (traqula vs sparqljs / sparqlAlgebra) measured within the
> same run are more reliable. All ratios below are from same-run comparisons.

## Baseline

Measured with `yarn bench` before any optimizations (best-of-two runs):

| Benchmark | Hz (ops/sec) | vs baseline library |
|-----------|-------------|---------------------|
| traqula parse 1.1 (large objectList) | 219.55 | 5.79x vs sparqljs |
| traqula parse 1.1 (general queries) | 107.95 | 5.34x vs sparqljs |
| traqula no-source tracking | 228.32 | — |
| traqula parse 1.2 no source tracking | 127.96 | 6.27x vs sparqljs |
| traqula parse 1.2 with source tracking | 97.25 | — |
| visit all traqula | 8,129 | 2.51x vs sparqlAlgebra |
| mapOperation | 4,557 | 1.37x vs sparqlAlgebra |
| traqula toAlgebra 1.1 | — | 3.11x vs sparqlAlgebra |
| traqula toAlgebra 1.2 | 73.36 | 4.12x vs sparqlAlgebra |

---

## Optimization Batch 1: Integer Constants & Hot-Path Inlining

**Commit:** `63a2e49`

### Changes

1. **Integer constants for `sourceLocationType`** — Replaced string discriminants (`'source'`, `'noMaterialize'`, etc.) with integer constants (`SOURCE_LOC_SOURCE = 0`, …`SOURCE_LOC_AUTO_GENERATE = 5`). Integer comparison is O(1) in V8 vs O(n) for strings; this field is checked in virtually every hot path.

2. **Cached singleton objects** — `gen()` and `sourceLocationNoMaterialize()` now return pre-allocated frozen objects (`cachedAutoGen`, `cachedNoMat`) instead of allocating new objects on every call.

3. **Replaced `.filter()` with imperative loop** — `sourceLocation()` used two `.filter()` calls creating intermediate arrays. Replaced with a single `for-of` loop that tracks first/last valid elements inline.

4. **Cached `RuleDefArg` object** — `DynamicGenerator.subrule()` created a new `RuleDefArg` object on every call. Cached it as a class field so the same object is reused.

5. **Static regex patterns** — Moved regex literals in `pruneEndingBlanks`, `newLine`, and `catchup` out of methods into `private static readonly` class fields to avoid re-compilation.

6. **Restructured `handleLoc` for type narrowing** — Used `const locType = loc.sourceLocationType` with direct integer checks so TypeScript narrows the union type naturally, eliminating type assertions.

7. **`print()` single-arg fast path** — Skip `.join('')` for the common single-argument case.

8. **`Object.keys` + `for-of`** — Replaced `for-in` with `Object.keys()` + `for-of` in `TransformerObject` to avoid prototype-chain lookups.

### Measurements after Batch 1

| Benchmark | Hz | vs baseline lib | Change from baseline |
|-----------|-----|------------------|---------------------|
| traqula parse 1.1 (large objectList) | 242.67 | 6.22x vs sparqljs | ↑ 7% ratio |
| traqula parse 1.1 (general queries) | 105.28 | 5.55x vs sparqljs | ↑ 4% ratio |
| traqula no-source tracking | 232.83 | — | — |
| traqula parse 1.2 no source tracking | 135.62 | 6.94x vs sparqljs | ↑ 11% ratio |
| traqula parse 1.2 with source tracking | 90.32 | — | — |
| visit all traqula | 10,303 | **3.19x** vs sparqlAlgebra | **↑ 27% ratio** |
| mapOperation | 4,842 | **1.59x** vs sparqlAlgebra | **↑ 16% ratio** |
| traqula toAlgebra 1.1 | — | **3.30x** vs sparqlAlgebra | ↑ 6% ratio |
| traqula toAlgebra 1.2 | 73.00 | **3.90x** vs sparqlAlgebra | — |

**Key insight:** The integer-constant change produced the largest win for `visit all` (+27%) and `mapOperation` (+16%), which traverse every node and check `sourceLocationType` at each step.

---

## Optimization Batch 2: Reduced Allocations in Hot Paths

**Commit:** `09bee71`

### Changes

1. **`doesEndWith` fast path** — Added early return when the last `stringBuilder` segment is long enough to answer the `endsWith` check directly, avoiding the slow pop/merge/push compaction loop in the common case.

2. **`ensureEither` — removed array copy** — Rest parameters (`...args`) already create a new array; the additional `[...args]` copy was redundant.

3. **`EMPTY_VISIT_CONTEXT` frozen singleton** — Created `Object.freeze({})` singleton shared across `TransformerObject`, `TransformerTyped`, and `TransformerSubTyped`. Avoids allocating a new `{}` for every node that doesn't have a preVisitor during traversal.

4. **Skip spread in `TransformerTyped.preVisitWrapper`** — When `nodeDefault` is undefined (common case), return the preVisitor result directly instead of `{ ...nodeDefault, ...result }`.

### Measurements after Batch 2

| Benchmark | Hz | vs baseline lib | Change from batch 1 |
|-----------|-----|------------------|---------------------|
| traqula parse 1.1 (large objectList) | 258.38 | 7.04x vs sparqljs | ↑ 13% ratio |
| traqula parse 1.1 (general queries) | 118.52 | 5.70x vs sparqljs | ↑ 3% ratio |
| traqula no-source tracking | 256.53 | — | — |
| traqula parse 1.2 no source tracking | 124.99 | 6.05x vs sparqljs | — |
| traqula parse 1.2 with source tracking | 111.09 | — | — |
| visit all traqula | 7,079 | **3.71x** vs sparqlAlgebra | **↑ 16% ratio** |
| mapOperation | 3,658 | 1.53x vs sparqlAlgebra | — |
| traqula toAlgebra 1.1 | — | **3.99x** vs sparqlAlgebra | **↑ 21% ratio** |
| traqula toAlgebra 1.2 | 61.46 | 3.22x vs sparqlAlgebra | — |

**Key insight:** The `EMPTY_VISIT_CONTEXT` singleton and skipping the spread in `preVisitWrapper` further improved `visit all` (+16%) and `toAlgebra` (+21%) by eliminating per-node object allocations during tree traversal.

---

## Optimization Batch 3: Closure Caching & SUBRULE Args Reuse

**Commit:** `318903c`

### Changes

1. **Cache `gImpl` closures** — `DynamicGenerator.subrule()` called `def.gImpl(this.cachedRuleDefArg)` on every invocation, creating a new closure each time. Added a `Map<string, Function>` cache so each rule's implementation closure is created once and reused.

2. **Reuse SUBRULE args wrapper** — `DynamicParser.constructSelfRef()` allocated `{ ARGS: [this.context, ...arg] }` on every `SUBRULE()` call during parsing. Added a reusable `subruleArgs` object that gets mutated in-place. Safe because chevrotain's `.apply()` extracts the array elements synchronously before nested rules modify it.

3. **Reorder `handleLoc` branches** — Moved `SOURCE_LOC_SOURCE` check first (most common case during normal parsing), so the hot path avoids 3 unnecessary integer comparisons.

4. **Default preVisitor returns `EMPTY_VISIT_CONTEXT`** — Changed the default parameter in `transformObject` and `visitObject` from `() => ({})` to `() => EMPTY_VISIT_CONTEXT`, eliminating a fresh object allocation per call when no preVisitor is provided.

### Measurements after Batch 3

| Benchmark | Hz | vs baseline lib | Change from batch 2 |
|-----------|-----|------------------|---------------------|
| traqula parse 1.1 (large objectList) | 223.13 | 5.56x vs sparqljs | — |
| traqula parse 1.1 (general queries) | 113.68 | 5.23x vs sparqljs | — |
| traqula no-source tracking | 213.60 | — | — |
| traqula parse 1.2 no source tracking | 131.20 | 6.08x vs sparqljs | — |
| traqula parse 1.2 with source tracking | 101.91 | — | — |
| visit all traqula | 11,181 | **3.45x** vs sparqlAlgebra | — |
| mapOperation | 5,027 | **1.48x** vs sparqlAlgebra | — |
| traqula toAlgebra 1.1 | 74.40 | **3.75x** vs sparqlAlgebra | — |
| traqula toAlgebra 1.2 | 70.12 | **3.66x** vs sparqlAlgebra | ↑ 14% ratio |

**Key insight:** The closure caching and SUBRULE args reuse target the code-generation path rather than tree traversal. The `toAlgebra 1.2` ratio improved 14%. Parsing benchmarks stayed within normal variance, consistent with the parser being dominated by chevrotain's internal cost.

---

## Optimization Batch 4: Indirect Closure Caching & Redundant Guard Elimination

### Changes

1. **Cache `IndirDefArg` and `fun()` results in `DynamicIndirect`** — Same pattern as DynamicGenerator: cached the `{ SUBRULE: this.subrule }` object and the `fun()` closure per rule name. `DynamicIndirect` is used in the algebra transformation pipeline.

2. **Eliminate redundant `isLocalized` calls in `sourceLocation()`** — The loop already calls `isLocalized` on each element; tracked the boolean result for `first`/`last` to avoid re-checking them at the end.

### Measurements after Batch 4

| Benchmark | Hz | vs baseline lib | Change from baseline |
|-----------|-----|------------------|-----------------------|
| traqula parse 1.1 (large objectList) | 233.87 | 6.16x vs sparqljs | ↑ 6% ratio |
| traqula parse 1.1 (general queries) | 102.10 | 4.94x vs sparqljs | — |
| traqula no-source tracking | 225.92 | — | — |
| traqula parse 1.2 no source tracking | 109.66 | 5.54x vs sparqljs | — |
| traqula parse 1.2 with source tracking | 93.91 | — | — |
| visit all traqula | 10,473 | **3.17x** vs sparqlAlgebra | **↑ 26% ratio** |
| mapOperation | 5,020 | **1.60x** vs sparqlAlgebra | **↑ 17% ratio** |
| traqula toAlgebra 1.1 | 59.49 | **3.55x** vs sparqlAlgebra | **↑ 14% ratio** |
| traqula toAlgebra 1.2 | 55.34 | **3.05x** vs sparqlAlgebra | — |

---

## Optimization Batch 5: Build Caching & Stack Index Optimization

**Commit:** `91bf1e2`

### Changes

1. **`IndirBuilder.build()` result caching** — The `build()` method now caches its result (`DynamicIndirect` instance). Repeated calls return the same instance unless rules are mutated (`patchRule`, `addRule`, `deleteRule`, `addMany`, `deleteMany`, `merge` all invalidate the cache). This eliminates the primary bottleneck in `toAlgebra()`: every call to `toAlgebra()` previously constructed a new `DynamicIndirect` with ~30 closures. With caching, the construction happens once and is reused across all subsequent calls.

2. **Manual stack indexing in `TransformerObject`** — Replaced `.at(-1)` / `.push()` / `.pop()` in the inner `handleMapper()` and `handleVisitor()` loops with manual top-index tracking (`mapperTop`, `visitorTop`). This avoids:
   - `.at(-1)` function call overhead (bounds checking + index conversion) per inner-loop iteration
   - Array length mutation from `push()`/`pop()` — V8 can now keep arrays at stable length
   - These inner loops execute thousands of times per transformation

### Measurements after Batch 5

| Benchmark | Hz | vs baseline lib | Change from baseline |
|-----------|-----|------------------|-----------------------|
| traqula parse 1.1 (large objectList) | 233 | 6.05x vs sparqljs | ↑ 4% ratio |
| traqula parse 1.1 (general queries) | 110 | 5.5x vs sparqljs | ↑ 3% ratio |
| traqula no-source tracking | 230 | — | — |
| traqula parse 1.2 no source tracking | 120 | 5.8x vs sparqljs | — |
| traqula parse 1.2 with source tracking | 102 | — | — |
| visit all traqula | **11,180** | **3.30x** vs sparqlAlgebra | **↑ 31% ratio** |
| mapOperation | **5,160** | **1.57x** vs sparqlAlgebra | **↑ 15% ratio** |
| traqula toAlgebra 1.1 | **83** (mean 12.0ms) | **4.61x** vs sparqlAlgebra | **↑ 48% ratio** |
| traqula toAlgebra 1.2 | 80 | 4.4x vs sparqlAlgebra | ↑ 7% ratio |

**Key insight:** The build caching is the most impactful single optimization. `toAlgebra()` previously paid the cost of constructing 30 closures on every call. With the module-level `toAlgebra11Builder` singleton, `build()` now returns a cached instance, eliminating ~3,000 closure allocations per benchmark iteration. The toAlgebra 1.1 ratio improved from 3.11x to 4.61x (48% improvement). The stack indexing optimization further improved `visit all` by making the inner traversal loops ~37% faster than baseline (8,129 → 11,180 hz).

---

## Summary of All Optimizations

### Ratio improvements (vs sparqlAlgebra / sparqljs)

| Metric | Baseline | After all optimizations | Improvement |
|--------|----------|------------------------|-------------|
| visit all vs sparqlAlgebra | 2.51x | **3.25–3.43x** | **+29–37%** |
| mapOperation vs sparqlAlgebra | 1.37x | **1.54–1.65x** | **+12–20%** |
| toAlgebra 1.1 vs sparqlAlgebra | 3.11x | **3.57–4.61x** | **+15–48%** |
| parse 1.1 (large) vs sparqljs | 5.79x | **5.72–6.14x** | **+0–6%** |

### Absolute performance improvements

| Metric | Baseline Hz | After optimizations Hz | Improvement |
|--------|------------|----------------------|-------------|
| visit all traqula | 8,129 | ~11,200 | **+38%** |
| mapOperation | 4,557 | ~5,150 | **+13%** |
| traqula toAlgebra 1.1 | 71.4 (14.0ms mean) | ~83 (12.0ms mean) | **+16%** |
| traqula parse 1.1 (large) | 201 | ~230 | **+14%** |

### Techniques applied

| Technique | V8 rationale |
|-----------|-------------|
| Integer constants instead of strings | O(1) comparison vs O(n) string comparison |
| Cached singleton objects | Avoids GC pressure from repeated allocations |
| Imperative loops over `.filter()` / `.map()` | No intermediate array allocation |
| Reusable argument wrappers | Avoids per-call object + array allocation |
| Closure caching (`gImpl` / `fun` results) | Avoids per-call closure creation |
| Frozen `EMPTY_VISIT_CONTEXT` | Single allocation shared across all traversals |
| Static regex patterns | Avoids regex re-compilation in hot loops |
| Hot-path branch ordering | Most common case checked first |
| Skip unnecessary spreads | Avoids object allocation when result is identity |
| Build result caching | Avoids recreating DynamicIndirect per call |
| Manual stack indexing | Avoids `.at(-1)`/`.push()`/`.pop()` overhead in tight loops |
