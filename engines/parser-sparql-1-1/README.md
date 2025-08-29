<p align="center">
    <img alt="Traqula logo" width="70%" style="border-radius: 20px" src="/assets/white-on-red/logo-white-on-red-lettered-social.png">
</p>

<p align="center">
  <strong>A query language transpiler framework for JavaScript</strong>
</p>

# Traqula parser engine for SPARQL 1.1

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
import {Parser} from 'engines/parser-sparql-1-1';
```

_or_ CJS require:

```javascript
const Parser = require('engines/parser-sparql-1-1').Parser;
```

## Usage

This package contains a `Parser` that is able to parse SPARQL 1.1 queries:

```typescript
const parser = new Parser();
const abstractSyntaxTree = parser.parse('SELECT * { ?s ?p ?o }');
```

The package also contains multiple parserBuilders.
These builders can be used either to consume to a parser,
or to usage as a starting point for your own grammar.

### Consuming parserBuilder to parser

At the core of Traqula, parser are constructed of multiple parser rules that have been consumed by the builder.
This consumption returns a parser that can parse strings starting from any grammar rule.

The `sparql11ParserBuilder` for example contains both the rules `queryOrUpdate` and `path` (among many others).
The consumption of `sparql11ParserBuilder` will thus return an object that has function `queryOrUpdate` and `path`.
Calling those function with a string will cause that string to be parsed using the appropriate rule as a starting rule.

```typescript
const parser: {
  queryOrUpdate: (input: string) => SparqlQuery;
  path: (input: string) => PropertyPath | IriTerm;
} = sparql11ParserBuilder.consumeToParser({
  tokenVocabulary: l.sparql11Tokens.build(),
}, {
  parseMode: new Set([ gram.canParseVars, gram.canCreateBlankNodes ]),
  dataFactory: new DataFactory(),
});
```

### Constructing a new grammar from an existing one

The builders can also be used to construct new parsers.
As an example the `triplesBlockParserBuilder` is created by merging the `objectListBuilder` with some new rules.

## Configuration

Optionally, the following parameters can be set in the `Parser` constructor:

* `dataFactory`: A custom [RDFJS DataFactory](http://rdf.js.org/#datafactory-interface) to construct terms and triples. _(Default: `require('@rdfjs/data-model')`)_
* `baseIRI`:  An initial default base IRI. _(Default: none)_
* `prefixes`: An initial map of prefixes
* `skipValidation`: Can be used to disable the validation that used variables in a select clause are in scope.
