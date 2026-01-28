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
