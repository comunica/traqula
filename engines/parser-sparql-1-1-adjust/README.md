# TRAQULA parser engine for SPARQL 1.1 + Adjust

TRAQULA Sparql 1.1 Adjust is a [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/#grammar) query parser that also parses the [builtin function ADJUST](https://github.com/w3c/sparql-dev/blob/main/SEP/SEP-0002/sep-0002.md) for TypeScript.
Simple grammar extension of [TRAQULA engine-sparql-1-1](https://github.com/comunica/traqula/tree/main/engines/parser-sparql-1-1)

## Installation

```bash
npm install @traqula/parser-sparql-1-1-adjust
```

or

```bash
yarn add @traqula/parser-sparql-1-1-adjust
```

## Import

Either through ESM import:

```typescript
import { Parser } from '@traqula/parser-sparql-1-1-adjust';
```

_or_ CJS require:

```typescript
const Sparql11AdjustParser = require('@traqula/parser-sparql-1-1-adjust').Parser;
```

## Usage

This package contains a `Sparql11AdjustParser` that is able to parse SPARQL 1.1 queries including the [builtin function ADJUST](https://github.com/w3c/sparql-dev/blob/main/SEP/SEP-0002/sep-0002.md):

```typescript
const parser = new Parser();
const abstractSyntaxTree = parser.parse(`
SELECT ?s ?p (ADJUST(?o, "-PT10H"^^<http://www.w3.org/2001/XMLSchema#dayTimeDuration>) as ?adjusted) WHERE {
  ?s ?p ?o
}
`);
```

This parser is a simple grammar extension to the [engine-sparql-1-1](https://github.com/comunica/traqula/tree/main/engines/engine-sparql-1-1).
As such, most, if not all, documentation of that parser holds for this one too.
