# Traqula Test utils

[![npm version](https://badge.fury.io/js/@traqula%2Ftest-utils.svg)](https://www.npmjs.com/package/@traqula/test-utils)

Traqula test utils contains developer utilities for testing parsers, generators, and algebra transformers within the Traqula project.

## Installation

```bash
npm install -D @traqula/test-utils
```

or

```bash
yarn add -D @traqula/test-utils
```

## Exports

| Export | Description |
|--------|-------------|
| `positiveTest(type)` | Generator yielding positive parser test cases (query + expected AST) |
| `negativeTest(type)` | Generator yielding negative parser test cases (queries that should fail) |
| `sparqlAlgebraTests(suite, ...)` | Generator yielding algebra transformation test cases |
| `sparqlAlgebraNegativeTests(suite)` | Generator yielding negative algebra test cases |
| `sparqlQueries(suite)` | Generator yielding raw SPARQL query strings |
| `toEqualParsedQuery` | Vitest matcher for deep-comparing parsed ASTs (with RDF term support) |
| `toEqualParsedQueryIgnoring` | Vitest matcher for comparing ASTs while ignoring specified keys |
| `importSparql11NoteTests(parser, DF)` | Registers a suite of SPARQL 1.1 specification note tests |
| `readFile(path)` | Async file reader with line-ending normalization |
| `readFileSync(path)` | Sync file reader with line-ending normalization |
| `getStaticFilePath(...paths)` | Resolves paths relative to the test statics directory |

## Usage

```typescript
import { positiveTest, sparqlAlgebraTests } from '@traqula/test-utils';

// Iterate parser test cases
for (const test of positiveTest('sparql-1-1')) {
  it(test.name, async () => {
    const { query, astWithSource } = await test.statics();
    expect(parser.parse(query)).toEqualParsedQuery(astWithSource);
  });
}
```
