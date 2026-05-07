# Modify Generator

Modifying a generator follows the same builder pattern as [modifying a parser](./modify-parser.md),
but using `GeneratorBuilder` and `GeneratorRule` from `@traqula/core`.

## Copy First

As with all builders, **start by creating a copy** of the generator builder you're extending:

```typescript
import { GeneratorBuilder } from '@traqula/core';
const myGeneratorBuilder = GeneratorBuilder.create(existingGeneratorBuilder);
```

## Modifying Generator Rules

The `GeneratorBuilder` exposes the same manipulation methods as the `ParserBuilder`:

- **`getRule(name)`**: Retrieve an existing generator rule by name for inspection or wrapping.
- **`patchRule(rule)`**: Replace the implementation of an existing rule.
- **`addRule(rule)`**: Add a new generator rule.
- **`addMany(rule1, rule2, ...)`**: Add multiple rules at once (see [guidelines](../guidelines.md#use-addmany-for-batch-rule-registration)).
- **`deleteRule(name)` / `deleteMany(...names)`**: Remove rules by name.
- **`typePatch<{...}>()`**: Update type signatures without changing implementations.
- **`widenContext()`**: Narrow the context type parameter to a more specific subtype.
- **`merge(otherBuilder, overrides)`**: Merge with another `GeneratorBuilder`.

### Example: Patching an Existing Rule

Suppose you've extended a parser with a new `path` rule that returns a narrower type.
The corresponding generator rule needs to handle this changed AST structure:

```typescript
import type { GeneratorRule } from '@traqula/core';

// Retrieve the original to understand its signature
const originalPath = existingGeneratorBuilder.getRule('path');

// Create a replacement that handles the new AST shape
const patchedPath: GeneratorRule<MyContext, 'path', MyNewPathType> = <const> {
  name: 'path',
  gImpl: ({ PRINT, SUBRULE }) => (ast, context) => {
    context.astFactory.printFilter(ast, () => {
      // Generate using the new path structure
      PRINT(ast.value);
    });
  },
};

const myGeneratorBuilder = GeneratorBuilder.create(existingGeneratorBuilder)
  .patchRule(patchedPath);
```

### Example: Adding a New Rule

When your extended grammar introduces new AST node types, add corresponding generator rules:

```typescript
const myNewNodeGen: GeneratorRule<MyContext, 'myNewNode', MyNewNodeAST> = <const> {
  name: 'myNewNode',
  gImpl: ({ PRINT, SUBRULE, PRINT_WORD }) => (ast, { astFactory: F }) => {
    F.printFilter(ast, () => {
      PRINT_WORD('MY_KEYWORD');
      SUBRULE(someExistingRule, ast.child);
    });
  },
};

const myGeneratorBuilder = GeneratorBuilder.create(existingGeneratorBuilder)
  .addRule(myNewNodeGen);
```

## Round-Tripping Constraints

When modifying generator rules, keep these constraints in mind to preserve round-tripping support:

1. **Preserve SUBRULE generation order**: Generate subnodes in the same order they appear in the source string. If node A appears before node B in the source, generate A before B.
2. **Preserve range nesting**: Descendant nodes must represent subranges of their parent's range.
3. **Use `printFilter`**: Always wrap your PRINT calls with `astFactory.printFilter(ast, () => ...)` to respect the node's source location. This ensures round-tripping works correctly when the node is sourced from the original string rather than auto-generated.

For more details on round-tripping, see the [generator creation docs](./create-generator.md#round-tripping) and the [AST structure docs](../usage/AST-structure.md#source-location).
