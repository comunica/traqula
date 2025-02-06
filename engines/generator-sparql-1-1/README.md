# TRAQULA SPARQL 1.1 generator

TRAQULA Generator Sparql 1.1 is a [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/#grammar) query generator for TypeScript.
It can generate SPARQL given the AST created by [TRAQULA parser SPARQL 1-1](https://github.com/comunica/traqula/tree/main/engines/parser-sparql-1-1).

## Installation

```bash
npm install @traqula/generator-sparql-1-1
```

or

```bash
yarn add @traqula/generator-sparql-1-1
```

## Import

Either through ESM import:

```javascript
import {Parser} from 'engines/generator-sparql-1-1';
```

_or_ CJS require:

```javascript
const Parser = require('engines/generator-sparql-1-1').Parser;
```

## Usage

This package contains a `Generator` that is able to generate SPARQL 1.1 queries:

```typescript
const generator = new Generator();
const abstractSyntaxTree = generator.generate(abstractSyntaxTree);
```
