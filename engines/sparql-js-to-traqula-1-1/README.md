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
Traqula's parser and generator going forward. The input can be SPARQL.js parser output or any AST built to the
same shape. See the [migration guide](../../docs/sparqlJSMigration.md) for background.

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

Like Traqula's parser, the converter rejects a blank node label used in more than one basic graph pattern,
which SPARQL.js does not check. Pass `{ skipValidation: true }` as the last argument to turn this off.

## What SPARQL.js does not keep

The SPARQL.js parser drops some details of the original query, so a query parsed with SPARQL.js and converted
is not always generated back exactly as written:

- **Prefixed names** are expanded to full IRIs. Apply `collapseIrisToPrefixed(ast, prefixes)` to the converted
  AST to get prefixed names back.
- **PREFIX and BASE** are kept as a single map per query or update, so every operation of an update gets the same
  declarations.
- **`[ ... ]` and `( ... )`** are expanded into plain triples with generated blank nodes, and are generated
  back as those triples.
- **Blank node labels** are prefixed by SPARQL.js with `e_` or `g_`; the converter removes that prefix. A label
  such as `_:0` can therefore coincide with a generated blank node.
- **`CONSTRUCT WHERE { ... }`** gets its template filled in by SPARQL.js and is generated back with an explicit
  template. A CONSTRUCT without `template` is converted with an empty template (`CONSTRUCT { } WHERE`), so
  hand-built input for the shorthand should set `template` to the WHERE triples.
- **A leading `+` on numbers** is dropped, so `+5` is generated back as `5`.
- **`^^xsd:string`** is generated back as a plain string: `"b"^^xsd:string` becomes `"b"`. In RDF 1.1 both are
  the same literal, so SPARQL.js gives them the same AST.
- **A trailing `;`** after the last update operation is dropped.

Not supported: SPARQL-star quoted triples, which are not part of SPARQL 1.1. A term without `termType` is
accepted, but a blank node label without the `e_`/`g_` prefix is then read as a variable.

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

`test/statics.test.ts` parses the shared SPARQL 1.1 corpus with SPARQL.js, converts it, generates it with
Traqula and compares the result against a snapshot in `statics/sparql-1-1/`. `test/fromSparqlJs.test.ts`
holds the unit tests.

`spec/converter.ts` runs the same pipeline against the W3C SPARQL test suite (`yarn spec:all`), like
`@traqula/parser-sparql-1-1`'s `spec/parser.ts`. Query and update tests only check that parsing, conversion and
generation succeed.
