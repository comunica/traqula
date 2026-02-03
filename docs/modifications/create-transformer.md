# Create Transformer

Transformations exist on two levels.
First we have the small transformations already discussed under [the AST structure docs](../usage/AST-structure.md).
Those transformations help iterate any tree following the format `{ type: string, subType?: string }` (which includes [our SPARQL Algebra](../../packages/algebra-transformations-1-1/lib/algebra.ts)).

More complex transformations can be constructed in a modular fashion using the same indirection mechanism used for the parser and generator constructor:

![img.png](traqula-rulemap-single.svg)

## InirectionRule
