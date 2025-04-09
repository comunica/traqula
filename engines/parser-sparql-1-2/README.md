<p align="center">
    <img alt="Traqula logo" width="70%" style="border-radius: 20px" src="/assets/white-on-red/logo-white-on-red-lettered-social.png">
</p>

<p align="center">
  <strong>A query language transpiler framework for JavaScript</strong>
</p>

**WARNING:** V2 will come shortly and will have lots of breaking changes.

# Traqula parser engine for SPARQL 1.2

Traqula Sparql 1.2 is a [SPARQL 1.2](https://www.w3.org/TR/sparql12-query/#grammar) query parser for TypeScript.
It is a grammar extension of [Traqula engine-sparql-1-1](https://github.com/comunica/traqula/tree/main/engines/engine-sparql-1-1)

## Installation

```bash
npm install @traqula/parser-sparql-1-1
```

or

```bash
yarn add @traqula/parser-sparql-1-1
```

## Import

Either through ESM import:

```typescript
import {Parser} from '';
```

_or_ CJS require:

```typescript
const Parser = require('').Parser;
```

## Usage

This package contains a `Parser` that is able to parse SPARQL 1.2 queries:

```typescript
const parser = new Parser();
const abstractSyntaxTree = parser.parse('SELECT * { ?s ?p ?o }');
```

This parser is a simple grammar extension to the [engine-sparql-1-1](https://github.com/comunica/traqula/tree/main/engines/engine-sparql-1-1).
As such, most, if not all, documentation of that parser holds for this one too.
