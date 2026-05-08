# V8 Optimizations for @traqula/core

This document tracks V8 engine optimizations applied to `@traqula/core` and their measured performance impact.

## Baseline

Measured with `yarn bench` before any optimizations:

| Benchmark | Hz (ops/sec) |
|-----------|-------------|
| traqula parse 1.1 (large objectList) | 201.34 |
| traqula parse 1.1 (general queries) | 71.41 |
| traqula no-source tracking | 206.35 |
| traqula parse 1.2 no source tracking | 79.98 |
| traqula parse 1.2 with source tracking | 54.17 |
| traqula toAlgebra 1.1 | 3.11x vs sparqlAlgebra |
| traqula toAlgebra 1.2 | 3.12x vs sparqlAlgebra |
| traqula mapOperation | 1.42x vs sparqlAlgebra |
