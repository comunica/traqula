# Algebra test fixtures

This directory holds the static fixtures used by the algebra-conversion tests in
`engines/algebra-sparql-1-1` and `engines/algebra-sparql-1-2`.

Every test case is **one SPARQL query**, represented **five times**. All five representations live at the *same relative path*, which is how the
test generators pair them up.

```
statics/algebra/
├── sparql/                        <suite>/.../NN.sparql          the input query
├── algebra/                       <suite>/.../NN.json             expected algebra (blankToVariable: false)
├── algebra-blank-to-var/          <suite>/.../NN.json             expected algebra (blankToVariable: true)
└── canonical-sparql/
    ├── base/                      <suite>/.../NN.sparql            algebra → AST → generator round-trip (blankToVariable: false)
    └── blank-to-var/              <suite>/.../NN.sparql            same round-trip (blankToVariable: true)
```

`<suite>` is one of the `AlgebraTestSuite` values: `dawg-syntax`, `sparql-1.1`,
`sparql11-query`, `sparql12`.

`sparql/` additionally has `sparql-1.1-negative`
and `sparql-1.2-negative` folders for queries that are expected to *fail*
algebra translation (see `sparqlAlgebraNegativeTests`). Those only need a
`.sparql` file, no counterparts elsewhere.

`algebra/` and `canonical-sparql/base/` additionally have a
`sparql-1.1-algebra-only` folder for algebra in a different form than
`toAlgebra` produces, such as algebra that other tools build or rewrite.
`toAst` must still translate it to an equivalent SPARQL query (see
`sparqlAlgebraOnlyTests`). Those only need a `.json` file in
`algebra/` and a `.sparql` file in `canonical-sparql/base/`, no counterparts
elsewhere. Both the SPARQL 1.1 and the SPARQL 1.2 engine run them.

Fixtures whose name ends in `-named-aggregators` are translated with
`verifyWithNamedAggregators` containing `http://example.org/median` (see `algebraTestNamedAggregators`),
so that function call is translated as a custom aggregate.

## What each folder is for

- **`sparql/`**: the SPARQL query text. This is the only file you actually
  have to hand-write. Everything else can be generated from it.
- **`algebra/`**: the SPARQL algebra tree the query should translate to, as
  JSON, with blank nodes preserved as blank nodes.
- **`algebra-blank-to-var/`**: the same algebra tree, but produced with the
  `blankToVariable: true` option (blank nodes rewritten to variables). This
  matters for constructs where blank nodes and their variable-rewritten form
  differ.
- **`canonical-sparql/base/`**, **`canonical-sparql/blank-to-var/`**: the
  algebra tree converted *back* to an AST and re-generated as SPARQL text. This
  isn't necessarily identical to the original query (whitespace, operator
  order, and implicit defaults get normalized), but it should be an equivalent
  query. Comparing this "canonical" form is how the AST↔algebra round-trip
  gets tested independently of the algebra JSON.

## Adding a new test case

1. **Write the SPARQL query.**

    Drop a `.sparql` file under `sparql/<suite>/<...>/<name>.sparql`.

    *Skip step 2-3 if you added a negative test.*

2. **Generate the other four files automatically.**

    Use the generator scripts:

    - `engines/algebra-sparql-1-1/test/generateJson.test.ts` for
    `dawg-syntax`, `sparql-1.1`, `sparql11-query`.
    - `engines/algebra-sparql-1-2/test/generateJson.test.ts` for `sparql12`.

    Change `describe.skip(...)` to `describe(...)` in the script.

    Run the script with vitest, e.g. from the repo root:
    ```
    yarn vitest run engines/algebra-sparql-1-<X>/test/generateJson.test.ts
    ```
    (Change `<X>` to the correct version)

    Change `describe(...)` back to `describe.skip(...)`.

3. **Run all tests** to confirm the new fixture passes:
   ```
   yarn test
   ```

## Adding an algebra-only test case

1. **Write the algebra.**

    Drop a `.json` file under `algebra/sparql-1.1-algebra-only/<...>/<name>.json`.
    You can build the algebra with the `AlgebraFactory` and serialize it with
    `JSON.stringify(algebraUtils.objectify(algebra), null, 2)`.

2. **Write the SPARQL query it must translate to.**

    Drop a `.sparql` file at the same relative path under
    `canonical-sparql/base/`. Write it by hand: this query is the expected
    output of the test, so the generator scripts do not create it.

3. **Run the tests** that consume these fixtures, from the repo root:
   ```
   yarn vitest run engines/algebra-sparql-1-1/test/sparql.test.ts engines/algebra-sparql-1-2/test/sparql.test.ts
   ```
