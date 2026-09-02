# Traqula, as this repo finds it

Upstream behaviours of [Traqula](https://github.com/comunica/traqula) that shape the code here. Each one
is written down so that the next agent does not rediscover it, and — more to the point — does not "fix"
one of our passes to work around something that is not our defect.

Every entry is reproducible with `createPartialContext()` and nothing else.

## 1. `toAst` lifted an `EXTEND` out of a `GRAPH` — a bug, now fixed in `lib/`

`toAst` used to write an `EXTEND` at the top of a graph pattern as a `SELECT` expression, which put it
**outside** the `GRAPH` it was inside. The round trip did not preserve the algebra:

```sparql
SELECT * WHERE { GRAPH ?g { OPTIONAL { ?g :q ?w } BIND(?g AS ?x) } }
```

```text
parsed:   project(graph(extend(leftjoin(bgp, bgp))))     cVars = {g}
printed:  SELECT ?g ?w ( ?g AS ?x ) WHERE { GRAPH ?g { OPTIONAL { ?g <ex://q> ?w . } } }
reparsed: project(extend(graph(leftjoin(bgp, bgp))))     cVars = {g, x}
```

**Why it was wrong, not merely different.** `Graph(?g, P)` evaluates `P` against each named graph and
*then* joins `{?g ↦ u}` on, so `?g` is bound **outside** the pattern and not inside it. In the parsed
tree the bind reads a `?g` the `OPTIONAL` leaves unbound on the rows where it missed, so `?x` is unbound
there; in the re-parsed tree it reads the graph name, which is always bound. `SELECT *` therefore returned
a value for `?x` on rows where the original returned none — the differing `cVars` above was this repo's
own analysis saying so.

A ground bind (`BIND(:a AS ?x)`) survives the same round trip unharmed, which is why the bug was easy to
miss: it only bites when the expression reads a variable whose binding differs inside and outside the
`GRAPH`, and the graph variable is exactly such a variable.

**What we did about it.** Two `lib/` fixes, in `packages/algebra-transformations-1-1/lib/toAst/`:

- `core.ts`'s `registerProjection` used to treat `GRAPH` as transparent to projection scope (the same
  list that lets an `EXTEND`/`ORDER_BY` chain stay open down to a `SELECT` expression also listed
  `GRAPH`). That is exactly the hoist above: it let an `EXTEND` sitting inside a `GRAPH` register as a
  top-level `SELECT` expression instead of rendering as an inline `BIND`. `GRAPH` is no longer in that
  list, so it now closes projection scope like everything else `EXTEND`/`ORDER_BY` isn't.
- That fix alone surfaced a second, previously-masked bug in `quads.ts`'s `removeAlgQuadsRecursive` — the
  pass that reconstructs an explicit `Graph` node from the `.graph` field "quads" mode tags onto `BGP`
  patterns, before the projection-scope walk ever runs. It used to defer picking where to wrap the
  `Graph` node up through *every* intervening operator until it hit a `PROJECT`/`SERVICE` boundary. For
  `EXTEND`/`GROUP`/`ORDER_BY` — solution modifiers that render as external state, not as a bracket around
  their input — that deferral placed the reconstructed `GRAPH` **below** them instead of around them,
  which is the toAlgebra-side twin of the exact bug `core.ts` fixes on the toAst side: with the `core.ts`
  fix in place, this then closed projection scope too early and demoted a genuine aggregate/subquery
  alias to an inline `BIND`. `GROUP` and `ORDER_BY` (always external state, regardless of context) and
  `EXTEND` when in projection scope (mirroring `registerProjection`'s own `c.project`, computed by
  threading a `projectionScope` flag down through the same recursion) now stop that deferral and wrap
  immediately, alongside the existing `PROJECT`/`SERVICE` boundary. `FILTER` and the multi-branch
  combinators (`JOIN`/`LEFT_JOIN`/`MINUS`/`UNION`) still defer, deliberately: they render their input
  inline in the same group as their own clause, so letting sibling occurrences of one graph (e.g. a
  `FILTER` whose `EXISTS` sub-pattern targets the same graph as its main pattern) bubble up and merge into
  one `GRAPH` block is correct, not a bug.

