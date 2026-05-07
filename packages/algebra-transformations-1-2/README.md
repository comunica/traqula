# Traqula algebra transformations 1.2

[![npm version](https://badge.fury.io/js/@traqula%2Falgebra-transformations-1-2.svg)](https://www.npmjs.com/package/@traqula/algebra-transformations-1-2)

Traqula algebra transformations 1.2 contains transformation functions for translating the [Traqula AST for SPARQL 1.2](../rules-sparql-1-2) into SPARQL Algebra. These transformation definitions extend the [SPARQL 1.1 transformations](../algebra-transformations-1-1) with support for SPARQL 1.2 features such as reified triples and triple terms.

## Installation

```bash
npm install @traqula/algebra-transformations-1-2
```

or

```bash
yarn add @traqula/algebra-transformations-1-2
```

## What's added over SPARQL 1.1 transformations

- Handling of **reified triple** and **triple term** nodes in AST-to-algebra conversion
- Updated `inScopeVariables` to account for SPARQL 1.2 constructs
- Updated `createAlgebraContext` for SPARQL 1.2

## Usage

This package is primarily used by [`@traqula/algebra-sparql-1-2`](../../engines/algebra-sparql-1-2).
For end-user algebra transformation, use the engine package directly.

For guidance on extending transformations, see the documentation on [creating](../../docs/modifications/create-transformer.md) and [modifying](../../docs/modifications/modify-transformer.md) transformers.
