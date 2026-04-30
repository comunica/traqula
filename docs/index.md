# Traqula Documentation

The Traqula framework enables a modular definition of parsers, transformers and generators.
This documentation documents Traqula's core design decisions, spanning outside the SPARQL query language to other structured languages.
Traqula does currently NOT support streaming parsing, making it ill-suited for creating a parser for large data files.

## Architecture Overview

Traqula is organized as a monorepo with two categories of packages:

```
@traqula/core                  ← Builder pattern framework (ParserBuilder,
│                                 GeneratorBuilder, IndirBuilder, LexerBuilder,
│                                 Transformers, AST types)
│
├─ @traqula/chevrotain          ← Chevrotain wrapper (ESM + CJS)
│
├─ @traqula/rules-sparql-1-1    ← SPARQL 1.1 grammar rules, AST types, factory
│   ├─ @traqula/rules-sparql-1-2     ← Extends 1.1 for SPARQL 1.2
│   └─ @traqula/rules-sparql-1-1-adjust  ← Extends 1.1 with ADJUST function
│
├─ @traqula/algebra-transformations-1-1  ← AST-to-algebra transformation utilities
│   └─ @traqula/algebra-transformations-1-2
│
└─ Engines (pre-built configurations):
    ├─ @traqula/parser-sparql-1-1, 1-2, 1-1-adjust
    ├─ @traqula/generator-sparql-1-1, 1-2
    └─ @traqula/algebra-sparql-1-1, 1-2
```

**Core** provides the builder infrastructure. **Rules packages** define grammar rules and AST types for specific languages. **Engines** are ready-to-use parser/generator/transformer configurations built from those rules.

Dependent projects typically import an engine's builder (e.g., `sparql12ParserBuilder`) and extend it with custom rules using `addRule()`, `patchRule()`, and `deleteRule()`.

## Guides

### Getting started

If you want to **use** Traqula's engines, learn more in their respective READMEs in the [engines](../engines) directory.

If you want to **extend or create your own** parsers, generators, or transformers, start here:

1. [Guidelines for dependent projects](guidelines.md) — best practices for TypeScript, typing, and builder usage
2. [Create a parser](modifications/create-parser.md)
3. [AST structure](usage/AST-structure.md)
4. [Create a generator](modifications/create-generator.md)
5. [Create a transformer](modifications/create-transformer.md)

### Modifying existing components

1. [Modify a parser](modifications/modify-parser.md)
2. [Modify a generator](modifications/modify-generator.md)
3. [Modify a transformer](modifications/modify-transformer.md)

### Migration guides

When migrating from [SPARQL.JS](https://github.com/RubenVerborgh/SPARQL.js/) or [SPARQLAlgebra.js](https://github.com/joachimvh/SPARQLAlgebra.js):
1. [Migration guide SPARQL.JS](./sparqlJSMigration.md)
2. [Migration guide SPARQLAlgebra.js](./sparqlAlgebraMigration.md)

### Reference

- [Design decisions](./design.md)
- [Transformation catalogue](./transformation-catalogue.md)
- [API documentation (TypeDoc)](https://comunica.github.io/traqula/)
