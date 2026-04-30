# Traqula Rules SPARQL 1.2 package

[![npm version](https://badge.fury.io/js/@traqula%2Frules-sparql-1-2.svg)](https://www.npmjs.com/package/@traqula/rules-sparql-1-2)

Traqula rules SPARQL 1.2 contains additional grammar rules, tokens, and AST types required for creating a parser for [SPARQL 1.2](https://www.w3.org/TR/sparql12-query/#grammar), extending the [SPARQL 1.1 rules](../rules-sparql-1-1).

## Installation

```bash
npm install @traqula/rules-sparql-1-2
```

or

```bash
yarn add @traqula/rules-sparql-1-2
```

## What's added over SPARQL 1.1

This package adds grammar, lexer, and AST type definitions for SPARQL 1.2 features including:

- **Reified triples** (`<<...>>` syntax) and triple terms
- **Annotations** on triples
- **VERSION declaration** (`VERSION 1.2`)
- Updated expression, pattern, and term types

## Exports

| Export | Description |
|--------|-------------|
| `gram.*` | SPARQL 1.2 grammar rule patches and additions |
| `lex.*` | SPARQL 1.2 lexer tokens and `sparql12LexerBuilder` |
| `AstFactory` | Extended factory supporting SPARQL 1.2 AST nodes |
| `Sparql12types` | TypeScript types for all SPARQL 1.2 AST nodes |
| `completeParseContext`, `copyParseContext` | Context helpers (SPARQL 1.2 version) |
| `validators` | SPARQL 1.2 specific validation functions |

## Usage

This package is primarily used by engine packages. For end-user parsing and generation, use [`@traqula/parser-sparql-1-2`](../../engines/parser-sparql-1-2) and [`@traqula/generator-sparql-1-2`](../../engines/generator-sparql-1-2).

For guidance on extending the grammar, see the [guidelines for dependent projects](../../docs/guidelines.md).
