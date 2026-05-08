# Code Smell Evaluation Report

**Inline filter loop replacing .filter() in sourceLocation():** reverted — No measurable benefit; benchmark variance (up to 66% within same version) dwarfed any signal, and control benchmark (`no_source`) confirmed noise dominates. Clean `.filter()` + `.at()` version kept.

**Manual for-break loops replacing .some() in ensureEither():** reverted — Run-to-run variance up to 22% (toAlgebra 1.1: 63→77 Hz across two clean runs) dwarfs any signal; results flip direction between runs (e.g., toAlgebra 1.2: -10.9% then +0.1%). Clean `.some()` version kept.

**Manual stack indexing replacing push/pop in TransformerObject:** kept — Large consistent gains across all benchmarks: visit all traqula +60% (6,963→11,153 Hz), findvars visitObjects +72% (1,708→2,942 Hz), mapOperation +20% (4,360→5,242 Hz), toAlgebra 1.1 +25% (60.7→75.6 Hz), toAlgebra 1.2 +17% (70.9→83.2 Hz). All well above 5% threshold; optimization justified despite readability cost.

**Reusable mutable ARGS wrapper in dynamicParser:** reverted — No consistent benefit; results flip direction across benchmarks (e.g., parse large objectList: optimized 204 Hz vs clean 242 Hz; 1.2 no-source: 128 vs 123 Hz). All differences within noise. Clean `{ ARGS: [this.context, ...arg] }` version kept.

**Inlined print calls duplicating handeEnsured+push:** reverted — No consistent benefit; run-to-run variance dwarfs any signal (e.g., toAlgebra 1.2: optimized 49–75 Hz vs clean 65–91 Hz; no-source tracking: 132→245 Hz between two clean runs). Results flip direction across runs. Clean `this.print()` version kept.

**Single-arg fast path in print():** reverted — No consistent benefit; results flip direction across benchmarks (toAlgebra 1.1: optimized 61.7 Hz vs clean 83.6 Hz; no-source tracking: optimized 235.1 Hz vs clean 109.9 Hz). Run-to-run variance dwarfs any signal. Clean `args.join('')` version kept.
