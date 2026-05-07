# Traqula Rules SPARQL 1.1 + ADJUST package

[![npm version](https://badge.fury.io/js/@traqula%2Frules-sparql-1-1-adjust.svg)](https://www.npmjs.com/package/@traqula/rules-sparql-1-1-adjust)

Traqula rules SPARQL 1.1 + ADJUST contains additional grammar rules and lexer tokens for the [ADJUST built-in function](https://github.com/w3c/sparql-dev/blob/main/SEP/SEP-0002/sep-0002.md), extending the [SPARQL 1.1 rules](../rules-sparql-1-1).

## Installation

```bash
npm install @traqula/rules-sparql-1-1-adjust
```

or

```bash
yarn add @traqula/rules-sparql-1-1-adjust
```

## Exports

| Export | Description |
|--------|-------------|
| `gram.*` | Grammar rules for the ADJUST built-in function |
| `lex.*` | Lexer token for the `ADJUST` keyword |

## Usage

This package is used by [`@traqula/parser-sparql-1-1-adjust`](../../engines/parser-sparql-1-1-adjust).
The ADJUST function allows adjusting date/time values in SPARQL queries:

```sparql
SELECT (ADJUST(?date, "-PT10H"^^xsd:dayTimeDuration) AS ?adjusted) WHERE { ... }
```

For guidance on extending the grammar, see the [guidelines for dependent projects](../../docs/guidelines.md).