`test/extraCoverage.test.ts`'s `recurseGraph EXTEND handling` describe block and `test/sparql.test.ts`'s
canonical-SPARQL fixtures (particularly the `-quads` ones, which are what exercises `removeAlgQuadsRecursive`)
cover this. `pullUpExtends` and `test/pullUpExtends.test.ts`, mentioned in earlier drafts of this note, do
not exist in this repo — do not go looking for them.

## 2. `toAst` cannot render an `EXTEND` as the root of a query — not a bug

`Extend(Project(…), ?x, e)` throws `Unknown Operation type extend`. This is correct: SPARQL has nowhere
to write a `BIND` above a `SELECT`, or between it and its `LIMIT`, so there is no query for that tree.

**What we do about it.** `pullUpExtends` seals the query's solution-modifier chain
(`ASK`/`CONSTRUCT`/`DESCRIBE`/`PROJECT`/`DISTINCT`/`REDUCED`/`SLICE`/`FROM`) against rises. Drops still
fire there. See §A.7 and the phase-1 deviations in `agent-task.md`.

## 3. `toAst` writes an `EXTEND` in the top-level chain as a `SELECT` expression — benign

The same flattening as entry 1, in the place it belongs. `Project(Extend(OrderBy(P), ?x, e))` prints as
`SELECT … (e AS ?x) … ORDER BY …`, which re-parses to `Project(OrderBy(Extend(P, ?x, e)))`.

That is faithful rather than lucky, and it is worth knowing *why*, because it looks like entry 1 and is
not. The question it turns on: is a variable a `SELECT` expression introduces in scope for `ORDER BY`?

**The spec says yes, by where it puts the step.** SPARQL builds the algebra as a sequence of wrappings,
so a step that runs earlier ends up *deeper*. `(expr AS ?var)` becomes an `Extend` in
[§18.3.4.4 SELECT Expressions](https://www.w3.org/TR/sparql12-query/#selExpr), and the `OrderBy` is added
in [§18.3.5 Converting Solution Modifiers](https://www.w3.org/TR/sparql12-query/#convertSolMod), which
comes after — so the `Extend` lands under the `OrderBy`.

The easiest way to check that reading is to look at what §18.3.5 lists. It applies the modifiers "in the
following order: Order by, Projection, Distinct, Reduced, Offset, Limit" — **no step for select
expressions**. They are absent because they are already converted. And §18.3.4.4 cannot be about
sub-selects only, as it might first appear: a sub-select is translated as a whole query where its graph
pattern is translated, so if §18.3.4.4 did not cover the top level, a plain
`SELECT (COUNT(*) AS ?c) …` would have no rule producing its `Extend` at all.

**Two implementations and one idiom agree.** The everyday proof is the query nobody disputes:

```sparql
SELECT ?x (COUNT(*) AS ?c) WHERE { ?x :p ?o } GROUP BY ?x ORDER BY DESC(?c)
```

An aggregate alias is a select expression like any other; were the `Extend` outside the `OrderBy`, `?c`
would be unbound at ordering time and this would silently not sort. Measured rather than assumed:
`SELECT ?v ((0 - ?v) AS ?neg) { VALUES ?v { 1 2 3 } } ORDER BY ?neg` returns `3, 2, 1` under Comunica,
matching the `BIND`-in-`WHERE` spelling and differing from the unordered control, and Traqula's own
`toAlgebra` reads that query back as `project(orderby(extend(…)))`.

**What follows for us.** Moving an `EXTEND` *across* an `ORDER BY` is sound on top of that: an `EXTEND` is
element-wise and order-preserving, so the swap changes nothing as long as the ordering does not read the
variable. This is why `ORDER_BY` is deliberately **not** on the sealed chain of entry 2, and why a test
whose expected output shows a `BIND` as a `SELECT` expression is not evidence that the bind moved — assert
on the algebra if that is the question. `test/eval.test.ts` carries two order-preserving cases, since
neither a sorted comparison nor a string comparison can see an ordering change.

Adjacent but not ours: a [known erratum](https://www.w3.org/2013/sparql-errata) records that `DISTINCT`
and projection must preserve the ordering `OrderBy` gave, and that this is unclear where the ordering uses
variables the projection drops. Nothing here changes which variables are ordered by, other than removing
comparators that decide nothing — and a comparator that compared equal on every pair carried no order to
lose.

Where the same flattening crosses a `GRAPH` instead, it is entry 1, and there it really is a bug.
