# Traqula SPARQL 1.2 to SPARQL 1.1 algebra

[![npm version](https://badge.fury.io/js/@traqula%2Falgebra-sparql-1-2-to-1-1.svg)](https://www.npmjs.com/package/@traqula/algebra-sparql-1-2-to-1-1)

Traqula SPARQL 1.2 to SPARQL 1.1 algebra rewrites [SPARQL 1.2](https://www.w3.org/TR/sparql12-query/) algebra,
as produced by [`@traqula/algebra-sparql-1-2`](../algebra-sparql-1-2), into SPARQL 1.1 algebra.
The rewritten query is meant for data that holds **no triple terms**:
a triple term is looked up as its [RDF 1.1 reification](https://www.w3.org/TR/rdf11-mt/#reification).

## Installation

```bash
npm install @traqula/algebra-sparql-1-2-to-1-1
```

or

```bash
yarn add @traqula/algebra-sparql-1-2-to-1-1
```

## Usage

```typescript
import { toAst } from '@traqula/algebra-sparql-1-1';
import { toAlgebra } from '@traqula/algebra-sparql-1-2';
import { toSparql11Algebra } from '@traqula/algebra-sparql-1-2-to-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser } from '@traqula/parser-sparql-1-2';

const algebra12 = toAlgebra(new Parser().parse(`
PREFIX : <http://example.org/>
SELECT ?who WHERE { << :alice :knows :bob >> :accordingTo ?who }
`));
const query11 = new Generator().generate(toAst(toSparql11Algebra(algebra12)));
```

`query11` matches the reifier through a fresh variable holding the reification node (IRIs abbreviated here):

```sparql
SELECT ?who WHERE {
  _:g_0 rdf:reifies ?tt0 .
  ?tt0 rdf:subject :alice .
  ?tt0 rdf:predicate :knows .
  ?tt0 rdf:object :bob .
  _:g_0 :accordingTo ?who .
}
```

## What is rewritten

- **Triple terms in a BGP or at the ends of a path** become a fresh variable `?n` with the patterns
  `?n rdf:subject s . ?n rdf:predicate p . ?n rdf:object o`, nested triple terms likewise.
  Reified triples and annotations are triple terms under `rdf:reifies` in the algebra, so they follow.
- **Triple terms in a CONSTRUCT or INSERT template** become a blank node with those three triples.
- **Variables the query binds to a triple term**, through `BIND` or `VALUES`, no longer exist:
  the three components are bound to three variables (`?tt_x_s`, `?tt_x_p`, `?tt_x_o` for `?x`),
  which are bound together or not at all. A subquery projects, and a `GROUP BY` groups on, those instead.
- **`SUBJECT`, `PREDICATE`, `OBJECT`, `isTRIPLE`, `sameTerm`, `=` and `!=`** are resolved
  over such a variable, a written triple term and `TRIPLE(…)`.
- **Variables the data binds** hold the reification node, which stands for the triple term.
  Where the query reads the components of such a variable, with `SUBJECT`, `PREDICATE`, `OBJECT` or `isTRIPLE`,
  they are looked up, one pattern per component read:

  ```sparql
  # SELECT ?s WHERE { ?r rdf:reifies ?t . BIND(SUBJECT(?t) AS ?s) }
  SELECT (?tt_t_s AS ?s) WHERE {
    ?r rdf:reifies ?t .
    OPTIONAL { ?t rdf:subject ?tt_t_s . }
  }
  ```

  The lookup follows every BGP and path binding the variable as subject or object.
  A `BIND(?t AS ?u)` copies the components of `?t` to `?u`.
  After any other `BIND`, a `VALUES` with `UNDEF` or an aggregate, which might leave the variable unbound,
  the lookup goes through a fresh node, `OPTIONAL { ?n rdf:subject ?tt_u_s FILTER(sameTerm(?n, ?u)) }`,
  so it does not bind the variable to every node where it is unbound.
  `isTRIPLE(?t)` asks whether `?t` has an `rdf:subject`, `SUBJECT(OBJECT(?t))` nests a second lookup in the first,
  and comparing `?t` to a triple term the query makes compares their components.
  Over anything else there is no triple term to find:
  the accessors become `COALESCE()`, the expression SPARQL 1.1 defines to raise an error, and `isTRIPLE` is false.
- **Base directions are dropped**: `"a"@en--ltr` becomes `"a"@en`, `STRLANGDIR` becomes `STRLANG`,
  `LANGDIR` gives `""`, `hasLANGDIR` is false and `hasLANG` is written with `LANG`.

## What is not

An `UnsupportedSparql12Error` is thrown for a triple term the query binds itself and then uses where its components
cannot be read: in the solutions of the query, an `ORDER BY`, an aggregate, a function other than those above,
a `DELETE` template, or when the same variable is bound to something that is no triple term.

Some limits come with reading the query statically, without knowing the data:

- A variable is a triple term **by name**: once the query binds `?x` to a triple term somewhere,
  `?x` is taken to hold a triple term everywhere, also in a subquery that does not share it.
- A reification node is **still a node**: `?s ?p ?o` also matches the `rdf:subject`, `rdf:predicate` and `rdf:object`
  triples themselves, and a projected variable gives the node rather than a triple term.
  Hiding the encoding altogether is what [view unfolding](https://github.com/jitsedesmet/sparql-view-unfold) is for.
- The lookup assumes a node has **one** `rdf:subject`, `rdf:predicate` and `rdf:object`: more of them multiply solutions.
- With the `quads` option of `toAlgebra`, a lookup that follows no pattern, such as one after a `VALUES`,
  queries the default graph, also within `GRAPH`.
- An argument of `TRIPLE(…)` is evaluated once per place its value is needed,
  so `TRIPLE(?s, ?p, RAND())` can give a different object per read.
