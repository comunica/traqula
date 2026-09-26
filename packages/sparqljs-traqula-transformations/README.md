# SPARQL.js to Traqula transformations

[![npm version](https://badge.fury.io/js/@traqula%2Fsparqljs-traqula-transformations.svg)](https://www.npmjs.com/package/@traqula/sparqljs-traqula-transformations)

The conversion rules behind [`@traqula/sparql-js-to-traqula-1-1`](../../engines/sparql-js-to-traqula-1-1): they turn
SPARQL.js-compatible AST (SPARQL.js parser output or hand-built equivalents) into
[Traqula's SPARQL 1.1 AST](../rules-sparql-1-1). See that package's README for why you would want this and how to use it.

Each piece of the conversion (terms, paths, triples, patterns, expressions, queries, update operations) is its own
named rule, wired together like [`algebra-transformations-1-1`](../algebra-transformations-1-1). This allows you to
swap out one step, for example a different way of naming blank nodes. If you don't need that, install
`@traqula/sparql-js-to-traqula-1-1` instead.

## Installation

```bash
npm install @traqula/sparqljs-traqula-transformations
```

or

```bash
yarn add @traqula/sparqljs-traqula-transformations
```

## Types

This depends on `@types/sparqljs` for the shape of SPARQL.js AST. It does *not* need the `sparqljs` package itself,
as it only reads the objects you pass in.
