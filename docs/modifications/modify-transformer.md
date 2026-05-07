# Modify Transformer

Modifying a transformer follows the same builder pattern as [modifying a parser](./modify-parser.md),
using `IndirBuilder` and `IndirDef` from `@traqula/core` as described in [creating a transformer](./create-transformer.md).

## Modifying Indirection-Based Transformers

As with all builders, **start by creating a copy** of the builder you're extending:

```typescript
import { IndirBuilder } from '@traqula/core';
const myTransformerBuilder = IndirBuilder.create(existingTransformerBuilder);
```

The `IndirBuilder` exposes the following manipulation methods:

- **`getRule(name)`**: Retrieve an existing definition for inspection or wrapping.
- **`patchRule(rule)`**: Replace the implementation of an existing definition.
- **`addRule(rule)`**: Add a new definition (TypeScript errors on name conflict).
- **`addMany(rule1, rule2, ...)`**: Add multiple definitions at once.
- **`deleteRule(name)` / `deleteMany(...names)`**: Remove definitions.
- **`typePatch<{...}>()`**: Update type signatures without changing implementations.
- **`widenContext()`**: Narrow the context type parameter to a more specific subtype.
- **`merge(otherBuilder, overrides)`**: Merge with another `IndirBuilder`.

### Example: Patching a Transformation Step

```typescript
import type { IndirDef } from '@traqula/core';

// Retrieve the original for wrapping
const originalTranslate = existingBuilder.getRule('translateQuery');

// Create a replacement that handles additional AST node types
const extendedTranslate: IndirDef<MyContext, 'translateQuery', AlgebraOp, [QueryAST]> = {
  name: 'translateQuery',
  fun: ({ SUBRULE }) => (ctx, query) => {
    if (query.type === 'myCustomQuery') {
      return SUBRULE(translateMyCustomQuery, query);
    }
    // Fall back to the original for standard queries
    return originalTranslate.fun({ SUBRULE })(ctx, query);
  },
};

const myBuilder = IndirBuilder.create(existingBuilder)
  .addRule(translateMyCustomQuery)
  .patchRule(extendedTranslate);
```

## Modifying AST Tree Transformers

The AST tree transformers (`TransformerObject`, `TransformerTyped`, `TransformerSubTyped`)
are not built through builders — they are instantiated directly with configuration.
To modify their behavior, use the `clone()` method with new defaults:

```typescript
// TransformerObject.clone() takes only a TransformContext:
const simpleTransformer = existingObjectTransformer.clone(
  { ignoreKeys: new Set(['metadata']) },
);

// TransformerTyped and TransformerSubTyped additionally accept
// default node-type pre-visitors as a second argument:
const typedTransformer = existingSubTypedTransformer.clone(
  // New default TransformContext
  { ignoreKeys: new Set(['metadata']) },
  // New default pre-visitors per node type (TransformerTyped/SubTyped only)
  { 'pattern': { continue: false } },
);
```

For details on how to use these transformers, see the [AST structure docs](../usage/AST-structure.md#transform).
