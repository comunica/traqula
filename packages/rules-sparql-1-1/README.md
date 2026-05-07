# Traqula Rules SPARQL 1.1

[![npm version](https://badge.fury.io/js/@traqula%2Frules-sparql-1-1.svg)](https://www.npmjs.com/package/@traqula/rules-sparql-1-1)

Traqula rules SPARQL 1.1 contains the grammar rules, lexer tokens, AST types, and factory for building [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/#grammar) parsers and generators.

This package is the foundation that the [SPARQL 1.2 rules](../rules-sparql-1-2) and [SPARQL 1.1 + ADJUST rules](../rules-sparql-1-1-adjust) extend.

## Installation

```bash
npm install @traqula/rules-sparql-1-1
```

or

```bash
yarn add @traqula/rules-sparql-1-1
```

## Exports

This package provides the following main exports:

| Export | Description |
|--------|-------------|
| `gram.*` | Grammar rules for SPARQL 1.1 (query, update, expression, pattern, etc.) |
| `lex.*` | Lexer tokens and the `sparql11LexerBuilder` |
| `AstFactory` | Factory for creating SPARQL 1.1 AST nodes |
| `MinimalSparqlParser` | Base class for parser engines |
| `completeParseContext` | Helper to fill in default parse context values |
| `completeGeneratorContext` | Helper to fill in default generator context values |
| `copyParseContext` | Helper to shallow-copy a parse context |
| `sparqlCodepointEscape` | SPARQL codepoint escape preprocessor |
| `AstTransformer` | Type-safe AST visitor/transformer |
| `CommonIRIs` | Enum of commonly used IRI constants (XSD, RDF) |
| `Sparql11types` | TypeScript types for all SPARQL 1.1 AST nodes |

## Usage

This package is primarily used by engine packages and by dependent projects that extend Traqula's grammar.
For end-user parsing and generation, use the engine packages ([`@traqula/parser-sparql-1-1`](../../engines/parser-sparql-1-1), [`@traqula/generator-sparql-1-1`](../../engines/generator-sparql-1-1)) instead.

For guidance on extending grammar rules, see the [guidelines for dependent projects](../../docs/guidelines.md) and the [create a parser](../../docs/modifications/create-parser.md) documentation.
