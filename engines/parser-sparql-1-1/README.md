<p align="center">
    <img alt="Traqula logo" width="70%" style="border-radius: 20px" src="/assets/white-on-red/logo-white-on-red-lettered-social.png">
</p>

<p align="center">
  <strong>A query language transpiler framework for JavaScript</strong>
</p>

# Traqula parser engine for SPARQL 1.1

[![npm version](https://badge.fury.io/js/@traqula%2Fparser-sparql-1-1.svg)](https://www.npmjs.com/package/@traqula/parser-sparql-1-1)

Traqula Sparql 1.1 is a [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/#grammar) query parser for TypeScript.

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

```javascript
import { Parser } from '@traqula/parser-sparql-1-1';
```

_or_ CJS require:

```javascript
const Parser = require('@traqula/parser-sparql-1-1').Parser;
```

## Usage

This package contains a `Parser` that is able to parse SPARQL 1.1 queries:

```typescript
const parser = new Parser();
const abstractSyntaxTree = parser.parse('SELECT * { ?s ?p ?o }');
```

Note that a single parser cannot parse multiple queries in parallel.

The package also contains multiple parserBuilders.
These builders can be used either to consume to a parser, or to usage as a starting point for your own grammar.

Note: it is essential that you reuse created parser to the full extent.
Traqula builds ontop of [Chevrotain](https://chevrotain.io/docs/), an amazing project that allows for the definition of parsers within JavaScript, since the definition of the parser is part of the program, so is the optimization of our parser. Everytime you create a parser, the grammar optimizations need to be computed again.

## Configuration

Optionally, the following parameters can be set in the Parsers defaultContext:

* `dataFactory`: A custom [RDFJS DataFactory](http://rdf.js.org/#datafactory-interface) to construct terms and triples. _(Default: `require('@rdfjs/data-model')`)_
* `skipValidation`: Can be used to disable the validation that used variables in a select clause are in scope. _(Default: `false`)_

### Collecting round tripping information

The generated AST is constructed such that it allows for round tripping.
This means that a parsed query string produces an AST that, when generated from provides **exactly** the same query string.
By default, though, the configured lexer does not collect enough information to enable this because it comes at a small slowdown ([see our report](https://traqula-resource.jitsedesmet.be/#traqula-bench)).
Simply provide the following configuration to the parser, a astFactory that handles source information, and a lexerConfig that states location information should be collected:
```typescript
import { AstFactory } from '@traqula/rules-sparql-1-1';
import { adjustParserBuilder, adjustLexerBuilder, Parser } from '@traqula/parser-sparql-1-1';
const sourceTrackingAstFactory = new AstFactory();
const sourceTrackingParser = new Parser({
  defaultContext: { astFactory: sourceTrackingAstFactory },
  lexerConfig: { positionTracking: 'full' },
});
```
