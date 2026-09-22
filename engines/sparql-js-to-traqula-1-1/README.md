<p align="center">
    <img alt="Traqula logo" width="70%" style="border-radius: 20px" src="../../assets/white-on-red/logo-white-on-red-lettered-social.png">
</p>

<p align="center">
  <strong>A query language transpiler framework for JavaScript</strong>
</p>

# SPARQL.js to Traqula SPARQL 1.1 AST converter

[![npm version](https://badge.fury.io/js/@traqula%2Fsparql-js-to-traqula-1-1.svg)](https://www.npmjs.com/package/@traqula/sparql-js-to-traqula-1-1)

If you're moving off [SPARQL.js](https://github.com/RubenVerborgh/SPARQL.js) (it has been deprecated) you
don't necessarily want to throw away everything you've already built with it. Maybe you have a
query-builder UI assembling SPARQL.js AST fragments, or a saved-queries feature that stores parsed
SPARQL.js ASTs. None of that needs to be rewritten. This package converts SPARQL.js AST - whole queries or
just the fragment - into [Traqula's SPARQL 1.1 AST](../../packages/rules-sparql-1-1), so you can keep using
Traqula's parser and generator going forward. See the [migration guide](../../docs/sparqlJSMigration.md) for
background and the full list of (one-directional, lossy) conversion decisions.

## Installation

```bash
npm install @traqula/sparql-js-to-traqula-1-1
```

or

```bash
yarn add @traqula/sparql-js-to-traqula-1-1
```

## Usage

```typescript
import { Parser as SparqlJsParser } from 'sparqljs';
import { sparqlQueryFromSparqlJs } from '@traqula/sparql-js-to-traqula-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';

const sparqlJsAst = new SparqlJsParser().parse('SELECT * WHERE { ?s ?p ?o }');
const traqulaAst = sparqlQueryFromSparqlJs(sparqlJsAst);
new Generator().generate(traqulaAst); // 'SELECT * WHERE {\n  ?s ?p ?o .\n}'
```

Besides `sparqlQueryFromSparqlJs` (for a whole `SparqlQuery`/`Update`), every intermediate conversion step
is exported too - `termFromSparqlJs`, `pathFromSparqlJs`, `tripleFromSparqlJs`, `patternFromSparqlJs`,
`expressionFromSparqlJs`, one function per query form, and `updateOperationFromSparqlJs`/
`updateFromSparqlJs` - so a single stored fragment (e.g. just a `Pattern` used as one reusable
query-builder piece) can be converted without a whole query around it.

If you want prefixed names back in generated output (SPARQL.js always resolves them to full IRIs at parse
time), apply `collapseIrisToPrefixed(ast, prefixes)` to the converted AST afterwards.

## Customizing a conversion step

This package is a thin, pre-configured [`IndirBuilder`](../../packages/core) (`sparqlJsToTraqula11Builder`)
over the modular rules in [`@traqula/sparqljs-traqula-transformations`](../../packages/sparqljs-traqula-transformations).
To override a single step (for example a custom blank-node labeling scheme) without forking the rest of the
pipeline:

```typescript
import { IndirBuilder } from '@traqula/core';
import { sparqlJsToTraqula11Builder } from '@traqula/sparql-js-to-traqula-1-1';

const customBuilder = IndirBuilder.create(sparqlJsToTraqula11Builder).patchRule(myCustomTermRule);
```

## A note on tests

`test/statics.test.ts` round-trips the shared SPARQL 1.1 corpus (the same one `@traqula/parser-sparql-1-1`
is tested against) through `sparqljs.Parser` -> this converter -> `@traqula/generator-sparql-1-1`, comparing
the generated output against a stored snapshot per query under `statics/sparql-1-1/`. This is in addition
to the hand-written unit tests in `test/fromSparqlJs.test.ts`.

`spec/converter.ts` wires the same three-step pipeline into the official W3C SPARQL test suite via
`rdf-test-suite` (`yarn spec:all`, mirroring `@traqula/parser-sparql-1-1`'s `spec/parser.ts`), fetched live
from `w3c.github.io/rdf-tests`. Evaluation is out of scope for a converter, so `query`/`update` test cases
only assert that parsing, conversion and regeneration succeed. A handful of official test cases are skipped
via each `spec:*` script's `--skip` regex, for reasons unrelated to this converter's own logic:
- `syn-bad-GRAPH-breaks-BGP`, `syn-bad-UNION-breaks-BGP`, `syn-bad-OPT-breaks-BGP`, `syn-bad-34`..`syn-bad-38`,
  `blabel-cross-*-bad`: negative tests asserting a blank-node label reused across a BGP-breaking construct
  (UNION/OPTIONAL/GRAPH) should be rejected - SPARQL.js' own parser does not enforce this scoping rule (the
  same tests are already skipped for the same reason in `@traqula/parser-sparql-1-2` and
  `@traqula/parser-sparql-1-1-adjust`).
- `syntax-esc-04`, `syntax-esc-05`: SPARQL.js' lexer does not accept `\uXXXX`/`\UXXXXXXXX` escapes inside an
  `IRIREF` (`<x>`), even though the grammar allows them there.
- `syntax-update-1/manifest#test_(38|39|40)`: an update request that is empty apart from comments/prefixes
  (e.g. `PREFIX : <http://example/>\n# Otherwise empty`). SPARQL.js returns a bare `{ prefixes }` object for
  these - neither `type: 'query'` nor `type: 'update'` - so there is nothing to convert (the same edge case,
  `sparql-update-only-prefix`, is excluded from the `statics.test.ts` corpus above for the same reason).
