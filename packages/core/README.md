# Traqula core package

Traqula core contains core components of Traqula.
Most importantly, its [lexer builder](./lib/lexer-builder/LexerBuilder.ts), [parser builder](./lib/parser-builder/parserBuilder.ts), and [generator builder](./lib/generator-builder/generatorBuilder.ts).
This library heavily relies on the amazing [Chevrotain package](https://chevrotain.io/docs/).
Knowing the basics of that package will allow you to quickly generate your own grammars.

## Installation

```bash
npm install @traqula/core
```

or

```bash
yarn add @traqula/core
```

## Usage

Each parser contains two steps:
1. a lexer
2. a grammar + abstract syntax tree generation step.

Sometimes grammar definitions and abstract syntax tree generation is split into separate steps.
In this library, we choose to keep the two together when building a parser.

### Lexer Builder

To tackle the first step, a lexer should be created.
This is a system that separates different groups of characters into annotated groups.
In human language for example the sentence 'I eat apples' is lexed into different groups called **tokens** namely `words` and `spaces`:
`I`, ` `, `eat`, ` `, `apples`.

To create a token definition, you use the provided function `createToken` like:
```typescript
const select = createToken({ name: 'Select', pattern: /select/i, label: 'SELECT' });
```

Lexer definitions are then put in a list and when a lexer is build, the lexer will match a string to the [**first token in the list**](https://chevrotain.io/docs/tutorial/step1_lexing.html#creating-the-lexer) that matches.
Note that the order of definitions in the list is thus essential.

We therefore use a [lexer builder](./lib/lexer-builder/LexerBuilder.ts) which allows you to easily:
1. change the order of lexer rules,
2. and create a new lexer staring from an existing one.

Creating a builder is as easy as:

```typescript
const sparql11Tokens = LexerBuilder.create(<const> [select, describe]);
```

A new lexer can be created from an existing one by calling:
```typescript
const sparql11AdjustTokens = sparql11Tokens.addBefore(select, BuiltInAdjust);
```

### Parser Builder

The grammar builder is used to link together grammar rules such that they can be converted into a parser.
Grammar rule definitions come in the form of [ParserRule](./lib/parser-builder/ruleDefTypes.ts) objects.
Each `ParserRule` object contains its name and its returnType.
Optionally, it can also contain arguments that should be provided to the SUBRULE calls.
A simple example of a grammar rule is the rule bellow that allows you to parse booleanLiterals.

```typescript
/**
 * Parses a boolean literal.
 * [[134]](https://www.w3.org/TR/sparql11-query/#rBooleanLiteral)
 */
export const booleanLiteral: ParserRule<'booleanLiteral', LiteralTerm> = <const> {
    name: 'booleanLiteral',
    impl: ({ CONSUME, OR, context }) => () => OR([
      { ALT: () => context.dataFactory.literal(
          CONSUME(l.true_).image.toLowerCase(),
          context.dataFactory.namedNode(CommonIRIs.BOOLEAN),
        ) },
      { ALT: () => context.dataFactory.literal(
          CONSUME(l.false_).image.toLowerCase(),
          context.dataFactory.namedNode(CommonIRIs.BOOLEAN),
        ) },
    ]),
  };
```

The `impl` member of `ParserRule` is a function that receives:
1. essential functions to create a grammar rule (capitalized members),
2. a context object that can be used by the rules,
3. a cache object ([WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)) that can be used to cache the creation of long lists in the parser, [increasing parser performance](https://chevrotain.io/docs/guide/performance.html#caching-arrays-of-alternatives).

You cannot unpack the context entry in the function definition itself because the parser uses a [recording phase](https://chevrotain.io/docs/guide/internals.html#grammar-recording) to optimize itself. During this phase, the context entry will be undefined, as such, it can only be accessed within the `ACTION` function.

The result of an `impl` call is a function called a `rule`.
Rules can be [parameterized](https://chevrotain.io/docs/features/parameterized_rules.html), although I have not found a scenario where that is usefully.
Personally I create a function that can be used to create multiple `ParserRule` objects.
The result of a rule should match the type provided in the `ParserRule` definition, and is the result of a call of `SUBRULE` with that rule.

#### Patching rules

When a rule definition calls to a subrule using `SUBRULE(mySub)`, the implementation itself is not necessarily called.
That is because the SUBRULE function will call the function with the same name as `mySub` that is present in the current grammarBuilder.

A builder is thus free to override definitions as it pleases. Doing so does however **break the types** and should thus only be done with care.
An example patch is:

```typescript
const myBuilder = Builder
  .createBuilder(<const> [selectOrDescribe, selectRule, describeRule])
  .patchRule(selectRuleAlternative);
```

When `selectOrDescribe` calls what it thinks to be `selectRule`,
it will instead call `selectRuleAlternative` since it overwrote the function `selectRule` with the same name.

### Generator Builder

The generator builder function in much the same as the [parser builder](#parser-builder).
Your builder expects objects of type [GeneratorRule](lib/generator-builder/generatorTypes.ts),
containing the implementation of the generator in the `gImpl` member.
The `gImpl` function gets essential functions to create a generator rule (capitalized members),
returning a function that will get the AST and context, returning a string.
For generator rules, you can unpack the context since no recording phase is present in this case.
The idea is that GeneratorRules and ParserRules can be tied together in the same object, as such, similar behaviour is grouped together.

```typescript
/**
 * Parses a named node, either as an IRI or as a prefixed name.
 * [[136]](https://www.w3.org/TR/sparql11-query/#riri)
 */
export const iri: GeneratorRule<'iri', IriTerm> = <const> {
    name: 'iri',
    gImpl: () => ast => ast.value,
  };
```
