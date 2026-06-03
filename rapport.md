# Rapport: SPARQL 1.1 Tests on the SPARQL 1.2 Parser

## Finding: 1.1 Tests ARE Run on the 1.2 Parser

Yes, all SPARQL 1.1 test suites are executed against the 1.2 parser. In
`engines/parser-sparql-1-2/test/statics.test.ts`, the following test groups
explicitly run 1.1 content against the 1.2 parser:

- **`describe('positive paths')`** — runs all path tests from the `paths` suite.
- **`describe('positive sparql 1.1')`** — runs every positive 1.1 query, comparing
  output while ignoring the new `annotations` field (valid because 1.2 adds
  annotation syntax to triples, absent in pure 1.1 queries).
- **`describe('negative SPARQL 1.1')`** — runs every negative 1.1 test and
  asserts that the 1.2 parser also rejects them.
- **`describe('specific sparql 1.1 with/without source tracking')`** —
  `importSparql11NoteTests` is called with the 1.2 parser, running the entire
  W3C SPARQL 1.1 note test suite against it.

### Negative Tests Filter

No negative 1.1 tests are filtered out for the 1.2 parser: all `sparql-1-1-invalid`
queries are expected to remain invalid under SPARQL 1.2. A filter *is* applied to
the **1.2-specific** negative tests (two tests that are no longer invalid in 1.2
are skipped via a `skip` set).

## Coverage Gap Found

Although the 1.1 tests run correctly on the 1.2 parser, code coverage was below
100% because `packages/rules-sparql-1-2/lib/validators.ts` defines its **own**
`queryProjectionIsGood` function (required because SPARQL 1.2 changed validation
rule §9 per [w3c/sparql-query#380](https://github.com/w3c/sparql-query/pull/380)).
This function is structurally similar to the 1.1 version, but it is a separate
code path, and the existing shared tests did not exercise all of its branches.

The uncovered branches were:

| Lines | Branch | What was missing |
|-------|--------|-----------------|
| 123 | `throw new Error('GROUP BY not allowed with wildcard')` | `SELECT *` with `GROUP BY` not in the test suite |
| 158 | `!groupBy` TRUE (short-circuit) | COUNT aggregate without explicit GROUP BY, expression binding uses ungrouped variable |
| 158 FALSE | condition `!groupBy \|\| !...includes(usedvar)` is FALSE | Expression binding's variable IS in GROUP BY (no throw) — not in test suite |
| 183 | `F.isWildcard(v) ? '*' : …` | Subquery projecting a wildcard (`SELECT *`) — not in test suite |
| 186 FALSE | `subqueryIds.has(selectedVarId)` is FALSE | AS-bound variable not conflicting with subquery — not in test suite |

## Fix — All via Shared Test Infrastructure

Since the 1.1 tests already run on the 1.2 parser, the right fix is to add the
missing cases to the shared test infrastructure rather than as isolated unit tests.
No changes were made to `rules-sparql-1-2/test/validators.test.ts`.

### Three new `sparql-1-1-invalid` static queries

Added to `packages/test-utils/statics/ast/sparql/sparql-1-1-invalid/`. These are
automatically exercised against **both** the 1.1 and 1.2 parsers:

| File | Covers |
|------|--------|
| `select-star-with-group-by.sparql` | line 123 throw |
| `ungrouped-variable-in-expression-projection.sparql` | line 158 throw (groupBy exists) |
| `count-with-ungrouped-expression-variable.sparql` | line 158 `!groupBy` TRUE throw |

### Three new note tests in `importSparql11NoteTests`

Added to `packages/test-utils/lib/Sparql11NotesTest.ts`. These are automatically
run against **both** the 1.1 and 1.2 parsers:

| Test | Covers |
|------|--------|
| AS variable not in subquery (term var projection) | line 183 branch A, line 186 FALSE |
| AS variable not in subquery (wildcard projection) | line 183 branch B, line 186 FALSE |
| Expression projection variable covered by GROUP BY | line 158 FALSE (no throw) |

After the fix, all coverage thresholds (lines, statements, branches, functions)
pass at 100%.
