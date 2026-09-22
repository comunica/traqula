# SPARQL.js → Traqula transformations

[![npm version](https://badge.fury.io/js/@traqula%2Fsparqljs-traqula-transformations.svg)](https://www.npmjs.com/package/@traqula/sparqljs-traqula-transformations)

If you're moving off [SPARQL.js](https://github.com/RubenVerborgh/SPARQL.js) (it has been deprecated) you don't necessarily want to throw away everything you've already built with it. Maybe you have a query-builder UI assembling SPARQL.js AST fragments, or a saved-queries feature that stores parsed SPARQL.js ASTs. None of that needs to be rewritten. This package converts
SPARQL.js AST - whole queries or just the fragment - into
[Traqula's own SPARQL 1.1 AST](../rules-sparql-1-1), so you can keep using Traqula's parser and generator.

Each piece of the conversion (terms, paths, triples, patterns, expressions, whole queries,
update operations) is its own small, named rule, wired together the way the rest of Traqula wires its
parser and algebra-translation rules together - see
[`algebra-transformations-1-1`](../algebra-transformations-1-1) for the sibling package this one is modeled
on. That allows to swap out one step (for example, a different way of naming blank
nodes).

In most cases you **do not need** this package -
[`@traqula/sparql-js-to-traqula-1-1`](../../engines/sparql-js-to-traqula-1-1) is the one to install, since it
packages these rules up into ready-to-use functions. Use this only if you want to customize one of the
conversion steps.

## Installation

```bash
npm install @traqula/sparqljs-traqula-transformations
```

or

```bash
yarn add @traqula/sparqljs-traqula-transformations
```

## About the types

This depends on `@types/sparqljs` for SPARQL.js' AST shapes. It does *not*
need the actual `sparqljs` package installed - just its types - since it only reads
already-parsed or hand-built SPARQL.js-shaped objects you hand it.

The conversion loses a few things along the way (SPARQL.js already expands prefixed names to full IRIs by
the time you see its AST, for one) - see the [module docs](lib/index.ts) for the full rundown, and the
[migration guide](../../docs/sparqlJSMigration.md) for a worked example.
