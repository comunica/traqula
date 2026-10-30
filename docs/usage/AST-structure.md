# AST Manipulation

Traqula, through its parser and generator allows you to parse, manipulate and generate queries.
This manipulation can be done in a [round-tripping](https://en.wikipedia.org/wiki/Round-trip_format_conversion) fashion, empowering powerful tools useful for structured languages (e.g. [linters](https://en.wikipedia.org/wiki/Lint_(software))).

This documentation page goes into detail on the AST structure used by Traqula and how to both create and modify ASTs.

## AST Structure

The AST structure is declared using TypeScript types as a [tree](https://en.wikipedia.org/wiki/Tree_(abstract_data_type)) of [@traqula/core Nodes](../../packages/core/lib/types.ts#L37).
The AST nodes contain the information to identify the _type_ and _subType_ of the AST-node, and also contain information to round-trip the node through the _SourceLocation information_.

### Source Location

The source location (`loc`) optionally relates an AST-node to the string character range the node represents.
This information is then used by the Traqula core generator to enable round-tripping.

There are six kinds of source location information:
1. **SourceLocationSource**: Relate the node to the source through a character range.
   Used by the parser to indicate where in the input string this node came from.
2. **SourceLocationInlinedSource**: Add a new source indicating what part of the new source this node represents and what part of the original source is replaced by this new source.
   Useful when you want to inject a new string fragment as a replacement for part of the original query.
3. **SourceLocationNoMaterialize**: Indicate this node and its children are not represented in the query, but merely provide additional usability to the AST consumers.
   For example, implicit default graph patterns have no textual representation but are present in the AST for semantic completeness.
4. **SourceLocationStringReplace**: Indicate this node and its children can be represented using a specified string instead of the specified range of characters in the original string.
   Useful when you want to replace a subtree with a known string without re-generating it.
5. **SourceLocationNodeReplace**: Indicate you wish the generator to auto generate the AST node as a replacement of the specified range.
   The generator will produce fresh output for this node, but will use the original source for siblings.
6. **SourceLocationNodeAutoGenerate**: Indicate you wish the generator to auto generate the string for this node and do not relate it to the source string (since you likely don't have it).
   This is the most common location type for newly created AST nodes.

In order to support round tripping, the AST tree structure has the following restrictions regarding the ranges:
1. The source related ranges of descendents of a node that relates itself to a source using some range, should be contained within that node. Concretely: if a node says it represents range x-y, it's descendants must represent subranges of x-y.
2. The generation of a single node should call to sub generations in the order that matches the ranges order:
If a node has subnodes A, B and C; the generating function should call to A, B and C in the order that they represent in string.

Furthermore, parsers may choose to emit only _SourceLocationNodeAutoGenerate_ since collecting the source information puts additional strain on the lexer.
This is what happens for Traqula's SPARQL parsers, and it's why you need to [enable collecting the info in the context](../../engines/parser-sparql-1-1/README.md#collecting-round-tripping-information).

### SPARQL AST

The SPARQL AST is declared as union type `Sparql11Nodes`
[within @traqula/rules-sparql-1-1](../../packages/rules-sparql-1-1/lib/Sparql11types.ts).
Additionally,
the package contains [a factory](../../packages/rules-sparql-1-1/lib/astFactory.ts) simplifying the creation of AST nodes.

In the example bellow we parse a SPARQL query and append the prefix `ex:` to the list of prefixes:

```typescript
import { Parser } from '@traqula/parser-sparql-1-1'
import { Generator } from '@traqula/generator-sparql-1-1'
import { AstFactory, type QuerySelect } from '@traqula/rules-sparql-1-1'
const parser = new Parser();
const generator = new Generator();
const F = new AstFactory();
const query = `
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT * { ?s ?p ?o }
`

const ast = <QuerySelect> parser.parse(query);
ast.context.append(F.contextDefinitionPrefix(
  F.gen(),
  'ex',
  F.termNamed(F.gen(), 'https://example.com/')
));
const truety = generator.generate(ast) === `
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX ex: <https://example.com/>
SELECT * { ?s ?p ?o }
`;
```

## Transform

In order to facilitate the manipulation of multiple nodes, possibly deep within the AST,
Traqula provides a generic transformer that uses the `type` and `subType` of the AST nodes.

The example below shows how the transformer can capitalize all string literals in a SPARQL query:

```typescript
import { AstTransformer, AstFactory } from "@traqula/rules-sparql-1-1";
import { Parser } from '@traqula/parser-sparql-1-1'
import { Generator } from '@traqula/generator-sparql-1-1'
const parser = new Parser();
const transformer = new AstTransformer();
const F = new AstFactory();
const generator = new Generator();

const ast = parser.parse(`
SELECT * {
  ?s ?p 'bang', 'help',
'monster' .
}
`)
const transformed = transformer.transformNodeSpecific(ast, {}, {
  // Target Nodes of type 'term' and subType 'literal', providing the function to transform them.
  'term': { 'literal': { transform: (literal) => {
    if (typeof literal.langOrIri === 'object' &&
      literal.langOrIri.value === 'http://www.w3.org/2001/XMLSchema#string') {
      return F.literal(F.sourceLocationNodeReplaceUnsafe(literal), literal.value.toUpperCase());
    }
    return literal;
  }}}
});
const truety = generator.generate(transformed) === `
SELECT * {
  ?s ?p 'BANG', 'HELP',
'MONSTER' .
}
`
```

### Contexts

A context tells a transformer how to traverse one object: which keys to skip (`ignoreKeys`), which to copy shallowly
without traversing them (`shallowKeys`), whether to copy it (`copy`), and whether to go deeper (`continue`) or stop
altogether (`shortcut`).
The first argument of a transformer's constructor is the default context, used for every object.
A `preVisitor` callback returns the context of one node, on top of that default.
The second argument holds the per type defaults: a default context per node `type`.

### Default Traversal

By default, a transformer visits every key of an object, except its `ignoreKeys`.
An `AstTransformer` ignores the `loc` of nodes by default, since source locations hold no nodes; giving your own
`ignoreKeys` replaces that. Only objects whose `type` is a string are nodes, so the rows of VALUES keep their `loc`
key, also when a variable is named `type`, and a variable named `loc` is still visited.

### Custom Traversal

A context can give `visitChildren` instead: a callback that visits the children of the object itself.
It calls the `visitKey(holder, key)` of its second argument for each child to traverse.

To reach children within objects without a `type`, like the elements of the `updates` of an update,
it first calls `stepIntoKey(holder, key)`. The compiler checks the keys of both.

```typescript
import { AstTransformer } from "@traqula/rules-sparql-1-1";
import { Parser } from '@traqula/parser-sparql-1-1'

const ast = new Parser().parse('INSERT DATA { <a> <b> <c> } ; CLEAR ALL');
// A default that visits no children, so only the children the update visits are traversed
const transformer = new AstTransformer({ visitChildren: () => {} });
const operations: string[] = [];
transformer.visitNode(ast, {
  'update': { preVisitor: () => ({ visitChildren: (update, { visitKey, stepIntoKey }) => {
    const updates = stepIntoKey(update, 'updates');
    for (let index = updates.length - 1; index >= 0; index--) {
      visitKey(stepIntoKey(updates, index), 'operation');
    }
  } }) },
  'updateOperation': { visitor: (operation) => { operations.push(operation.subType); } },
});
const truety = operations.join() === 'insertdata,clear';
```

Keep in mind that:
- a context's `visitChildren` replaces that of its default, it is not merged with it;
- the children passed to `visitKey` last are traversed first, so loop over arrays backwards to keep their order;
- visiting an array visits all its elements: to visit only some, call `visitKey(array, index)` for each of them;
- when transforming, `stepIntoKey` returns a copy put in place of the original, so write through it.

The node's `ignoreKeys` and `shallowKeys` still apply to its own keys, and the object you start from is always visited.

### Known Keys Allowlists

An allowlist skips the keys Traqula does not know, like those of an extension or engine metadata.
Pass `astKnownKeysAllowlist` of `@traqula/rules-sparql-1-1` or `@traqula/rules-sparql-1-2`,
or `algebraUtils.knownKeysAllowlist`, as the per type defaults.
Known node types then only visit their keys that can hold nodes; other objects get the default context.

`visitOnlyKnownKeys` of `@traqula/core` builds such an allowlist, the compiler checking that it lists every key holding
an object: `true` visits it, `false` skips it, and a `visitChildren` steps into its value first.
`visitElementKeys` gives that callback for an array: it visits its nodes, and the given keys of its other elements.
Spread `astKnownKeys` to extend the AST allowlists.

```typescript
import { visitElementKeys, visitOnlyKnownKeys } from '@traqula/core';
import type { Sparql11Nodes } from '@traqula/rules-sparql-1-1';

const allowlist = visitOnlyKnownKeys<Sparql11Nodes>({
  // ...
  path: { items: true, loc: false },
  update: { updates: visitElementKeys('operation', 'context'), loc: false },
  // ...
});
```

### Passing Transformers to the Parser and Algebra

The rules of the parser, `toAlgebra`, and `toAst` traverse with the transformers you give them.

```typescript
import { toAlgebra, toAst } from '@traqula/algebra-sparql-1-1';
import { algebraUtils, Algebra } from '@traqula/algebra-transformations-1-1';
import { TransformerSubTyped } from '@traqula/core';
import { Parser } from '@traqula/parser-sparql-1-1';
import { AstTransformer, astKnownKeysAllowlist } from '@traqula/rules-sparql-1-1';

const astTransformer = new AstTransformer({}, astKnownKeysAllowlist);
const algebraTransformer = new TransformerSubTyped<Algebra.Operation>({}, algebraUtils.knownKeysAllowlist);
const ast = new Parser({ defaultContext: { astTransformer }}).parse('SELECT * WHERE { ?s ?p ?o }');
const algebra = toAlgebra(ast, { astTransformer, algebraTransformer });
const roundTripped = toAst(algebra, { astTransformer, algebraTransformer });
```

## See Also

- [Design decisions — Round Tripping](../design.md#round-tripping) — rationale behind the source location approach
- [Guidelines for dependent projects](../guidelines.md) — best practices for extending Traqula
- [Create a parser](../modifications/create-parser.md) — step-by-step parser creation
- [Create a generator](../modifications/create-generator.md) — how to build a round-tripping generator
- [API documentation (TypeDoc)](https://comunica.github.io/traqula/) — auto-generated API docs
