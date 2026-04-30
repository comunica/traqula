# Design Decisions

This document explains key design decisions made in Traqula and the rationale behind them.

## Round Tripping

We decided to implement round tripping by creating a `location` field for each AST node.
The location indicates a source string and a start and end index of the string representation of that AST node within the source string.
To reduce string repetitions, an undefined source string means this node shares the same source string as its parent.

### Why not inline round-trip data in the AST?

We considered round tripping where spaces and special cases were captured as part of a round tripping type (RTT) field in each AST,
but that solution was not maintainable. The issue was that some strings are not materialized in the AST such as an empty group: `{  {  } . } }.`
Tracking this as part of the AST creates a complex 'ownership' problem.
Additionally capturing the complexity of all edge-cases proved to be difficult on a grammar basis, as such, reasoning over code became a nightmare.
Lastly, capturing round tripping info in your AST types creates for a strongly types AST, but that comes with a maintainability tradeoff.
Looking back, there were many issues with the approach.
The reason it was attempted in the first place was so IDE-like tooling could be implemented easily since the RTT types could be edited themselves,
instead of editing the string representations.

For more details on source location types, see [AST structure — Source Location](usage/AST-structure.md#source-location).

## Builder Pattern

Traqula uses the [builder pattern](https://refactoring.guru/design-patterns/builder) for composing parsers, generators, and transformers. The key reasons:

1. **Rule-level modularity**: Unlike traditional grammar inheritance (class-level), builders allow adding, removing, and patching individual grammar rules.
2. **Type safety**: Each builder tracks its registered rule names as TypeScript string literal types, enabling compile-time detection of duplicate names and type mismatches.
3. **Composability**: Builders can be merged, making it possible to combine independent grammar fragments (e.g., query rules + update rules).
4. **Mutability with copying**: Builders mutate in-place for performance, but `create()` makes a copy, so shared builders aren't corrupted. See the [guidelines](guidelines.md#always-copy-builders-before-modifying).

## Altered AST from SPARQL.JS

This library will replace [SPARQL.JS](https://github.com/RubenVerborgh/SPARQL.js/) in the Comunica project, as such there was a debate on whether the AST should be the same since it would require minimal refactoring.
In the end we decided to change the AST to be closer to typical ASTs so language tooling could easily be integrated on top of the generator output.
Converting the AST to algebra was previously done by [SPARQL algebra.js](https://github.com/joachimvh/SPARQLAlgebra.js),
which will be merged as a package in this monorepo.
It will be up to the algebra generator to optimize the AST to a structure most suitable by query engines such as Comunica.

For migration details, see:
- [Migration guide from SPARQL.JS](sparqlJSMigration.md)
- [Migration guide from SPARQLAlgebra.js](sparqlAlgebraMigration.md)

## Generation

Our generator must support
replacement operations like: https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-replacing-a-node
but also replacements with specific string formats. using `path.replaceWith(F.someType(..., { source: 'own string', start: 0, end: length-1; }))`

The generator is initialized with sources and skip-ranges.
A rule sharing source with parent will start with a catchup, only afterward will it start generating underlying rules.
The catchup function of the generator knows when a rule is replaced since it will be registered as a skip-range, and skip-ranges are not generated using catchup's.

Generation rules that have an ast that is not Localized SHOULD NOT print since they do not auto catchup.

Currently, the constructed generator does not support that you have a source tracked node within something that is generated.
That means that you need to use `F.forcedAutoGenTree()` to force the whole subtree on some node to be auto generated too.
In the future we could change this implementation in such a way that we would detect when source bound nodes are present and use range arithmetics.
We do not do that yet to keep things simple.

## Altering subrule results

Be careful when recreating nodes that have been created by subrules since the recreation might lose information if a modified grammar adds more fields to the node.
Example, do:
```
res[0].subject = subject;
res[0].loc = C.factory.sourceLocation(subject, res[0]);
// WARNING for future use: overwriting elements like this is
//  bad practice since it will remove future extensions
// res[0] = C.factory.triple(subject, predicate, object, C.factory.sourceLocation(subject, object));
```

## See Also

- [AST structure](usage/AST-structure.md) — details on the AST node types and source location
- [Guidelines for dependent projects](guidelines.md) — best practices for extending Traqula
- [Create a parser](modifications/create-parser.md) — step-by-step parser creation guide
