# Guidelines for Dependent Projects

This guide provides best practices for projects that extend Traqula's parsers, generators, or transformers.
For a real-world example, see [shacl-rules-parser](https://github.com/jitsedesmet/shacl-rules-parser),
which extends Traqula's SPARQL 1.2 parser with custom grammar.

## Always Type Your Grammar Rules

When defining grammar rules in TypeScript, **always explicitly provide the type parameters**.
This ensures the builders know the exact name and return type of each rule at compile time,
enabling compile-time validation against duplicate names and type mismatches.

```typescript
import type { ParserRule } from '@traqula/core';

// ✅ Good: explicit type parameters
const myRule: ParserRule<MyContext, 'myRule', MyReturnType> = {
  name: 'myRule',
  impl: ({ CONSUME, ACTION }) => (C) => {
    const token = CONSUME(MyToken);
    return ACTION(() => ({ /* ... */ }));
  },
};

// ❌ Bad: no type annotation — TypeScript infers broader types
const myRule = {
  name: 'myRule',
  impl: ({ CONSUME, ACTION }) => (C) => {
    const token = CONSUME(MyToken);
    return ACTION(() => ({ /* ... */ }));
  },
};
```

The same applies to `GeneratorRule` and `IndirDef`:

```typescript
import type { GeneratorRule, IndirDef } from '@traqula/core';

const myGenRule: GeneratorRule<MyContext, 'myRule', MyAstType> = {
  name: 'myRule',
  gImpl: ({ PRINT, SUBRULE }) => (ast, context) => {
    PRINT(ast.value);
  },
};

const myIndirDef: IndirDef<MyContext, 'myFunction', number, [number]> = {
  name: 'myFunction',
  fun: ({ SUBRULE }) => (context, input) => input + 1,
};
```

> [!important]
> When defining a rule as an object literal, use the `<const>` assertion or `satisfies` keyword
> to preserve the string literal type of the `name` field:
> ```typescript
> const myRule = <const> {
>   name: 'myRule',
>   impl: /* ... */
> };
> // or
> const myRule = {
>   name: 'myRule',
>   impl: /* ... */
> } satisfies ParserRule<MyContext, 'myRule', MyReturnType>;
> ```

## Use `addMany` for Batch Rule Registration

When adding multiple rules to a builder, prefer `addMany()` over chaining individual `addRule()` calls.
The `addMany()` method uses rest parameters (`...rules`), which provides **better TypeScript type inference**
than the sequential type narrowing that happens with chained calls.

```typescript
// ✅ Preferred: addMany for batches
const builder = ParserBuilder
  .create(existingBuilder)
  .addMany(ruleA, ruleB, ruleC, ruleD);

// ⚠️ Acceptable for small additions, but can cause excessive type inference with many rules
const builder = ParserBuilder
  .create(existingBuilder)
  .addRule(ruleA)
  .addRule(ruleB)
  .addRule(ruleC)
  .addRule(ruleD);
```

> [!warning]
> Do not pass too many rules to a single `.create()` or `.addMany()` call.
> When the number of rules grows large, TypeScript's type checker may struggle with the deeply nested
> mapped types, producing cryptic errors similar to those you'd see with duplicate rule names.
> In such cases, split into multiple `.addMany()` calls.

The same guidance applies to `GeneratorBuilder.addMany()` and `IndirBuilder.addMany()`.

## Always Copy Builders Before Modifying

Traqula's builders (`ParserBuilder`, `GeneratorBuilder`, `IndirBuilder`, `LexerBuilder`) are **mutable** —
methods like `addRule()`, `patchRule()`, and `deleteRule()` modify the builder in place.
To avoid corrupting an upstream builder that other consumers depend on,
**always start by creating a copy**:

```typescript
// ✅ Good: copy first
const myBuilder = ParserBuilder.create(sparql12ParserBuilder)
  .addRule(myNewRule);

// ❌ Bad: mutates the shared builder
sparql12ParserBuilder.addRule(myNewRule);
```

The same applies to `LexerBuilder.create(existingLexerBuilder)`,
`GeneratorBuilder.create(existingGeneratorBuilder)`, and `IndirBuilder.create(existingIndirBuilder)`.

## Choosing Between `patchRule`, `typePatch`, and `deleteRule`

These three methods serve different purposes when modifying an inherited grammar:

| Method | When to use |
|--------|-------------|
| `patchRule(rule)` | Replace the **implementation** of an existing rule. The new rule must have the same name. |
| `typePatch<{...}>()` | Update **only the type signature** of rules whose return types or parameters changed due to upstream patches. No implementation change needed. |
| `deleteRule(name)` | Remove a rule entirely. Use when a patched grammar makes certain parent rules unreachable. |

Example workflow when restricting a grammar:

```typescript
const myBuilder = ParserBuilder.create(sparql12ParserBuilder)
  // Replace the implementation of 'path' with a restricted version
  .patchRule(restrictedPath)
  // 'pathAlternative' is no longer reachable with our restricted path
  .deleteRule('pathAlternative')
  // 'someRule' still has the same impl, but its return type changed
  //   because the patched 'path' now returns a narrower type
  .typePatch<{
    someRule: [NewReturnType],
  }>();
```

## Occurrence Numbering (CONSUME, SUBRULE, OR, etc.)

Chevrotain requires unique occurrence indices when the **same DSL method** is used multiple times
within a single rule. This applies to `CONSUME`, `SUBRULE`, `OR`, `OPTION`, `MANY`, `AT_LEAST_ONE`,
and their `_SEP` variants.

```typescript
const myRule: ParserRule<Ctx, 'myRule', Result> = {
  name: 'myRule',
  impl: ({ CONSUME, CONSUME2, SUBRULE, SUBRULE2, OR }) => (C) => {
    // First use of CONSUME and SUBRULE — no suffix needed
    const first = CONSUME(LParen);
    const child1 = SUBRULE(someRule);

    // Second use — use the "2" suffix
    CONSUME2(RParen);
    const child2 = SUBRULE2(someRule);

    // ...
  },
};
```

> [!note]
> The numbering is per-rule and per-DSL-method. `CONSUME` and `SUBRULE` each have their own counter.
> Suffixes go from `1` (or no suffix) to `9`.

## Accessing Parent Rules

Use `getRule()` to retrieve a rule from an existing builder for inspection or wrapping:

```typescript
// Access by string literal (type-checked against builder's known rules)
const originalRule = sparql12ParserBuilder.getRule('graphPatternNotTriples');

// Access using the rule's name property (equivalent, useful for refactoring safety)
const originalRule = sparql12ParserBuilder.getRule(someImportedRule.name);
```

A common pattern is wrapping a parent rule to add alternatives:

```typescript
const originalGraphPattern = existingBuilder.getRule('graphPatternNotTriples');
const extendedGraphPattern: typeof originalGraphPattern = <const> {
  name: originalGraphPattern.name,
  impl: ($) => (C) => $.OR([
    { ALT: () => $.SUBRULE(myNewPatternRule) },
    { ALT: () => originalGraphPattern.impl($)(C) },
  ]),
};
```

## Error Handling

When building a parser, you can provide a custom `errorHandler` to control how parse errors are reported:

```typescript
const parser = myParserBuilder.build({
  tokenVocabulary: myLexerBuilder.tokenVocabulary,
  errorHandler: (errors) => {
    const firstError = errors[0];
    throw new Error(`Parse error at line ${firstError.token.startLine}: ${firstError.message}`);
  },
});
```

If no `errorHandler` is provided, the builder uses a default handler that throws on the first error.
When `positionTracking` is set to `'full'` in the lexer configuration, the default handler formats the error
with line information and a caret pointing to the error position.

## Expose Your Builders, Tokens, and Rules

When publishing your extended parser/generator, **export the builders, individual grammar rules,
and token definitions** — not just the final built parser.
This allows downstream projects to further extend your grammar:

```typescript
// ✅ Good: export building blocks
export { myLexerBuilder } from './lexer.js';
export { myParserBuilder } from './parser.js';
export { myNewRule, myOtherRule } from './grammar/rules.js';
export { MyKeyword, MyToken } from './tokens.js';
export { MyParser } from './MyParser.js'; // The convenience wrapper

// ❌ Bad: only export the final parser
export { MyParser } from './MyParser.js';
```

## Testing

When developing a modified parser or generator:

1. **Disable `skipValidations`** during development. Chevrotain validates your grammar for ambiguities
   and unreachable alternatives. Only enable `skipValidations: true` in production once the grammar is stable.

2. **Test round-tripping** by parsing a query and regenerating it:
   ```typescript
   const ast = parser.parse(query);
   const regenerated = generator.generate(ast);
   expect(regenerated).toBe(query);
   ```

3. **Reuse parser instances.** Building a parser is expensive due to Chevrotain's grammar recording.
   Create the parser once and reuse it across test cases.

## Naming Conventions

- **Rule names**: Start with a lowercase letter (e.g., `'myCustomRule'`, `'shaclRuleBlock'`).
- **Token names**: Start with an uppercase letter (e.g., `'MyKeyword'`, `'TransitiveKeyword'`).
- **Use string literal types**: The `name` field should be a specific string literal, not just `string`.
